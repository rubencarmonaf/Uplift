import type { ExperimentScope } from '@uplift/shared';
import { matchesPageview } from '@uplift/shared/url-match';

/**
 * FNV-1a followed by Murmur3's fmix32 finalizer. Deterministic everywhere, so a visitor always
 * gets the same arm. The finalizer matters: plain FNV-1a barely mixes the last characters, and IDs
 * that differ only at the end then skew the split (a test caught 27.9% for a 30% target).
 */
export function hash(input: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** A number in [0, 1) derived from the visitor, the experiment and a purpose-specific salt. */
const bucket = (visitorId: string, experimentId: string, salt: string) =>
  hash(`${salt}:${experimentId}:${visitorId}`) / 0x100000000;

/** Whether the visitor falls in the share of traffic that takes part in the experiment. */
export function isInExperiment(visitorId: string, experimentId: string, trafficPercent: number) {
  return bucket(visitorId, experimentId, 'traffic') * 100 < trafficPercent;
}

/** Picks an arm in proportion to the weights. Independent of the traffic bucket (different salt). */
export function pickArm<T extends { id: string; weight: number }>(
  arms: T[],
  visitorId: string,
  experimentId: string,
): T | null {
  const total = arms.reduce((sum, a) => sum + Math.max(0, a.weight), 0);
  if (total <= 0) return null;
  let point = bucket(visitorId, experimentId, 'arm') * total;
  for (const arm of arms) {
    point -= Math.max(0, arm.weight);
    if (point < 0) return arm;
  }
  return arms[arms.length - 1] ?? null;
}

export function hostnameAllowed(hostname: string, domains: string[]) {
  const host = hostname.toLowerCase();
  return domains.some((domain) =>
    domain.startsWith('*.')
      ? host === domain.slice(2) || host.endsWith(domain.slice(1))
      : host === domain,
  );
}

/** Whether the experiment's changes apply on this URL. */
export function inScope(url: string, scope: ExperimentScope) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!hostnameAllowed(parsed.hostname, scope.domains)) return false;
  return scope.path ? matchesPageview(scope.path, url) : true;
}

export function randomId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('');
}
