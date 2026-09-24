import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import type { GenerationJob, generateVariantsSchema } from '@uplift/shared';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { COPY_PROVIDER, CopyGenerationError, type CopyProvider } from '../ai/copy-provider.js';
import { normalizeBrief } from '../briefs/briefs.service.js';
import type { Db } from '../db/client.js';
import { InjectDb } from '../db/db.module.js';
import { generationJobs, pageElements, projectBriefs, projects, variants } from '../db/schema.js';
import { ProjectAccessService } from '../projects/project-access.service.js';
import { checkCompliance, qualityScore } from './compliance.js';

type JobRow = typeof generationJobs.$inferSelect;
type GenerateInput = z.output<typeof generateVariantsSchema>;

export const toJobDto = (row: JobRow): GenerationJob => ({
  id: row.id,
  projectId: row.projectId,
  status: row.status,
  provider: row.provider,
  totalElements: row.totalElements,
  completedElements: row.completedElements,
  failedElements: row.failedElements,
  error: row.error,
  createdAt: row.createdAt.toISOString(),
  finishedAt: row.finishedAt?.toISOString() ?? null,
});

/** Elements generated in parallel within one job: fast enough, without bursting the rate limit. */
const ELEMENT_CONCURRENCY = 2;

/**
 * Generates variants as a background job: the request returns at once and the UI polls the job,
 * showing variants as each element finishes. Jobs run in-process; a queue (e.g. BullMQ) can
 * replace `run` without changing the API.
 */
