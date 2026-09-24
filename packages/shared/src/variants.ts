import { z } from 'zod';
import { type ElementType, elementTypeSchema } from './elements.js';

export const VARIANT_STATUSES = ['active', 'discarded'] as const;
export const VARIANT_SOURCES = ['ai', 'manual'] as const;

/** Persuasion angles the AI picks from; shown as a label on each variant. */
export const VARIANT_ANGLES = [
  'clarity',
  'benefit',
  'social_proof',
  'urgency',
  'risk_reversal',
  'curiosity',
  'specificity',
  'objection_handling',
  'emotional',
] as const;
export type VariantAngle = (typeof VARIANT_ANGLES)[number];

/** A rule a variant breaks, found by the deterministic checks run on every variant. */
export const complianceIssueSchema = z.object({
  rule: z.enum(['banned_word', 'too_long', 'too_short', 'forbidden_claim', 'unchanged']),
  detail: z.string(),
});
export type ComplianceIssue = z.infer<typeof complianceIssueSchema>;

export const variantSchema = z.object({
  id: z.uuid(),
  elementId: z.uuid(),
  text: z.string(),
  angle: z.enum(VARIANT_ANGLES).nullable(),
  rationale: z.string(),
  /** 0-100. 100 means no rule is broken. */
  complianceScore: z.number(),
  /** 0-100, the model's own assessment of clarity, relevance and persuasiveness. Null for manual variants. */
  qualityScore: z.number().nullable(),
  issues: z.array(complianceIssueSchema),
  status: z.enum(VARIANT_STATUSES),
  source: z.enum(VARIANT_SOURCES),
  /** In the organization's library. */
  saved: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type Variant = z.infer<typeof variantSchema>;

export const createVariantSchema = z.object({
  text: z.string().trim().min(1).max(5000),
});
export type CreateVariantInput = z.infer<typeof createVariantSchema>;

export const updateVariantSchema = z
  .object({
    text: z.string().trim().min(1).max(5000),
    status: z.enum(VARIANT_STATUSES),
    saved: z.boolean(),
  })
  .partial();
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

export const MAX_VARIANTS_PER_REQUEST = 6;

export const generateVariantsSchema = z.object({
  /** Elements to generate for; all of the project's elements when omitted. */
  elementIds: z.array(z.uuid()).min(1).max(50).optional(),
  count: z.number().int().min(1).max(MAX_VARIANTS_PER_REQUEST).default(3),
  /** Extra direction for this run only, e.g. "shorter and more direct". */
  instructions: z.string().trim().max(500).default(''),
  /** UI language, for the explanations shown next to each variant. */
  language: z.enum(['es', 'en']).default('en'),
});
export type GenerateVariantsInput = z.input<typeof generateVariantsSchema>;

export const GENERATION_STATUSES = ['queued', 'running', 'succeeded', 'failed'] as const;

export const generationJobSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  status: z.enum(GENERATION_STATUSES),
  provider: z.enum(['anthropic', 'mock']),
  totalElements: z.number(),
  completedElements: z.number(),
  failedElements: z.number(),
  error: z.string().nullable(),
  createdAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
});
export type GenerationJob = z.infer<typeof generationJobSchema>;

export const LIBRARY_SOURCES = ['winner', 'saved'] as const;

/** A proven or bookmarked piece of copy, reusable across the organization's projects. */
export type LibraryItem = {
  variantId: string;
  text: string;
  angle: VariantAngle | null;
  elementType: ElementType;
  elementName: string;
  originalText: string;
  project: { id: string; name: string };
  source: (typeof LIBRARY_SOURCES)[number];
  /** Winners only: measured relative uplift over control and its probability. */
  uplift: number | null;
  probBeatControl: number | null;
  qualityScore: number | null;
  /** When it won or was saved. */
  date: string;
};

export const libraryQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  type: elementTypeSchema.optional(),
  source: z.enum(LIBRARY_SOURCES).optional(),
});
export type LibraryQuery = z.input<typeof libraryQuerySchema>;
