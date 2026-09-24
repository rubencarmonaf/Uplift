import { describe, expect, it } from 'vitest';
import { hash, hostnameAllowed, inScope, isInExperiment, pickArm } from './assign';

const visitors = Array.from({ length: 20000 }, (_, i) => `visitor-${i}`);

describe('hash', () => {
  it('is deterministic', () => {
    expect(hash('abc')).toBe(hash('abc'));
    expect(hash('abc')).not.toBe(hash('abd'));
  });
});

describe('isInExperiment', () => {
  it('lets through roughly the configured share of visitors', () => {
    const inside = visitors.filter((v) => isInExperiment(v, 'exp-1', 30)).length;
    expect(inside / visitors.length).toBeGreaterThan(0.28);
    expect(inside / visitors.length).toBeLessThan(0.32);
  });

  it('includes everyone at 100% and keeps decisions stable', () => {
    expect(visitors.every((v) => isInExperiment(v, 'exp-1', 100))).toBe(true);
    expect(isInExperiment('visitor-7', 'exp-1', 50)).toBe(isInExperiment('visitor-7', 'exp-1', 50));
  });
});

describe('pickArm', () => {
  const arms = [
    { id: 'control', weight: 50 },
    { id: 'a', weight: 30 },
    { id: 'b', weight: 20 },
  ];

  it('splits traffic in proportion to the weights', () => {
    const counts: Record<string, number> = { control: 0, a: 0, b: 0 };
    for (const v of visitors) counts[pickArm(arms, v, 'exp-1')!.id]!++;
    expect(counts.control! / visitors.length).toBeCloseTo(0.5, 1);
    expect(counts.a! / visitors.length).toBeCloseTo(0.3, 1);
    expect(counts.b! / visitors.length).toBeCloseTo(0.2, 1);
  });

  it('never picks an arm with no weight, and returns null when nothing has weight', () => {
    const picked = visitors.map(
      (v) =>
        pickArm(
          [
            { id: 'x', weight: 0 },
            { id: 'y', weight: 1 },
          ],
          v,
          'e',
        )!.id,
    );
    expect(picked.every((id) => id === 'y')).toBe(true);
    expect(pickArm([{ id: 'x', weight: 0 }], 'v', 'e')).toBeNull();
  });

  it('is independent from the traffic bucket', () => {
    const inside = visitors.filter((v) => isInExperiment(v, 'exp-1', 50));
    const aShare =
      inside.filter((v) => pickArm(arms, v, 'exp-1')!.id === 'a').length / inside.length;
    expect(aShare).toBeCloseTo(0.3, 1);
  });
});

describe('scope', () => {
  it('matches exact domains and wildcards', () => {
    expect(hostnameAllowed('shop.example.com', ['shop.example.com'])).toBe(true);
    expect(hostnameAllowed('SHOP.example.com', ['shop.example.com'])).toBe(true);
    expect(hostnameAllowed('www.example.com', ['*.example.com'])).toBe(true);
    expect(hostnameAllowed('example.com', ['*.example.com'])).toBe(true);
    expect(hostnameAllowed('evil-example.com', ['*.example.com'])).toBe(false);
    expect(hostnameAllowed('example.com.evil.io', ['example.com'])).toBe(false);
  });

  it('checks the page path when set', () => {
    const scope = {
      domains: ['example.com'],
      path: { match: 'prefix' as const, value: '/pricing' },
    };
    expect(inScope('https://example.com/pricing/pro', scope)).toBe(true);
    expect(inScope('https://example.com/blog', scope)).toBe(false);
    expect(inScope('https://example.com/blog', { ...scope, path: null })).toBe(true);
  });
});