@Injectable()
export class GenerationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    @InjectDb() private readonly db: Db,
    private readonly projectAccess: ProjectAccessService,
    @Inject(COPY_PROVIDER) private readonly provider: CopyProvider,
  ) {}

  /** In-process jobs die with the server; mark any left unfinished so projects aren't stuck. */
  async onApplicationBootstrap() {
    const stale = await this.db
      .update(generationJobs)
      .set({ status: 'failed', error: 'Interrupted by a server restart', finishedAt: new Date() })
      .where(inArray(generationJobs.status, ['queued', 'running']))
      .returning({ id: generationJobs.id });
    if (stale.length)
      this.logger.warn(`Marked ${stale.length} interrupted generation job(s) as failed`);
  }

  async start(userId: string, projectId: string, input: GenerateInput) {
    const { project } = await this.projectAccess.load(userId, projectId, 'editor');

    const elements = await this.db
      .select()
      .from(pageElements)
      .where(
        input.elementIds
          ? and(eq(pageElements.projectId, projectId), inArray(pageElements.id, input.elementIds))
          : eq(pageElements.projectId, projectId),
      )
      .orderBy(asc(pageElements.position));
    if (elements.length === 0) throw new BadRequestException('No elements to generate for');
    if (input.elementIds && elements.length !== new Set(input.elementIds).size) {
      throw new NotFoundException('Some elements do not belong to this project');
    }

    // One job per project at a time; the partial check-then-insert is fine at this scale.
    const [active] = await this.db
      .select({ id: generationJobs.id })
      .from(generationJobs)
      .where(
        and(
          eq(generationJobs.projectId, projectId),
          inArray(generationJobs.status, ['queued', 'running']),
        ),
      );
    if (active) throw new ConflictException('A generation is already running for this project');

    const [job] = await this.db
      .insert(generationJobs)
      .values({
        projectId,
        provider: this.provider.name,
        totalElements: elements.length,
        createdBy: userId,
      })
      .returning();

    void this.run(job!, project, elements, input, userId);
    return toJobDto(job!);
  }

  async latest(userId: string, projectId: string) {
    await this.projectAccess.load(userId, projectId, 'viewer');
    const [job] = await this.db
      .select()
      .from(generationJobs)
      .where(eq(generationJobs.projectId, projectId))
      .orderBy(desc(generationJobs.createdAt))
      .limit(1);
    if (!job) throw new NotFoundException();
    return toJobDto(job);
  }

  private async run(
    job: JobRow,
    project: typeof projects.$inferSelect,
    elements: (typeof pageElements.$inferSelect)[],
    input: GenerateInput,
    userId: string,
  ) {
    try {
      await this.db
        .update(generationJobs)
        .set({ status: 'running' })
        .where(eq(generationJobs.id, job.id));

      const [briefRow] = await this.db
        .select({ data: projectBriefs.data })
        .from(projectBriefs)
        .where(eq(projectBriefs.projectId, project.id));
      const brief = normalizeBrief(briefRow?.data);

      const queue = [...elements];
      let lastError: string | null = null;
      const worker = async () => {
        for (let element = queue.shift(); element; element = queue.shift()) {
          try {
            await this.generateForElement(job, project, element, brief, input, userId);
            await this.db
              .update(generationJobs)
              .set({ completedElements: sql`${generationJobs.completedElements} + 1` })
              .where(eq(generationJobs.id, job.id));
          } catch (err) {
            lastError = err instanceof CopyGenerationError ? err.message : 'Generation failed';
            this.logger.error(`Element ${element.id} failed: ${err}`);
            await this.db
              .update(generationJobs)
              .set({ failedElements: sql`${generationJobs.failedElements} + 1` })
              .where(eq(generationJobs.id, job.id));
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(ELEMENT_CONCURRENCY, elements.length) }, worker),
      );

      const [final] = await this.db
        .select()
        .from(generationJobs)
        .where(eq(generationJobs.id, job.id));
      const succeeded = (final?.completedElements ?? 0) > 0;
      await this.db
        .update(generationJobs)
        .set({
          status: succeeded ? 'succeeded' : 'failed',
          error: final?.failedElements ? lastError : null,
          finishedAt: new Date(),
        })
        .where(eq(generationJobs.id, job.id));
      await this.db
        .update(projects)
        .set({ updatedAt: sql`now()` })
        .where(eq(projects.id, project.id));
    } catch (err) {
      this.logger.error(`Generation job ${job.id} crashed: ${err}`);
      await this.db
        .update(generationJobs)
        .set({ status: 'failed', error: 'Generation failed', finishedAt: new Date() })
        .where(eq(generationJobs.id, job.id))
        .catch(() => {});
    }
  }

  private async generateForElement(
    job: JobRow,
    project: typeof projects.$inferSelect,
    element: typeof pageElements.$inferSelect,
    brief: ReturnType<typeof normalizeBrief>,
    input: GenerateInput,
    userId: string,
  ) {
    const existing = await this.db
      .select({ text: variants.text })
      .from(variants)
      .where(and(eq(variants.elementId, element.id), eq(variants.status, 'active')));

    const result = await this.provider.generate({
      project: {
        name: project.name,
        url: project.url,
        industry: project.industry,
        pageType: project.pageType,
        locale: project.locale,
      },
      brief,
      element,
      existingTexts: existing.map((e) => e.text),
      count: input.count,
      instructions: input.instructions,
      rationaleLanguage: input.language,
    });
    if (result.variants.length === 0) throw new CopyGenerationError('No usable variants returned');

    await this.db.insert(variants).values(
      result.variants.map((v) => {
        const { issues, score } = checkCompliance(v.text, element, brief);
        return {
          elementId: element.id,
          jobId: job.id,
          text: v.text,
          angle: v.angle,
          rationale: v.rationale,
          complianceScore: score,
          qualityScore: qualityScore(v),
          issues,
          source: 'ai' as const,
          createdBy: userId,
        };
      }),
    );
    await this.db
      .update(generationJobs)
      .set({
        model: result.model,
        inputTokens: sql`${generationJobs.inputTokens} + ${result.usage.inputTokens}`,
        outputTokens: sql`${generationJobs.outputTokens} + ${result.usage.outputTokens}`,
      })
      .where(eq(generationJobs.id, job.id));
  }
}
