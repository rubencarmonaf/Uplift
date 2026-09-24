import { z } from 'zod';
import { URL_MATCH_TYPES } from './goals.js';

export const EXPERIMENT_STATUSES = ['draft', 'running', 'paused', 'finished'] as const;
export type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number];

export const MAX_ARMS = 5;

/** One version of the page in the experiment: which variant each element shows. */
export const armSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(40),
  /** Share of experiment traffic, relative to the other arms. */
  weight: z.number().int().min(0).max(100),
  isControl: z.boolean(),
  changes: z.array(z.object({ elementId: z.uuid(), variantId: z.uuid() })).max(50),
});
export type Arm = z.infer<typeof armSchema>;

export const antiFlickerSchema = z.object({
  enabled: z.boolean(),
  /** The page is shown after this long even if the script has not finished. */
  timeoutMs: z.number().int().min(100).max(4000),
});

/** Where the script runs: hostnames it is allowed on, and optionally which pages. */
export const scopeSchema = z.object({
  domains: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)+$/),
    )
    .min(1)
    .max(20),
  path: z
    .object({ match: z.enum(URL_MATCH_TYPES), value: z.string().trim().min(1).max(500) })
    .nullable(),
});
export type ExperimentScope = z.infer<typeof scopeSchema>;

export const experimentSettingsSchema = z.object({
  /** Percentage of visitors that enter the experiment; the rest see the original page. */
  trafficPercent: z.number().int().min(1).max(100),
  antiFlicker: antiFlickerSchema,
  scope: scopeSchema,
});

export const updateExperimentSchema = experimentSettingsSchema
  .extend({
    arms: z
      .array(armSchema)
      .min(2)
      .max(MAX_ARMS)
      .refine((arms) => arms.filter((a) => a.isControl).length === 1, 'exactly one control arm')
      .refine((arms) => arms.some((a) => a.weight > 0), 'at least one arm needs traffic'),
  })
  .partial();
export type UpdateExperimentInput = z.infer<typeof updateExperimentSchema>;

export const EXPERIMENT_ACTIONS = ['start', 'pause', 'resume', 'finish', 'reset'] as const;
export const experimentActionSchema = z.object({
  action: z.enum(EXPERIMENT_ACTIONS),
  /** For `finish`: the arm to serve to everyone from now on (null keeps the original page). */
  winnerArmId: z.uuid().nullable().optional(),
});
export type ExperimentAction = z.infer<typeof experimentActionSchema>;

export const experimentSchema = experimentSettingsSchema.extend({
  id: z.uuid(),
  projectId: z.uuid(),
  status: z.enum(EXPERIMENT_STATUSES),
  publicKey: z.string(),
  arms: z.array(armSchema),
  winnerArmId: z.uuid().nullable(),
  startedAt: z.iso.datetime().nullable(),
  endedAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(),
  /** The production script to install on the site. */
  snippetUrl: z.string(),
  /** A copy of the page with the script already installed, for trying the experiment out. */
  testPageUrl: z.string(),
});
export type Experiment = z.infer<typeof experimentSchema>;

/**
 * What the production script receives: already resolved to selectors and texts, so the script
 * needs no knowledge of projects, elements or variants.
 */
export type RuntimeConfig = {
  key: string;
  experimentId: string;
  status: ExperimentStatus;
  trafficPercent: number;
  antiFlicker: { enabled: boolean; timeoutMs: number };
  scope: ExperimentScope;
  /** When the experiment is finished with a winner, everyone gets this arm and nothing is tracked. */
  winner: { armId: string; changes: { selector: string; text: string }[] } | null;
  arms: { id: string; weight: number; changes: { selector: string; text: string }[] }[];
  goals: ({ id: string } & (
    | { kind: 'click'; selector: string }
    | { kind: 'pageview'; match: (typeof URL_MATCH_TYPES)[number]; value: string }
    | { kind: 'event'; eventName: string }
  ))[];
  endpoint: string;
  /** Test page only: the URL of the original page, used instead of location for scope and goals. */
  pageUrl?: string;
};

export const EVENT_TYPES = ['exposure', 'conversion'] as const;

/** Sent by the production script (via sendBeacon, so as text/plain JSON). */
export const trackEventSchema = z.object({
  visitorId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  armId: z.uuid(),
  type: z.enum(EVENT_TYPES),
  goalId: z.uuid().optional(),
});
export type TrackEvent = z.infer<typeof trackEventSchema>;
