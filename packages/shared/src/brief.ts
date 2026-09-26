import { z } from 'zod';

export const TONES = [
  'friendly',
  'professional',
  'bold',
  'playful',
  'reassuring',
  'premium',
  'technical',
  'inspiring',
] as const;
export const FORMALITIES = ['formal', 'neutral', 'informal'] as const;
export const READING_LEVELS = ['simple', 'standard', 'advanced'] as const;
/** Where the visitor is in their purchase. */
export const BUYER_STAGES = ['exploring', 'comparing', 'deciding', 'customer'] as const;
/** How carefully claims must be worded in the project's sector. */
export const SENSITIVITY_LEVELS = ['low', 'medium', 'high'] as const;

export type Tone = (typeof TONES)[number];
export type Sensitivity = (typeof SENSITIVITY_LEVELS)[number];

/** Industries where claims are regulated; the UI suggests high sensitivity for them. */
export const REGULATED_INDUSTRIES = ['finance', 'insurance', 'health'] as const;

const text = (max: number) => z.string().trim().max(max);
const list = (maxItems: number, maxLength = 300) =>
  z.array(z.string().trim().min(1).max(maxLength)).max(maxItems);

/**
 * Everything the AI needs to know to write on-brand, compliant copy for a project, grouped by
 * the questions a copywriter asks: what is sold, who reads the page, what can be proven, how
 * the brand writes and which rules can't be broken. Every field may be left empty.
 */
export const briefSchema = z.object({
  offer: z.object({
    product: text(1000),
    pageGoal: text(500),
    benefits: list(20),
  }),
  reader: z.object({
    audience: text(1000),
    stage: z.enum(BUYER_STAGES).nullable(),
    doubts: list(20),
  }),
  evidence: z.object({
    proofPoints: list(40),
    offLimits: list(40),
  }),
  style: z.object({
    tones: z.array(z.enum(TONES)).max(3),
    formality: z.enum(FORMALITIES).nullable(),
    readingLevel: z.enum(READING_LEVELS).nullable(),
    notes: text(2000),
  }),
  rules: z.object({
    sensitivity: z.enum(SENSITIVITY_LEVELS).nullable(),
    bannedWords: list(100, 60),
    requiredMentions: list(20),
    legalNotes: list(10, 1000),
    avoidStyles: list(20),
  }),
});
export type Brief = z.infer<typeof briefSchema>;

export const EMPTY_BRIEF: Brief = {
  offer: { product: '', pageGoal: '', benefits: [] },
  reader: { audience: '', stage: null, doubts: [] },
  evidence: { proofPoints: [], offLimits: [] },
  style: { tones: [], formality: null, readingLevel: null, notes: '' },
  rules: {
    sensitivity: null,
    bannedWords: [],
    requiredMentions: [],
    legalNotes: [],
    avoidStyles: [],
  },
};

export const briefResponseSchema = z.object({
  brief: briefSchema,
  updatedAt: z.iso.datetime().nullable(),
});
export type BriefResponse = z.infer<typeof briefResponseSchema>;

/** The checks behind the brief's completeness meter, in order of importance. */
export const BRIEF_CHECKS = [
  { id: 'product', done: (b: Brief) => b.offer.product.length > 0 },
  { id: 'audience', done: (b: Brief) => b.reader.audience.length > 0 },
  { id: 'pageGoal', done: (b: Brief) => b.offer.pageGoal.length > 0 },
  { id: 'tone', done: (b: Brief) => b.style.tones.length > 0 },
  { id: 'formality', done: (b: Brief) => b.style.formality !== null },
  { id: 'benefits', done: (b: Brief) => b.offer.benefits.length > 0 },
  { id: 'proofPoints', done: (b: Brief) => b.evidence.proofPoints.length > 0 },
  { id: 'sensitivity', done: (b: Brief) => b.rules.sensitivity !== null },
] as const;
export type BriefCheckId = (typeof BRIEF_CHECKS)[number]['id'];
