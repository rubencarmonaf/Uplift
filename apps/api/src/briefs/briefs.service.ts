import { Injectable } from '@nestjs/common';
import { type Brief, type BriefResponse, briefSchema, EMPTY_BRIEF } from '@uplift/shared';
import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { InjectDb } from '../db/db.module.js';
import { projectBriefs, projects } from '../db/schema.js';
import { ProjectAccessService } from '../projects/project-access.service.js';

/**
 * Fills fields added to the schema after a brief was saved, so old briefs keep loading.
 * Sections are merged one level deep; anything that no longer validates falls back to empty.
 */
export function normalizeBrief(stored: unknown): Brief {
  const data = (stored ?? {}) as Partial<Record<keyof Brief, object>>;
  const merged = Object.fromEntries(
    Object.entries(EMPTY_BRIEF).map(([section, defaults]) => [
      section,
      { ...defaults, ...(data[section as keyof Brief] ?? {}) },
    ]),
  );
  const result = briefSchema.safeParse(merged);
  return result.success ? result.data : EMPTY_BRIEF;
}

@Injectable()
export class BriefsService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  async get(userId: string, projectId: string): Promise<BriefResponse> {
    await this.projectAccess.load(userId, projectId, 'viewer');
    const [row] = await this.db
      .select()
      .from(projectBriefs)
      .where(eq(projectBriefs.projectId, projectId));
    return {
      brief: normalizeBrief(row?.data),
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  }

  async save(userId: string, projectId: string, brief: Brief): Promise<BriefResponse> {
    await this.projectAccess.load(userId, projectId, 'editor');
    const row = await this.db.transaction(async (tx) => {
      const values = { projectId, data: brief, updatedBy: userId, updatedAt: new Date() };
      const [saved] = await tx
        .insert(projectBriefs)
        .values(values)
        .onConflictDoUpdate({ target: projectBriefs.projectId, set: values })
        .returning();
      await tx
        .update(projects)
        .set({ updatedAt: sql`now()` })
        .where(eq(projects.id, projectId));
      return saved!;
    });
    return { brief: row.data, updatedAt: row.updatedAt.toISOString() };
  }
}
