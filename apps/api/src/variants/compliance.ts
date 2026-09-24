import type { Brief, ComplianceIssue } from '@uplift/shared';

/** Lowercase without diacritics, so "Garantía" matches the banned word "garantia". */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whole-word (or whole-phrase) match that works for any alphabet. */
function containsTerm(text: string, term: string) {
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(fold(term))}(?![\\p{L}\\p{N}])`,
    'u',
  );
  return pattern.test(fold(text));
}

const PENALTIES: Record<ComplianceIssue['rule'], number> = {
  forbidden_claim: 50,
  banned_word: 40,
  unchanged: 60,
  too_long: 30,
  too_short: 20,
};

/**
 * Deterministic rule checks run on every variant, AI-written or manual. They catch the rules that
 * can be checked mechanically; the model is also told the rules, but is never trusted to police itself.
 */
export function checkCompliance(
  text: string,
  element: { originalText: string; minLength: number | null; maxLength: number | null },
  brief: Brief,
) {
  const issues: ComplianceIssue[] = [];

  for (const word of brief.guardrails.bannedWords) {
    if (containsTerm(text, word)) issues.push({ rule: 'banned_word', detail: word });
  }
  // Only exact phrases can be detected reliably; paraphrased claims need a human (or model) review.
  for (const claim of brief.truth.forbiddenClaims) {
    if (fold(claim).length >= 4 && fold(text).includes(fold(claim))) {
      issues.push({ rule: 'forbidden_claim', detail: claim });
    }
  }
  if (element.maxLength != null && text.length > element.maxLength) {
    issues.push({ rule: 'too_long', detail: `${text.length}/${element.maxLength}` });
  }
  if (element.minLength != null && text.length < element.minLength) {
    issues.push({ rule: 'too_short', detail: `${text.length}/${element.minLength}` });
  }
  if (fold(text) === fold(element.originalText)) {
    issues.push({ rule: 'unchanged', detail: '' });
  }

  const penalty = issues.reduce((sum, issue) => sum + PENALTIES[issue.rule], 0);
  return { issues, score: Math.max(0, 100 - penalty) };
}

/** Maps the model's three 1-5 self-ratings to 0-100. */
export function qualityScore(ratings: { clarity: number; relevance: number; persuasion: number }) {
  const average = (ratings.clarity + ratings.relevance + ratings.persuasion) / 3;
  return Math.round(((average - 1) / 4) * 100);
}
