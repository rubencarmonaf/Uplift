import { randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  Arm,
  Experiment,
  ExperimentAction,
  RuntimeConfig,
  UpdateExperimentInput,
} from '@uplift/shared';
import { and, eq, inArray } from 'drizzle-orm';
import { env } from '../config/env.js';
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
import { ProjectAccessService } from '../projects/project-access.service.js';

type ExperimentRow = typeof experiments.$inferSelect;

export const toExperimentDto = (row: ExperimentRow): Experiment => ({
  id: row.id,
  projectId: row.projectId,
  status: row.status,
  publicKey: row.publicKey,
  trafficPercent: row.trafficPercent,
  antiFlicker: { enabled: row.antiFlickerEnabled, timeoutMs: row.antiFlickerTimeoutMs },
  scope: row.scope,
  arms: row.arms,
  winnerArmId: row.winnerArmId,
  startedAt: row.startedAt?.toISOString() ?? null,
  endedAt: row.endedAt?.toISOString() ?? null,
  updatedAt: row.updatedAt.toISOString(),
  snippetUrl: `${env.PUBLIC_API_URL}/s/${row.publicKey}/uplift.js`,
  testPageUrl: `${env.PUBLIC_API_URL}/s/${row.publicKey}/test`,
});

const ARM_LETTERS = 'ABCD';

