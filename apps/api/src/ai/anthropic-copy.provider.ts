import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { Logger } from '@nestjs/common';
import { VARIANT_ANGLES } from '@uplift/shared';
import { z } from 'zod';
import {
  type CopyProvider,
  type CopyRequest,
  type CopyResult,
  CopyGenerationError,
} from './copy-provider.js';
import { buildUserContent, SYSTEM_PROMPT } from './prompt.js';

// Kept to types structured outputs supports; ranges and lengths are checked after parsing.
const outputSchema = z.object({
  variants: z.array(
    z.object({
      text: z.string(),
      angle: z.enum(VARIANT_ANGLES),
      rationale: z.string(),
      clarity: z.number(),
      relevance: z.number(),
      persuasion: z.number(),
    }),
  ),
});

const clampScore = (n: number) => Math.min(5, Math.max(1, Math.round(n)));

export type AnthropicProviderOptions = {
  model: string;
  effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
};

export class AnthropicCopyProvider implements CopyProvider {
  readonly name = 'anthropic' as const;
  private readonly logger = new Logger(AnthropicCopyProvider.name);
  // Reads ANTHROPIC_API_KEY (or another configured credential) from the environment.
  private readonly client = new Anthropic({ maxRetries: 3 });

  constructor(private readonly options: AnthropicProviderOptions) {}

  async generate(request: CopyRequest): Promise<CopyResult> {
    const { projectBlock, elementBlock } = buildUserContent(request);

    const response = await this.client.beta.messages.parse({
      model: this.options.model,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: this.options.effort,
        format: betaZodOutputFormat(outputSchema),
      },
      // If a safety classifier declines a (most likely benign) marketing request, the API retries
      // it on Anthropic's recommended fallback model instead of failing the element.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            // Same for every element of a project: cached when long enough to qualify.
            { type: 'text', text: projectBlock, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: elementBlock },
          ],
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      this.logger.warn(`Generation refused (${response.stop_details?.category ?? 'no category'})`);
      throw new CopyGenerationError('The model declined to write this copy');
    }
    if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
      throw new CopyGenerationError('The model returned an incomplete answer');
    }

    const variants = response.parsed_output.variants
      .map((v) => ({
        ...v,
        text: v.text.trim().replace(/^["“«]|["”»]$/g, ''),
        rationale: v.rationale.trim(),
        clarity: clampScore(v.clarity),
        relevance: clampScore(v.relevance),
        persuasion: clampScore(v.persuasion),
      }))
      .filter((v) => v.text.length > 0)
      .slice(0, request.count);

    return {
      variants,
      model: response.model,
      usage: {
        inputTokens:
          response.usage.input_tokens +
          (response.usage.cache_read_input_tokens ?? 0) +
          (response.usage.cache_creation_input_tokens ?? 0),
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
