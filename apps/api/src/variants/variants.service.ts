import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateVariantInput, UpdateVariantInput, Variant } from '@uplift/shared';
import { desc, eq, sql } from 'drizzle-orm';
import { normalizeBrief } from '../briefs/briefs.service.js';
import type { Db } from '../db/client.js';
import { InjectDb } from '../db/db.module.js';
import { pageElements, projectBriefs, projects, variants } from '../db/schema.js';
import type { Role } from '../organizations/org-access.service.js';
import { ProjectAccessService } from '../projects/project-access.service.js';
import { checkCompliance } from './compliance.js';

type VariantRow = typeof variants.$inferSelect;

export const toVariantDto = (row: VariantRow): Variant => ({
  id: row.id,
  elementId: row.elementId,
  text: row.text,
  angle: row.angle,
  rationale: row.rationale,
  complianceScore: row.complianceScore,
  qualityScore: row.qualityScore,
  issues: row.issues,
  status: row.status,
  source: row.source,
  saved: row.savedAt !== null,
  createdAt: row.createdAt.toISOString(),
});

@Injectable()
export class VariantsService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  /** Every variant of the project, newest first; the UI groups them by element. */
  async listForProject(userId: string, projectId: string) {
    await this.projectAccess.load(userId, projectId, 'viewer');
    const rows = await this.db
      .select({ variant: variants })
      .from(variants)
      .innerJoin(pageElements, eq(variants.elementId, pageElements.id))
      .where(eq(pageElements.projectId, projectId))
      .orderBy(desc(variants.createdAt));
    return rows.map((r) => toVariantDto(r.variant));
  }

  async createManual(userId: string, elementId: string, { text }: CreateVariantInput) {
    const { element, brief } = await this.loadElement(userId, elementId, 'editor');
    const { issues, score } = checkCompliance(text, element, brief);
    const [row] = await this.db
      .insert(variants)
      .values({
        elementId,
        text,
        source: 'manual',
        complianceScore: score,
        issues,
        createdBy: userId,
      })
      .returning();
    await this.touchProject(element.projectId);
    return toVariantDto(row!);
  }

  async update(userId: string, id: string, input: UpdateVariantInput) {
    const [current] = await this.db.select().from(variants).where(eq(variants.id, id));
    if (!current) throw new NotFoundException();
    const { element, brief } = await this.loadElement(userId, current.elementId, 'editor');

    const { saved, ...fields } = input;
    const changes: Partial<typeof variants.$inferInsert> = { ...fields };
    if (saved !== undefined) changes.savedAt = saved ? (current.savedAt ?? new Date()) : null;
    if (input.text !== undefined && input.text !== current.text) {
      // Edited copy is re-checked; the model's quality score no longer describes it.
      const { issues, score } = checkCompliance(input.text, element, brief);
      Object.assign(changes, { issues, complianceScore: score, qualityScore: null });
    }
    const [row] = await this.db
      .update(variants)
      .set(changes)
      .where(eq(variants.id, id))
      .returning();
    await this.touchProject(element.projectId);
    return toVariantDto(row!);
  }

  private async loadElement(userId: string, elementId: string, minRole: Role) {
    const [element] = await this.db
      .select()
      .from(pageElements)
      .where(eq(pageElements.id, elementId));
    if (!element) throw new NotFoundException();
    await this.projectAccess.load(userId, element.projectId, minRole);
    const [briefRow] = await this.db
      .select({ data: projectBriefs.data })
      .from(projectBriefs)
      .where(eq(projectBriefs.projectId, element.projectId));
    return { element, brief: normalizeBrief(briefRow?.data) };
  }

  private touchProject(projectId: string) {
    return this.db
      .update(projects)
      .set({ updatedAt: sql`now()` })
      .where(eq(projects.id, projectId));
  }
}
