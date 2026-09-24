import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import type { GenerationRun, generateVariantsSchema } from '@uplift/shared';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { COPY_PROVIDER, CopyGenerationError, type CopyProvider } from '../ai/copy-provider.js';
import { normalizeBrief } from '../briefs/briefs.service.js';
import type { Db } from '../db/client.js';
import { InjectDb } from '../db/db.module.js';
import { generationRuns, pageElements, projectBriefs, projects, variants } from '../db/schema.js';
import { ProjectAccessService } from '../projects/project-access.service.js';
import { checkRules, qualityScore } from './rules-check.js';

type RunRow = typeof generationRuns.$inferSelect;
type GenerateInput = z.output<typeof generateVariantsSchema>;

export const toRunDto = (row: RunRow): GenerationRun => ({
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

/** Elements generated in parallel within one run: fast enough, without bursting the rate limit. */
const ELEMENT_CONCURRENCY = 2;

/**
 * Generates variants as a background run: the request returns at once and the UI polls the run,
 * showing variants as each element finishes. Runs run in-process; a queue (e.g. BullMQ) can
 * replace `execute` without changing the API.
 */
@Injectable()
export class GenerationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    @InjectDb() private readonly db: Db,
    private readonly projectAccess: ProjectAccessService,
    @Inject(COPY_PROVIDER) private readonly provider: CopyProvider,
  ) {}

  /** In-process runs die with the server; mark any left unfinished so projects aren't stuck. */
  async onApplicationBootstrap() {
    const stale = await this.db
      .update(generationRuns)
      .set({ status: 'failed', error: 'Interrupted by a server restart', finishedAt: new Date() })
      .where(inArray(generationRuns.status, ['queued', 'running']))
      .returning({ id: generationRuns.id });
    if (stale.length)
      this.logger.warn(`Marked ${stale.length} interrupted generation run(s) as failed`);
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

    // One run per project at a time; the partial check-then-insert is fine at this scale.
    const [active] = await this.db
      .select({ id: generationRuns.id })
      .from(generationRuns)
      .where(
        and(
          eq(generationRuns.projectId, projectId),
          inArray(generationRuns.status, ['queued', 'running']),
        ),
      );
    if (active) throw new ConflictException('A generation is already running for this project');

    const [run] = await this.db
      .insert(generationRuns)
      .values({
        projectId,
        provider: this.provider.name,
        totalElements: elements.length,
        createdBy: userId,
      })
      .returning();

    void this.execute(run!, project, elements, input, userId);
    return toRunDto(run!);
  }

  async latest(userId: string, projectId: string) {
    await this.projectAccess.load(userId, projectId, 'viewer');
    const [run] = await this.db
      .select()
      .from(generationRuns)
      .where(eq(generationRuns.projectId, projectId))
      .orderBy(desc(generationRuns.createdAt))
      .limit(1);
    if (!run) throw new NotFoundException();
    return toRunDto(run);
  }

  private async execute(
    run: RunRow,
    project: typeof projects.$inferSelect,
    elements: (typeof pageElements.$inferSelect)[],
    input: GenerateInput,
    userId: string,
  ) {
    try {
      await this.db
        .update(generationRuns)
        .set({ status: 'running' })
        .where(eq(generationRuns.id, run.id));

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
            await this.generateForElement(run, project, element, brief, input, userId);
            await this.db
              .update(generationRuns)
              .set({ completedElements: sql`${generationRuns.completedElements} + 1` })
              .where(eq(generationRuns.id, run.id));
          } catch (err) {
            lastError = err instanceof CopyGenerationError ? err.message : 'Generation failed';
            this.logger.error(`Element ${element.id} failed: ${err}`);
            await this.db
              .update(generationRuns)
              .set({ failedElements: sql`${generationRuns.failedElements} + 1` })
              .where(eq(generationRuns.id, run.id));
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(ELEMENT_CONCURRENCY, elements.length) }, worker),
      );

      const [final] = await this.db
        .select()
        .from(generationRuns)
        .where(eq(generationRuns.id, run.id));
      const succeeded = (final?.completedElements ?? 0) > 0;
      await this.db
        .update(generationRuns)
        .set({
          status: succeeded ? 'succeeded' : 'failed',
          error: final?.failedElements ? lastError : null,
          finishedAt: new Date(),
        })
        .where(eq(generationRuns.id, run.id));
      await this.db
        .update(projects)
        .set({ updatedAt: sql`now()` })
        .where(eq(projects.id, project.id));
    } catch (err) {
      this.logger.error(`Generation run ${run.id} crashed: ${err}`);
      await this.db
        .update(generationRuns)
        .set({ status: 'failed', error: 'Generation failed', finishedAt: new Date() })
        .where(eq(generationRuns.id, run.id))
        .catch(() => {});
    }
  }

  private async generateForElement(
    run: RunRow,
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
        const { issues, score } = checkRules(v.text, element, brief);
        return {
          elementId: element.id,
          runId: run.id,
          text: v.text,
          approach: v.approach,
          rationale: v.rationale,
          rulesScore: score,
          qualityScore: qualityScore(v),
          issues,
          source: 'ai' as const,
          createdBy: userId,
        };
      }),
    );
    await this.db
      .update(generationRuns)
      .set({
        model: result.model,
        inputTokens: sql`${generationRuns.inputTokens} + ${result.usage.inputTokens}`,
        outputTokens: sql`${generationRuns.outputTokens} + ${result.usage.outputTokens}`,
      })
      .where(eq(generationRuns.id, run.id));
  }
}
