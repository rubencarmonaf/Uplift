import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PageElement, ReorderElementsInput, UpdateElementInput } from '@uplift/shared';
import { createElementSchema } from '@uplift/shared';
import { asc, eq, max, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { Db } from '../db/client.js';
import { InjectDb } from '../db/db.module.js';
import { pageElements, projects } from '../db/schema.js';
import type { Role } from '../organizations/org-access.service.js';
import { ProjectAccessService } from '../projects/project-access.service.js';

type ElementRow = typeof pageElements.$inferSelect;

export function toElementDto(row: ElementRow): PageElement {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    type: row.type,
    selector: row.selector,
    originalText: row.originalText,
    minLength: row.minLength,
    maxLength: row.maxLength,
    notes: row.notes,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class ElementsService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  async list(userId: string, projectId: string) {
    await this.projectAccess.load(userId, projectId, 'viewer');
    const rows = await this.db
      .select()
      .from(pageElements)
      .where(eq(pageElements.projectId, projectId))
      .orderBy(asc(pageElements.position), asc(pageElements.createdAt));
    return rows.map(toElementDto);
  }

  async create(userId: string, projectId: string, input: z.output<typeof createElementSchema>) {
    await this.projectAccess.load(userId, projectId, 'editor');
    const row = await this.db.transaction(async (tx) => {
      const [last] = await tx
        .select({ position: max(pageElements.position) })
        .from(pageElements)
        .where(eq(pageElements.projectId, projectId));
      const [element] = await tx
        .insert(pageElements)
        .values({ ...input, projectId, position: (last?.position ?? -1) + 1 })
        .returning();
      await this.touchProject(tx, projectId);
      return element!;
    });
    return toElementDto(row);
  }

  async update(userId: string, id: string, input: UpdateElementInput) {
    const current = await this.load(userId, id, 'editor');
    // The schema only checks the range when both bounds arrive together; check the merged result too.
    const minLength = input.minLength !== undefined ? input.minLength : current.minLength;
    const maxLength = input.maxLength !== undefined ? input.maxLength : current.maxLength;
    if (minLength != null && maxLength != null && minLength > maxLength) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: { maxLength: ['min > max'] },
      });
    }
    const row = await this.db.transaction(async (tx) => {
      const [element] = await tx
        .update(pageElements)
        .set(input)
        .where(eq(pageElements.id, id))
        .returning();
      await this.touchProject(tx, current.projectId);
      return element!;
    });
    return toElementDto(row);
  }

  async remove(userId: string, id: string) {
    const current = await this.load(userId, id, 'editor');
    await this.db.transaction(async (tx) => {
      await tx.delete(pageElements).where(eq(pageElements.id, id));
      await this.touchProject(tx, current.projectId);
    });
  }

  /** Sets the order of all the project's elements. `ids` must list every element exactly once. */
  async reorder(userId: string, projectId: string, { ids }: ReorderElementsInput) {
    await this.projectAccess.load(userId, projectId, 'editor');
    const existing = await this.db
      .select({ id: pageElements.id })
      .from(pageElements)
      .where(eq(pageElements.projectId, projectId));
    const expected = new Set(existing.map((e) => e.id));
    if (
      ids.length !== expected.size ||
      new Set(ids).size !== ids.length ||
      !ids.every((id) => expected.has(id))
    ) {
      throw new BadRequestException('ids must contain every element of the project exactly once');
    }
    await this.db.transaction(async (tx) => {
      for (const [position, id] of ids.entries()) {
        await tx.update(pageElements).set({ position }).where(eq(pageElements.id, id));
      }
      await this.touchProject(tx, projectId);
    });
    return this.list(userId, projectId);
  }

  private async load(userId: string, id: string, minRole: Role) {
    const [row] = await this.db.select().from(pageElements).where(eq(pageElements.id, id));
    if (!row) throw new NotFoundException();
    await this.projectAccess.load(userId, row.projectId, minRole);
    return row;
  }

  /** Editing the elements counts as editing the project, so it moves up in "last modified". */
  private touchProject(tx: Pick<Db, 'update'>, projectId: string) {
    return tx
      .update(projects)
      .set({ updatedAt: sql`now()` })
      .where(eq(projects.id, projectId));
  }
}
