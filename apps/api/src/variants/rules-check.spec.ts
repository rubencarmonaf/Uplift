import { type Brief, EMPTY_BRIEF } from '@uplift/shared';
import { describe, expect, it } from 'vitest';
import { checkRules, qualityScore } from './rules-check.js';

const brief: Brief = {
  ...EMPTY_BRIEF,
  evidence: { ...EMPTY_BRIEF.evidence, offLimits: ['el más barato del mercado'] },
  rules: { ...EMPTY_BRIEF.rules, bannedWords: ['garantía', 'gratis'] },
};
const element = { originalText: 'Pide tu presupuesto', minLength: 5, maxLength: 30 };
const rules = (text: string) => checkRules(text, element, brief).issues.map((i) => i.rule);

describe('checkRules', () => {
  it('passes clean copy with a full score', () => {
    expect(checkRules('Calcula tu precio en 2 minutos', element, brief)).toEqual({
      issues: [],
      score: 100,
    });
  });

  it('finds banned words regardless of case and accents', () => {
    expect(rules('Con GARANTIA total')).toContain('banned_word');
    expect(rules('Pruébalo Gratis')).toContain('banned_word');
  });

  it('only matches whole words', () => {
    expect(rules('Garantizado para ti')).not.toContain('banned_word');
    expect(rules('Gratisfacción total')).not.toContain('banned_word');
  });

  it('finds off-limits promises', () => {
    expect(rules('El más barato del mercado')).toContain('off_limits_promise');
  });

  it('checks length limits', () => {
    expect(rules('Hola')).toContain('too_short');
    expect(rules('Un texto demasiado largo para este botón')).toContain('too_long');
  });

  it('flags copy identical to the original', () => {
    expect(rules('  pide TU presupuesto ')).toEqual(['unchanged']);
  });

  it('never goes below zero', () => {
    const { score } = checkRules(
      'Gratis y con garantía: el más barato del mercado',
      element,
      brief,
    );
    expect(score).toBe(0);
  });
});

describe('qualityScore', () => {
  it('maps 1-5 ratings to 0-100', () => {
    expect(qualityScore({ clarity: 1, relevance: 1, persuasion: 1 })).toBe(0);
    expect(qualityScore({ clarity: 5, relevance: 5, persuasion: 5 })).toBe(100);
    expect(qualityScore({ clarity: 3, relevance: 3, persuasion: 3 })).toBe(50);
  });
});