@Injectable()
export class ExperimentsService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  /** The project's experiment, created as a draft with sensible defaults the first time. */
  async get(userId: string, projectId: string) {
    const { project, role } = await this.projectAccess.load(userId, projectId, 'viewer');
    const [existing] = await this.db
      .select()
      .from(experiments)
      .where(eq(experiments.projectId, projectId));
    if (existing) return toExperimentDto(existing);
    if (role === 'viewer') throw new NotFoundException();
    return toExperimentDto(await this.createDraft(project));
  }

  async update(userId: string, projectId: string, input: UpdateExperimentInput) {
    await this.projectAccess.load(userId, projectId, 'editor');
    const current = await this.load(projectId);

    const changes: Partial<typeof experiments.$inferInsert> = {};
    if (input.trafficPercent !== undefined) changes.trafficPercent = input.trafficPercent;
    if (input.antiFlicker) {
      changes.antiFlickerEnabled = input.antiFlicker.enabled;
      changes.antiFlickerTimeoutMs = input.antiFlicker.timeoutMs;
    }
    if (input.scope) changes.scope = input.scope;
    if (input.arms) {
      // Changing what is being compared would mix incompatible data; start over instead.
      if (current.status !== 'draft') {
        throw new ConflictException('Arms can only be changed while the experiment is a draft');
      }
      changes.arms = await this.validateArms(projectId, input.arms);
    }

    const [row] = await this.db
      .update(experiments)
      .set(changes)
      .where(eq(experiments.id, current.id))
      .returning();
    return toExperimentDto(row!);
  }

  async act(userId: string, projectId: string, { action, winnerArmId }: ExperimentAction) {
    await this.projectAccess.load(userId, projectId, 'editor');
    const current = await this.load(projectId);
    const now = new Date();

    const transition = async (
      from: ExperimentRow['status'][],
      set: Partial<typeof experiments.$inferInsert>,
      projectStatus?: typeof projects.$inferSelect.status,
    ) => {
      if (!from.includes(current.status)) {
        throw new ConflictException(`Cannot ${action} an experiment that is ${current.status}`);
      }
      return this.db.transaction(async (tx) => {
        const [row] = await tx
          .update(experiments)
          .set(set)
          .where(eq(experiments.id, current.id))
          .returning();
        if (projectStatus) {
          await tx
            .update(projects)
            .set({ status: projectStatus })
            .where(eq(projects.id, projectId));
        }
        return row!;
      });
    };

    let row: ExperimentRow;
    switch (action) {
      case 'start':
        await this.assertReadyToStart(projectId, current);
        row = await transition(['draft'], { status: 'running', startedAt: now }, 'running');
        break;
      case 'pause':
        row = await transition(['running'], { status: 'paused' });
        break;
      case 'resume':
        row = await transition(['paused'], { status: 'running' });
        break;
      case 'finish':
        if (winnerArmId && !current.arms.some((a) => a.id === winnerArmId)) {
          throw new BadRequestException('Unknown arm');
        }
        row = await transition(
          ['running', 'paused'],
          { status: 'finished', endedAt: now, winnerArmId: winnerArmId ?? null },
          'finished',
        );
        break;
      case 'reset':
        row = await this.db.transaction(async (tx) => {
          await tx.delete(experimentEvents).where(eq(experimentEvents.experimentId, current.id));
          const [updated] = await tx
            .update(experiments)
            .set({ status: 'draft', startedAt: null, endedAt: null, winnerArmId: null })
            .where(eq(experiments.id, current.id))
            .returning();
          await tx.update(projects).set({ status: 'ready' }).where(eq(projects.id, projectId));
          return updated!;
        });
        break;
    }
    return toExperimentDto(row);
  }

  /** Config for the production script, resolved to selectors and texts. Public: keyed by `publicKey`. */
  async runtimeConfig(publicKey: string): Promise<RuntimeConfig | null> {
    const [row] = await this.db
      .select()
      .from(experiments)
      .where(eq(experiments.publicKey, publicKey));
    if (!row) return null;

    const elementIds = [...new Set(row.arms.flatMap((a) => a.changes.map((c) => c.elementId)))];
    const variantIds = [...new Set(row.arms.flatMap((a) => a.changes.map((c) => c.variantId)))];
    const [elementRows, variantRows, goalRows] = await Promise.all([
      elementIds.length
        ? this.db
            .select({ id: pageElements.id, selector: pageElements.selector })
            .from(pageElements)
            .where(inArray(pageElements.id, elementIds))
        : [],
      variantIds.length
        ? this.db
            .select({ id: variants.id, text: variants.text })
            .from(variants)
            .where(inArray(variants.id, variantIds))
        : [],
      this.db.select().from(goals).where(eq(goals.projectId, row.projectId)),
    ]);
    const selectorOf = new Map(elementRows.map((e) => [e.id, e.selector]));
    const textOf = new Map(variantRows.map((v) => [v.id, v.text]));
    const resolve = (arm: Arm) =>
      arm.changes.flatMap((c) => {
        const selector = selectorOf.get(c.elementId);
        const text = textOf.get(c.variantId);
        return selector && text !== undefined ? [{ selector, text }] : [];
      });

    const winner = row.winnerArmId ? row.arms.find((a) => a.id === row.winnerArmId) : undefined;
    return {
      key: row.publicKey,
      experimentId: row.id,
      status: row.status,
      trafficPercent: row.trafficPercent,
      antiFlicker: { enabled: row.antiFlickerEnabled, timeoutMs: row.antiFlickerTimeoutMs },
      scope: row.scope,
      winner:
        row.status === 'finished' && winner ? { armId: winner.id, changes: resolve(winner) } : null,
      arms: row.arms.map((arm) => ({ id: arm.id, weight: arm.weight, changes: resolve(arm) })),
      goals: goalRows.map((g) => ({ id: g.id, ...g.target })),
      endpoint: `${env.PUBLIC_API_URL}/s/${row.publicKey}/events`,
    };
  }

  private async load(projectId: string) {
    const [row] = await this.db
      .select()
      .from(experiments)
      .where(eq(experiments.projectId, projectId));
    if (!row) throw new NotFoundException('Open the activation step first');
    return row;
  }

  private async createDraft(project: typeof projects.$inferSelect) {
    const url = new URL(project.url);
    const bestVariants = await this.bestVariantPerElement(project.id);
    const arms: Arm[] = [
      { id: randomUUID(), name: 'Control', weight: 50, isControl: true, changes: [] },
      { id: randomUUID(), name: 'Variante A', weight: 50, isControl: false, changes: bestVariants },
    ];
    const [row] = await this.db
      .insert(experiments)
      .values({
        projectId: project.id,
        publicKey: `pk_${randomBytes(12).toString('base64url')}`,
        scope: {
          domains: [url.hostname.toLowerCase()],
          path: { match: 'exact', value: url.pathname || '/' },
        },
        arms,
      })
      // Two tabs opening activation at once: the second one gets the first one's draft.
      .onConflictDoNothing({ target: experiments.projectId })
      .returning();
    return row ?? (await this.load(project.id));
  }

  /** For each element, its compliant active variant with the highest quality score. */
  private async bestVariantPerElement(projectId: string) {
    const rows = await this.db
      .select({
        elementId: variants.elementId,
        variantId: variants.id,
        quality: variants.qualityScore,
        compliance: variants.complianceScore,
      })
      .from(variants)
      .innerJoin(pageElements, eq(variants.elementId, pageElements.id))
      .where(and(eq(pageElements.projectId, projectId), eq(variants.status, 'active')));
    const best = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const current = best.get(row.elementId);
      const score = (r: typeof row) => r.compliance * 1000 + (r.quality ?? 0);
      if (!current || score(row) > score(current)) best.set(row.elementId, row);
    }
    return [...best.values()].map((r) => ({ elementId: r.elementId, variantId: r.variantId }));
  }

  /** Arms may only reference this project's elements and their active variants, once per element. */
  private async validateArms(projectId: string, arms: Arm[]) {
    const rows = await this.db
      .select({ variantId: variants.id, elementId: variants.elementId })
      .from(variants)
      .innerJoin(pageElements, eq(variants.elementId, pageElements.id))
      .where(and(eq(pageElements.projectId, projectId), eq(variants.status, 'active')));
    const elementOf = new Map(rows.map((r) => [r.variantId, r.elementId]));

    return arms.map((arm, index) => {
      if (arm.isControl) return { ...arm, changes: [] };
      const seen = new Set<string>();
      for (const change of arm.changes) {
        if (elementOf.get(change.variantId) !== change.elementId) {
          throw new BadRequestException(`Arm ${index + 1} uses a variant that is not available`);
        }
        if (seen.has(change.elementId)) {
          throw new BadRequestException(`Arm ${index + 1} changes the same element twice`);
        }
        seen.add(change.elementId);
      }
      return { ...arm, name: arm.name || `Variante ${ARM_LETTERS[index - 1] ?? index}` };
    });
  }

  private async assertReadyToStart(projectId: string, experiment: ExperimentRow) {
    const [primary] = await this.db
      .select({ id: goals.id })
      .from(goals)
      .where(and(eq(goals.projectId, projectId), eq(goals.isPrimary, true)));
    if (!primary)
      throw new BadRequestException({ message: 'Not ready', reason: 'no_primary_goal' });
    const testable = experiment.arms.some(
      (a) => !a.isControl && a.weight > 0 && a.changes.length > 0,
    );
    if (!testable)
      throw new BadRequestException({ message: 'Not ready', reason: 'no_variant_arm' });
    const control = experiment.arms.find((a) => a.isControl);
    if (!control || control.weight === 0) {
      throw new BadRequestException({ message: 'Not ready', reason: 'no_control_traffic' });
    }
  }
}
