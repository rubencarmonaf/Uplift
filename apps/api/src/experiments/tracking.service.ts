import { Injectable } from '@nestjs/common';
import { type TrackEvent, trackEventSchema } from '@uplift/shared';
import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { InjectDb } from '../db/db.module.js';
import { experimentEvents, experiments, goals } from '../db/schema.js';

const CACHE_TTL_MS = 10_000;
type CachedExperiment = { id: string; status: string; armIds: Set<string>; goalIds: Set<string> };

/**
 * Ingests exposures and conversions from the production script. Anything invalid is dropped
 * silently: the endpoint is public, so it should not help anyone probe what is valid.
 */
@Injectable()
export class TrackingService {
  private readonly cache = new Map<string, { at: number; value: CachedExperiment | null }>();

  constructor(@InjectDb() private readonly db: Db) {}

  /** Parses the raw beacon body; returns whether the event was stored. */
  async ingest(publicKey: string, rawBody: unknown) {
    let data: unknown = rawBody;
    if (typeof rawBody === 'string') {
      try {
        data = JSON.parse(rawBody);
      } catch {
        return false;
      }
    }
    const parsed = trackEventSchema.safeParse(data);
    if (!parsed.success) return false;
    return this.record(publicKey, parsed.data);
  }

  private async record(publicKey: string, event: TrackEvent) {
    const experiment = await this.lookup(publicKey);
    if (!experiment || experiment.status !== 'running' || !experiment.armIds.has(event.armId)) {
      return false;
    }

    if (event.type === 'conversion') {
      if (!event.goalId || !experiment.goalIds.has(event.goalId)) return false;
      // Only visitors exposed to this arm can convert on it.
      const [exposure] = await this.db
        .select({ id: experimentEvents.id })
        .from(experimentEvents)
        .where(
          and(
            eq(experimentEvents.experimentId, experiment.id),
            eq(experimentEvents.visitorId, event.visitorId),
            eq(experimentEvents.type, 'exposure'),
            eq(experimentEvents.armId, event.armId),
          ),
        );
      if (!exposure) return false;
    }

    const inserted = await this.db
      .insert(experimentEvents)
      .values({
        experimentId: experiment.id,
        armId: event.armId,
        visitorId: event.visitorId,
        type: event.type,
        goalId: event.type === 'conversion' ? event.goalId! : '',
      })
      .onConflictDoNothing()
      .returning({ id: experimentEvents.id });
    return inserted.length > 0;
  }

  /** Short cache: beacons arrive in bursts and experiments change rarely. */
  private async lookup(publicKey: string) {
    const hit = this.cache.get(publicKey);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

    const [row] = await this.db
      .select()
      .from(experiments)
      .where(eq(experiments.publicKey, publicKey));
    let value: CachedExperiment | null = null;
    if (row) {
      const goalRows = await this.db
        .select({ id: goals.id })
        .from(goals)
        .where(eq(goals.projectId, row.projectId));
      value = {
        id: row.id,
        status: row.status,
        armIds: new Set(row.arms.map((a) => a.id)),
        goalIds: new Set(goalRows.map((g) => g.id)),
      };
    }
    this.cache.set(publicKey, { at: Date.now(), value });
    if (this.cache.size > 1000) this.cache.delete(this.cache.keys().next().value!);
    return value;
  }
}
