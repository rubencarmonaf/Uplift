import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ArmResult,
  ExperimentResults,
  SimulateTrafficInput,
  simulateTrafficSchema,
} from '@uplift/shared';
import { and, eq, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { Db } from '../db/client.js';
import { InjectDb } from '../db/db.module.js';
import { experimentEvents, experiments, goals, variants } from '../db/schema.js';
import { ProjectAccessService } from '../projects/project-access.service.js';
import { analyze, type ArmCounts, seededRandom, seedFrom, verdict } from './stats.js';

type ExperimentRow = typeof experiments.$inferSelect;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ResultsService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  async results(userId: string, projectId: string): Promise<ExperimentResults> {
    await this.projectAccess.load(userId, projectId, 'viewer');
    const experiment = await this.load(projectId);
    const goalRows = await this.db.select().from(goals).where(eq(goals.projectId, projectId));
    const primary = goalRows.find((g) => g.isPrimary) ?? null;

    const counts = await this.db
      .select({
        armId: experimentEvents.armId,
        type: experimentEvents.type,
        goalId: experimentEvents.goalId,
        count: sql<number>`count(*)::int`,
        simulated: sql<boolean>`bool_or(${experimentEvents.simulated})`,
      })
      .from(experimentEvents)
      .where(eq(experimentEvents.experimentId, experiment.id))
      .groupBy(experimentEvents.armId, experimentEvents.type, experimentEvents.goalId);

    const visitorsOf = (armId: string) =>
      counts.find((c) => c.armId === armId && c.type === 'exposure')?.count ?? 0;
    const conversionsOf = (armId: string, goalId: string) =>
      counts.find((c) => c.armId === armId && c.type === 'conversion' && c.goalId === goalId)
        ?.count ?? 0;

    const statsFor = (goalId: string | null): { arms: ArmResult[]; counts: ArmCounts[] } => {
      const armCounts = experiment.arms.map((arm) => ({
        id: arm.id,
        isControl: arm.isControl,
        visitors: visitorsOf(arm.id),
        conversions: goalId ? conversionsOf(arm.id, goalId) : 0,
      }));
      // Seeded by experiment and goal: the same data always gives the same probabilities.
      const stats = analyze(armCounts, seedFrom(`${experiment.id}:${goalId ?? 'none'}`));
      return {
        counts: armCounts,
        arms: stats.map((s, i) => ({
          armId: s.id,
          name: experiment.arms[i]!.name,
          isControl: experiment.arms[i]!.isControl,
          visitors: s.visitors,
          conversions: s.conversions,
          rate: s.rate,
          rateInterval: s.rateInterval,
          uplift: s.uplift,
          upliftInterval: s.upliftInterval,
          probBeatControl: s.probBeatControl,
          probBest: s.probBest,
        })),
      };
    };

    const main = statsFor(primary?.id ?? null);
    const decision = primary
      ? verdict(
          main.counts,
          main.arms.map((a) => ({ ...a, id: a.armId })),
        )
      : ({ status: 'collecting', minVisitors: 0 } as const);

    return {
      status: experiment.status,
      startedAt: experiment.startedAt?.toISOString() ?? null,
      endedAt: experiment.endedAt?.toISOString() ?? null,
      winnerArmId: experiment.winnerArmId,
      primaryGoal: primary ? { id: primary.id, name: primary.name } : null,
      arms: main.arms,
      verdict: decision,
      secondary: goalRows
        .filter((g) => !g.isPrimary)
        .map((g) => ({ goalId: g.id, name: g.name, arms: statsFor(g.id).arms })),
      series: await this.series(experiment, primary?.id ?? null),
      simulated: counts.some((c) => c.simulated),
    };
  }

  /**
   * Demo traffic: realistic, reproducible events so the results page can be shown without a live
   * site. Each arm gets a "true" conversion rate (better variants tend to do better), then daily
   * visitors and conversions are drawn from it. Seeded by experiment, so it never changes.
   */
  async simulate(
    userId: string,
    projectId: string,
    input: z.output<typeof simulateTrafficSchema> & SimulateTrafficInput,
  ) {
    await this.projectAccess.load(userId, projectId, 'editor');
    const experiment = await this.load(projectId);
    if (experiment.status !== 'running' && experiment.status !== 'paused') {
      throw new BadRequestException('Launch the experiment before simulating traffic');
    }
    await this.generateTraffic(experiment, input);
    return this.results(userId, projectId);
  }

  /**
   * Replaces the experiment's simulated events with freshly generated ones. No access checks:
   * callers (the endpoint above, the demo seed) are responsible for that.
   */
  async generateTraffic(
    experiment: ExperimentRow,
    input: { days: number; visitorsPerDay: number },
    /** Fixed seed, so every demo account tells the same story; defaults to the experiment. */
    seedKey = experiment.id,
  ) {
    const goalRows = await this.db
      .select()
      .from(goals)
      .where(eq(goals.projectId, experiment.projectId));
    const primary = goalRows.find((g) => g.isPrimary);
    if (!primary) throw new BadRequestException('A primary goal is needed');

    const rand = seededRandom(seedFrom(`${seedKey}:simulation`));
    const baseRate = 0.03 + rand() * 0.04; // control converts at 3-7%
    const quality = await this.armQuality(experiment);
    const armRates = experiment.arms.map((arm) => {
      if (arm.isControl) return baseRate;
      // Better-rated copy tends to win, but not always: a real test can surprise.
      const lift = ((quality.get(arm.id) ?? 0.5) - 0.6) * 1.2 + (rand() - 0.5) * 0.1;
      return Math.max(0.005, baseRate * (1 + lift));
    });
    const totalWeight = experiment.arms.reduce((s, a) => s + a.weight, 0) || 1;
    const secondaryRates = goalRows
      .filter((g) => !g.isPrimary)
      .map((g) => ({ id: g.id, factor: 0.8 + rand() * 1.6 }));

    const start = Date.now() - input.days * DAY_MS;
    const rows: (typeof experimentEvents.$inferInsert)[] = [];
    for (let day = 0; day < input.days; day++) {
      // Traffic varies by day (weekends, campaigns).
      const dailyVisitors = Math.round(input.visitorsPerDay * (0.7 + rand() * 0.6));
      for (let v = 0; v < dailyVisitors; v++) {
        let point = rand() * totalWeight;
        const armIndex = Math.max(
          0,
          experiment.arms.findIndex((a) => (point -= a.weight) < 0),
        );
        const arm = experiment.arms[armIndex]!;
        const visitorId = `sim_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
        const at = new Date(start + day * DAY_MS + rand() * DAY_MS);
        const base = { experimentId: experiment.id, armId: arm.id, visitorId, simulated: true };
        rows.push({ ...base, type: 'exposure', goalId: '', createdAt: at });
        const armRate = armRates[armIndex]!;
        if (rand() < armRate) {
          rows.push({
            ...base,
            type: 'conversion',
            goalId: primary.id,
            createdAt: new Date(at.getTime() + rand() * 600_000),
          });
        }
        for (const secondary of secondaryRates) {
          if (rand() < Math.min(0.9, armRate * secondary.factor)) {
            rows.push({
              ...base,
              type: 'conversion',
              goalId: secondary.id,
              createdAt: new Date(at.getTime() + rand() * 600_000),
            });
          }
        }
      }
    }

    await this.db.transaction(async (tx) => {
      await tx
        .delete(experimentEvents)
        .where(
          and(
            eq(experimentEvents.experimentId, experiment.id),
            eq(experimentEvents.simulated, true),
          ),
        );
      for (let i = 0; i < rows.length; i += 2000) {
        await tx
          .insert(experimentEvents)
          .values(rows.slice(i, i + 2000))
          .onConflictDoNothing();
      }
      // Keep the timeline coherent: the experiment "started" when the simulated traffic did.
      if (!experiment.startedAt || experiment.startedAt.getTime() > start) {
        await tx
          .update(experiments)
          .set({ startedAt: new Date(start) })
          .where(eq(experiments.id, experiment.id));
      }
    });
  }

  async clearSimulation(userId: string, projectId: string) {
    await this.projectAccess.load(userId, projectId, 'editor');
    const experiment = await this.load(projectId);
    await this.db
      .delete(experimentEvents)
      .where(
        and(eq(experimentEvents.experimentId, experiment.id), eq(experimentEvents.simulated, true)),
      );
  }

  /** Cumulative per-day totals per arm for the primary goal. */
  private async series(experiment: ExperimentRow, primaryGoalId: string | null) {
    const rows = await this.db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${experimentEvents.createdAt}), 'YYYY-MM-DD')`,
        armId: experimentEvents.armId,
        type: experimentEvents.type,
        count: sql<number>`count(*)::int`,
      })
      .from(experimentEvents)
      .where(
        and(
          eq(experimentEvents.experimentId, experiment.id),
          sql`(${experimentEvents.type} = 'exposure' or ${experimentEvents.goalId} = ${primaryGoalId ?? ''})`,
        ),
      )
      .groupBy(sql`1`, experimentEvents.armId, experimentEvents.type)
      .orderBy(sql`1`);

    const days = [...new Set(rows.map((r) => r.day))];
    const running = new Map(experiment.arms.map((a) => [a.id, { visitors: 0, conversions: 0 }]));
    return days.map((date) => {
      for (const row of rows.filter((r) => r.day === date)) {
        const totals = running.get(row.armId);
        if (!totals) continue;
        if (row.type === 'exposure') totals.visitors += row.count;
        else totals.conversions += row.count;
      }
      return { date, arms: Object.fromEntries([...running].map(([id, t]) => [id, { ...t }])) };
    });
  }

  /** Average quality (0-1) of the variants each arm uses; drives the simulated effect sizes. */
  private async armQuality(experiment: ExperimentRow) {
    const ids = experiment.arms.flatMap((a) => a.changes.map((c) => c.variantId));
    const rows = ids.length
      ? await this.db
          .select({
            id: variants.id,
            quality: variants.qualityScore,
            compliance: variants.complianceScore,
          })
          .from(variants)
          .where(sql`${variants.id} in ${ids}`)
      : [];
    const scoreOf = new Map(
      rows.map((r) => [r.id, ((r.quality ?? 60) / 100) * (r.compliance / 100)]),
    );
    return new Map(
      experiment.arms.map((arm) => {
        const scores = arm.changes.map((c) => scoreOf.get(c.variantId) ?? 0.5);
        return [arm.id, scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0.5];
      }),
    );
  }

  private async load(projectId: string) {
    const [row] = await this.db
      .select()
      .from(experiments)
      .where(eq(experiments.projectId, projectId));
    if (!row) throw new NotFoundException();
    return row;
  }
}
