import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import type { Arm } from '@uplift/shared';
import { and, eq, lt } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { InjectDb } from '../db/db.module.js';
import {
  experiments,
  goals,
  memberships,
  organizations,
  pageElements,
  pageSnapshots,
  projectBriefs,
  projects,
  users,
  variants,
} from '../db/schema.js';
import { ResultsService } from '../results/results.service.js';
import { checkCompliance } from '../variants/compliance.js';
import {
  DEMO_ARMS,
  DEMO_BRIEF,
  DEMO_ELEMENTS,
  DEMO_GOALS,
  DEMO_SITE,
  SECONDARY_PROJECTS,
} from './demo-content.js';

const DEMO_LIFETIME_MS = 24 * 60 * 60 * 1000;
const DEMO_TRAFFIC = { days: 28, visitorsPerDay: 450 };
/** Fixed so every demo account shows the same, clear result. */
const DEMO_TRAFFIC_SEED = 'casaclara-demo-9';
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const DEMO_HTML = readFileSync(new URL('./assets/casaclara.html', import.meta.url), 'utf8');

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * "Try the demo": a fresh, throwaway account per visitor with a complete example project,
 * so nobody sees anyone else's changes. Demo accounts are deleted after a day.
 */
@Injectable()
export class DemoService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(DemoService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectDb() private readonly db: Db,
    private readonly results: ResultsService,
  ) {}

  onApplicationBootstrap() {
    void this.cleanup();
    this.timer = setInterval(() => void this.cleanup(), CLEANUP_INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  async createAccount(language: 'es' | 'en') {
    const suffix = randomBytes(6).toString('hex');
    // Demo accounts never log in with a password; this one is random and never shown.
    const passwordHash = await hash(randomBytes(32).toString('base64url'));

    const { user, experimentId } = await this.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          name: language === 'es' ? 'Invitado' : 'Guest',
          email: `demo-${suffix}@demo.uplift.invalid`,
          passwordHash,
          locale: language,
          isDemo: true,
        })
        .returning();
      const [org] = await tx
        .insert(organizations)
        .values({ name: 'Casaclara Seguros', isDemo: true })
        .returning();
      await tx
        .insert(memberships)
        .values({ userId: user!.id, organizationId: org!.id, role: 'admin' });

      await this.seedSecondaryProjects(tx, org!.id, user!.id);
      const experimentId = await this.seedMainProject(tx, org!.id, user!.id);
      return { user: user!, experimentId };
    });

    // Three weeks of simulated traffic so the results page has something to show.
    const [experiment] = await this.db
      .select()
      .from(experiments)
      .where(eq(experiments.id, experimentId));
    await this.results.generateTraffic(experiment!, DEMO_TRAFFIC, DEMO_TRAFFIC_SEED);
    return user;
  }

  /** Deletes demo organizations (and, by cascade, their projects) and users older than a day. */
  async cleanup() {
    const cutoff = new Date(Date.now() - DEMO_LIFETIME_MS);
    try {
      const orgs = await this.db
        .delete(organizations)
        .where(and(eq(organizations.isDemo, true), lt(organizations.createdAt, cutoff)))
        .returning({ id: organizations.id });
      const people = await this.db
        .delete(users)
        .where(and(eq(users.isDemo, true), lt(users.createdAt, cutoff)))
        .returning({ id: users.id });
      if (orgs.length || people.length) {
        this.logger.log(
          `Removed ${orgs.length} demo organization(s) and ${people.length} demo user(s)`,
        );
      }
    } catch (err) {
      this.logger.error(`Demo cleanup failed: ${err}`);
    }
  }

  private async seedMainProject(tx: Tx, organizationId: string, userId: string) {
    const [project] = await tx
      .insert(projects)
      .values({
        organizationId,
        name: 'Seguro de hogar · Landing principal',
        url: DEMO_SITE,
        industry: 'insurance',
        pageType: 'landing',
        locale: 'es-ES',
        status: 'running',
        createdBy: userId,
      })
      .returning();
    const projectId = project!.id;

    await tx.insert(projectBriefs).values({ projectId, data: DEMO_BRIEF, updatedBy: userId });
    await tx.insert(pageSnapshots).values({
      projectId,
      url: DEMO_SITE,
      finalUrl: DEMO_SITE,
      title: 'Casaclara Seguros · Seguro de hogar',
      html: DEMO_HTML,
    });

    // Elements and their variants, scored by the same compliance checks as real ones.
    const variantIds = new Map<string, string[]>();
    const elementIds = new Map<string, string>();
    for (const [position, element] of DEMO_ELEMENTS.entries()) {
      const [row] = await tx
        .insert(pageElements)
        .values({
          projectId,
          name: element.name,
          type: element.type,
          selector: element.selector,
          originalText: element.originalText,
          maxLength: element.maxLength,
          notes: element.notes ?? '',
          position,
        })
        .returning();
      elementIds.set(element.key, row!.id);
      const inserted = await tx
        .insert(variants)
        .values(
          element.variants.map((v) => {
            const { issues, score } = checkCompliance(v.text, row!, DEMO_BRIEF);
            return {
              elementId: row!.id,
              text: v.text,
              angle: v.angle,
              rationale: v.rationale,
              qualityScore: v.quality,
              complianceScore: score,
              issues,
              source: 'ai' as const,
              createdBy: userId,
            };
          }),
        )
        .returning({ id: variants.id });
      variantIds.set(
        element.key,
        inserted.map((v) => v.id),
      );
    }

    await tx.insert(goals).values(DEMO_GOALS.map((g) => ({ projectId, ...g })));

    const arms: Arm[] = [
      { id: randomUUID(), name: 'Control', weight: 34, isControl: true, changes: [] },
      ...DEMO_ARMS.map((arm) => ({
        id: randomUUID(),
        name: arm.name,
        weight: arm.weight,
        isControl: false,
        changes: Object.entries(arm.changes).map(([key, index]) => ({
          elementId: elementIds.get(key)!,
          variantId: variantIds.get(key)![index]!,
        })),
      })),
    ];
    const [experiment] = await tx
      .insert(experiments)
      .values({
        projectId,
        publicKey: `pk_${randomBytes(12).toString('base64url')}`,
        status: 'running',
        startedAt: new Date(),
        scope: {
          domains: ['www.casaclara-seguros.example', 'casaclara-seguros.example'],
          path: { match: 'exact', value: '/' },
        },
        arms,
      })
      .returning({ id: experiments.id });
    return experiment!.id;
  }

  private async seedSecondaryProjects(tx: Tx, organizationId: string, userId: string) {
    for (const spec of SECONDARY_PROJECTS) {
      const touched = new Date(Date.now() - spec.ageDays * 24 * 60 * 60 * 1000);
      const [project] = await tx
        .insert(projects)
        .values({
          organizationId,
          name: spec.name,
          url: spec.url,
          industry: spec.industry,
          pageType: spec.pageType,
          locale: 'es-ES',
          status: spec.status,
          archivedAt: spec.archived ? touched : null,
          createdBy: userId,
          createdAt: touched,
          updatedAt: touched,
        })
        .returning();
      for (const [position, element] of spec.elements.entries()) {
        const [row] = await tx
          .insert(pageElements)
          .values({
            projectId: project!.id,
            name: element.name,
            type: element.type,
            selector: element.selector,
            originalText: element.originalText,
            position,
          })
          .returning();
        await tx.insert(variants).values(
          element.variants.map((text, i) => ({
            elementId: row!.id,
            text,
            rationale: '',
            qualityScore: 70 + i * 6,
            complianceScore: 100,
            source: 'ai' as const,
            createdBy: userId,
          })),
        );
      }
    }
  }
}
