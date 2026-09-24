import { Injectable } from '@nestjs/common';
import type { LibraryItem, libraryQuerySchema } from '@uplift/shared';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { Db } from '../db/client.js';
import { InjectDb } from '../db/db.module.js';
import {
  experimentEvents,
  experiments,
  goals,
  pageElements,
  projects,
  variants,
} from '../db/schema.js';
import { OrgAccessService } from '../organizations/org-access.service.js';
import { analyze, seedFrom } from '../results/stats.js';

type Query = z.output<typeof libraryQuerySchema>;
type VariantInfo = {
  id: string;
  text: string;
  angle: LibraryItem['angle'];
  qualityScore: number | null;
  elementType: LibraryItem['elementType'];
  elementName: string;
  originalText: string;
  projectId: string;
  projectName: string;
};

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * The organization's library: copy that won a finished experiment (with its measured uplift)
 * plus variants people bookmarked. Winners come first, then the most recent.
 */
@Injectable()
export class LibraryService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly orgAccess: OrgAccessService,
  ) {}

  async list(userId: string, organizationId: string, query: Query): Promise<LibraryItem[]> {
    await this.orgAccess.assertRole(userId, organizationId, 'viewer');
    const items = [...(await this.winners(organizationId)), ...(await this.saved(organizationId))];

    // A variant can be both a winner and saved: keep the winner entry.
    const seen = new Set<string>();
    const unique = items.filter((item) => {
      if (seen.has(item.variantId)) return false;
      seen.add(item.variantId);
      return true;
    });

    const q = query.q ? fold(query.q) : null;
    return unique.filter(
      (item) =>
        (!query.type || item.elementType === query.type) &&
        (!query.source || item.source === query.source) &&
        (!q || fold(`${item.text} ${item.elementName} ${item.project.name}`).includes(q)),
    );
  }

  private async winners(organizationId: string): Promise<LibraryItem[]> {
    const finished = await this.db
      .select({ experiment: experiments, projectName: projects.name })
      .from(experiments)
      .innerJoin(projects, eq(experiments.projectId, projects.id))
      .where(
        and(
          eq(projects.organizationId, organizationId),
          eq(experiments.status, 'finished'),
          isNotNull(experiments.winnerArmId),
        ),
      );
    if (finished.length === 0) return [];

    const items: LibraryItem[] = [];
    for (const { experiment } of finished) {
      const winner = experiment.arms.find((a) => a.id === experiment.winnerArmId);
      if (!winner || winner.changes.length === 0) continue;
      const lift = await this.measuredLift(experiment);
      const infos = await this.variantInfo(winner.changes.map((c) => c.variantId));
      for (const info of infos) {
        items.push(
          toItem(info, 'winner', (experiment.endedAt ?? experiment.updatedAt).toISOString(), lift),
        );
      }
    }
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }

  private async saved(organizationId: string): Promise<LibraryItem[]> {
    const rows = await this.db
      .select({ id: variants.id, savedAt: variants.savedAt })
      .from(variants)
      .innerJoin(pageElements, eq(variants.elementId, pageElements.id))
      .innerJoin(projects, eq(pageElements.projectId, projects.id))
      .where(and(eq(projects.organizationId, organizationId), isNotNull(variants.savedAt)));
    const savedAt = new Map(rows.map((r) => [r.id, r.savedAt!.toISOString()]));
    const infos = await this.variantInfo(rows.map((r) => r.id));
    return infos
      .map((info) => toItem(info, 'saved', savedAt.get(info.id)!, null))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  /** Uplift of the winning arm over control on the primary goal, from the experiment's events. */
  private async measuredLift(experiment: typeof experiments.$inferSelect) {
    const [primary] = await this.db
      .select({ id: goals.id })
      .from(goals)
      .where(and(eq(goals.projectId, experiment.projectId), eq(goals.isPrimary, true)));
    if (!primary) return null;
    const counts = await this.db
      .select({
        armId: experimentEvents.armId,
        type: experimentEvents.type,
        count: sql<number>`count(*)::int`,
      })
      .from(experimentEvents)
      .where(
        and(
          eq(experimentEvents.experimentId, experiment.id),
          sql`(${experimentEvents.type} = 'exposure' or ${experimentEvents.goalId} = ${primary.id})`,
        ),
      )
      .groupBy(experimentEvents.armId, experimentEvents.type);
    const arms = experiment.arms.map((arm) => ({
      id: arm.id,
      isControl: arm.isControl,
      visitors: counts.find((c) => c.armId === arm.id && c.type === 'exposure')?.count ?? 0,
      conversions: counts.find((c) => c.armId === arm.id && c.type === 'conversion')?.count ?? 0,
    }));
    if (arms.every((a) => a.visitors === 0)) return null;
    // Same seed as the results page, so the numbers match what people saw there.
    const stats = analyze(arms, seedFrom(`${experiment.id}:${primary.id}`));
    const winner = stats.find((s) => s.id === experiment.winnerArmId);
    return winner ? { uplift: winner.uplift, probBeatControl: winner.probBeatControl } : null;
  }

  private async variantInfo(ids: string[]): Promise<VariantInfo[]> {
    if (ids.length === 0) return [];
    return this.db
      .select({
        id: variants.id,
        text: variants.text,
        angle: variants.angle,
        qualityScore: variants.qualityScore,
        elementType: pageElements.type,
        elementName: pageElements.name,
        originalText: pageElements.originalText,
        projectId: projects.id,
        projectName: projects.name,
      })
      .from(variants)
      .innerJoin(pageElements, eq(variants.elementId, pageElements.id))
      .innerJoin(projects, eq(pageElements.projectId, projects.id))
      .where(inArray(variants.id, ids));
  }
}

function toItem(
  info: VariantInfo,
  source: LibraryItem['source'],
  date: string,
  lift: { uplift: number | null; probBeatControl: number | null } | null,
): LibraryItem {
  return {
    variantId: info.id,
    text: info.text,
    angle: info.angle,
    elementType: info.elementType,
    elementName: info.elementName,
    originalText: info.originalText,
    project: { id: info.projectId, name: info.projectName },
    source,
    uplift: lift?.uplift ?? null,
    probBeatControl: lift?.probBeatControl ?? null,
    qualityScore: info.qualityScore,
    date,
  };
}
