// Kept free of dependencies (no zod): the production snippet bundles this file.

export const URL_MATCH_TYPES = ['exact', 'prefix', 'regex'] as const;
export type UrlMatchType = (typeof URL_MATCH_TYPES)[number];

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
  target: { match: UrlMatchType; value: string },
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
