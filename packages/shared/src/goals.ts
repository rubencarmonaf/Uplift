import { z } from 'zod';

export const GOAL_KINDS = ['click', 'pageview', 'event'] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];

export const URL_MATCH_TYPES = ['exact', 'prefix', 'regex'] as const;

const isValidRegex = (pattern: string) => {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
};

/** How a conversion is detected on the visitor's side, per goal kind. */
export const goalTargetSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('click'),
    selector: z.string().trim().min(1).max(500),
  }),
  z
    .object({
      kind: z.literal('pageview'),
      match: z.enum(URL_MATCH_TYPES),
      value: z.string().trim().min(1).max(500),
    })
    .refine((t) => t.match !== 'regex' || isValidRegex(t.value), {
      message: 'invalid regex',
      path: ['value'],
    }),
  z.object({
    kind: z.literal('event'),
    // Matches what sites push to window.dataLayer or pass to uplift.track().
    eventName: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[\w.:-]+$/),
  }),
]);
export type GoalTarget = z.infer<typeof goalTargetSchema>;

export const createGoalSchema = z.object({
  name: z.string().trim().min(1).max(80),
  target: goalTargetSchema,
  isPrimary: z.boolean().default(false),
});
export type CreateGoalInput = z.input<typeof createGoalSchema>;

export const updateGoalSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    target: goalTargetSchema,
    isPrimary: z.literal(true),
  })
  .partial();
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;

export const goalSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  name: z.string(),
  target: goalTargetSchema,
  isPrimary: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Goal = z.infer<typeof goalSchema>;

/** Drops the hash and a trailing slash so `/pricing/` and `/pricing#faq` match `/pricing`. */
function normalizeUrl(raw: string) {
  const noHash = raw.split('#')[0]!;
  return noHash.length > 1 ? noHash.replace(/\/(?=$|\?)/, '') : noHash;
}

/**
 * Whether a visited URL satisfies a page-visit goal. `value` may be a full URL or just a path;
 * paths are compared against the URL's path (and query). Used by the app and the tracking script.
 */
export function matchesPageview(
  target: { match: (typeof URL_MATCH_TYPES)[number]; value: string },
  visitedUrl: string,
) {
  let url: URL;
  try {
    url = new URL(visitedUrl);
  } catch {
    return false;
  }
  if (target.match === 'regex') {
    try {
      return new RegExp(target.value).test(url.href);
    } catch {
      return false;
    }
  }
  const isFullUrl = /^https?:\/\//i.test(target.value);
  const candidate = normalizeUrl(isFullUrl ? url.href : url.pathname + url.search);
  const expected = normalizeUrl(target.value);
  return target.match === 'exact' ? candidate === expected : candidate.startsWith(expected);
}
