import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateGoalInput, Goal, UpdateGoalInput } from '@uplift/shared';
import type { createGoalSchema } from '@uplift/shared';
import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { Db } from '../db/client.js';
import { InjectDb } from '../db/db.module.js';
import { goals, projects } from '../db/schema.js';
import type { Role } from '../organizations/org-access.service.js';
import { ProjectAccessService } from '../projects/project-access.service.js';

type GoalRow = typeof goals.$inferSelect;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export const toGoalDto = (row: GoalRow): Goal => ({
  id: row.id,
  projectId: row.projectId,
  name: row.name,
  target: row.target,
  isPrimary: row.isPrimary,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/**
 * Goals of a project. The invariant "exactly one primary goal while any goal exists" is kept
 * here and backed by a partial unique index in the database.
 */
@Injectable()
export class GoalsService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  async list(userId: string, projectId: string) {
    await this.projectAccess.load(userId, projectId, 'viewer');
    const rows = await this.db
      .select()
      .from(goals)
      .where(eq(goals.projectId, projectId))
      .orderBy(desc(goals.isPrimary), asc(goals.createdAt));
    return rows.map(toGoalDto);
  }

  async create(
    userId: string,
    projectId: string,
    input: z.output<typeof createGoalSchema> & CreateGoalInput,
  ) {
    await this.projectAccess.load(userId, projectId, 'editor');
    const row = await this.db.transaction(async (tx) => {
      const [existingPrimary] = await tx
        .select({ id: goals.id })
        .from(goals)
        .where(and(eq(goals.projectId, projectId), eq(goals.isPrimary, true)));
      // The first goal is primary automatically; a new primary demotes the old one.
      const isPrimary = input.isPrimary || !existingPrimary;
      if (isPrimary && existingPrimary) await this.demotePrimary(tx, projectId);
      const [goal] = await tx
        .insert(goals)
        .values({ projectId, name: input.name, target: input.target, isPrimary })
        .returning();
      await this.touchProject(tx, projectId);
      return goal!;
    });
    return toGoalDto(row);
  }

  async update(userId: string, id: string, input: UpdateGoalInput) {
    const current = await this.load(userId, id, 'editor');
    const row = await this.db.transaction(async (tx) => {
      if (input.isPrimary && !current.isPrimary) await this.demotePrimary(tx, current.projectId);
      const [goal] = await tx.update(goals).set(input).where(eq(goals.id, id)).returning();
      await this.touchProject(tx, current.projectId);
      return goal!;
    });
    return toGoalDto(row);
  }

  async remove(userId: string, id: string) {
    const current = await this.load(userId, id, 'editor');
    await this.db.transaction(async (tx) => {
      await tx.delete(goals).where(eq(goals.id, id));
      // Deleting the primary promotes the oldest remaining goal.
      if (current.isPrimary) {
        const [next] = await tx
          .select({ id: goals.id })
          .from(goals)
          .where(and(eq(goals.projectId, current.projectId), ne(goals.id, id)))
          .orderBy(asc(goals.createdAt))
          .limit(1);
        if (next) await tx.update(goals).set({ isPrimary: true }).where(eq(goals.id, next.id));
      }
      await this.touchProject(tx, current.projectId);
    });
  }

  private async load(userId: string, id: string, minRole: Role) {
    const [row] = await this.db.select().from(goals).where(eq(goals.id, id));
    if (!row) throw new NotFoundException();
    await this.projectAccess.load(userId, row.projectId, minRole);
    return row;
  }

  private demotePrimary(tx: Tx, projectId: string) {
    return tx
      .update(goals)
      .set({ isPrimary: false })
      .where(and(eq(goals.projectId, projectId), eq(goals.isPrimary, true)));
  }

  private touchProject(tx: Tx, projectId: string) {
    return tx
      .update(projects)
      .set({ updatedAt: sql`now()` })
      .where(eq(projects.id, projectId));
  }
}
