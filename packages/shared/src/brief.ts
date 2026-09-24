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
export const FUNNEL_STAGES = ['awareness', 'consideration', 'decision', 'retention'] as const;
export const RISK_LEVELS = ['low', 'medium', 'high'] as const;

export type Tone = (typeof TONES)[number];
export type RiskLevel = (typeof RISK_LEVELS)[number];

/** Industries where claims are regulated; the UI suggests a high risk level for them. */
export const REGULATED_INDUSTRIES = ['finance', 'insurance', 'health'] as const;

const text = (max: number) => z.string().trim().max(max);
const list = (maxItems: number, maxLength = 300) =>
  z.array(z.string().trim().min(1).max(maxLength)).max(maxItems);

/**
 * Everything the AI needs to know to write on-brand, compliant copy for a project.
 * Every field is optional so a brief can be filled in gradually.
 */
export const briefSchema = z.object({
  voice: z.object({
    tones: z.array(z.enum(TONES)).max(3),
    formality: z.enum(FORMALITIES).nullable(),
    readingLevel: z.enum(READING_LEVELS).nullable(),
    notes: text(2000),
  }),
  business: z.object({
    offering: text(1000),
    audience: text(1000),
    pageGoal: text(500),
    funnelStage: z.enum(FUNNEL_STAGES).nullable(),
    valueProps: list(20),
    objections: list(20),
  }),
  truth: z.object({
    facts: list(40),
    forbiddenClaims: list(40),
  }),
  guardrails: z.object({
    riskLevel: z.enum(RISK_LEVELS).nullable(),
    bannedWords: list(100, 60),
    requiredMentions: list(20),
    disclaimers: list(10, 1000),
    avoidStyles: list(20),
  }),
});
export type Brief = z.infer<typeof briefSchema>;

export const EMPTY_BRIEF: Brief = {
  voice: { tones: [], formality: null, readingLevel: null, notes: '' },
  business: {
    offering: '',
    audience: '',
    pageGoal: '',
    funnelStage: null,
    valueProps: [],
    objections: [],
  },
  truth: { facts: [], forbiddenClaims: [] },
  guardrails: {
    riskLevel: null,
    bannedWords: [],
    requiredMentions: [],
    disclaimers: [],
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
  { id: 'offering', done: (b: Brief) => b.business.offering.length > 0 },
  { id: 'audience', done: (b: Brief) => b.business.audience.length > 0 },
  { id: 'pageGoal', done: (b: Brief) => b.business.pageGoal.length > 0 },
  { id: 'tone', done: (b: Brief) => b.voice.tones.length > 0 },
  { id: 'formality', done: (b: Brief) => b.voice.formality !== null },
  { id: 'valueProps', done: (b: Brief) => b.business.valueProps.length > 0 },
  { id: 'facts', done: (b: Brief) => b.truth.facts.length > 0 },
  { id: 'riskLevel', done: (b: Brief) => b.guardrails.riskLevel !== null },
] as const;
export type BriefCheckId = (typeof BRIEF_CHECKS)[number]['id'];
