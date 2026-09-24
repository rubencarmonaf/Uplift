import { describe, expect, it } from 'vitest';
import { analyze, seededRandom, verdict } from './stats.js';

const arms = (control: [number, number], variant: [number, number]) => [
  { id: 'control', isControl: true, visitors: control[0], conversions: control[1] },
  { id: 'a', isControl: false, visitors: variant[0], conversions: variant[1] },
];

describe('seededRandom', () => {
  it('is reproducible and roughly uniform', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const values = Array.from({ length: 10_000 }, () => a());
    expect(values.slice(0, 5)).toEqual(Array.from({ length: 5 }, () => b()));
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.52);
  });
});

describe('analyze', () => {
  it('is deterministic for the same seed', () => {
    const input = arms([1000, 50], [1000, 65]);
    expect(analyze(input, 7)).toEqual(analyze(input, 7));
  });

  it('gives ~50% when arms are identical', () => {
    const [, a] = analyze(arms([2000, 100], [2000, 100]), 1);
    expect(a!.probBeatControl!).toBeGreaterThan(0.45);
    expect(a!.probBeatControl!).toBeLessThan(0.55);
  });

  it('is confident about a clearly better arm', () => {
    const [control, a] = analyze(arms([5000, 250], [5000, 350]), 1);
    expect(a!.probBeatControl!).toBeGreaterThan(0.99);
    expect(a!.probBest).toBeGreaterThan(0.99);
    expect(control!.probBest).toBeLessThan(0.01);
    // True uplift is +40%: the estimate and its interval should reflect it.
    expect(a!.uplift!).toBeCloseTo(0.4, 1);
    expect(a!.upliftInterval![0]).toBeGreaterThan(0.15);
    expect(a!.upliftInterval![1]).toBeLessThan(0.7);
  });

  it('matches the analytical answer for a known case', () => {
    // Normal approximation for Beta(51, 951) vs Beta(71, 931): P ≈ 0.96.
    const [, a] = analyze(arms([1000, 50], [1000, 70]), 3, 50_000);
    expect(a!.probBeatControl!).toBeGreaterThan(0.94);
    expect(a!.probBeatControl!).toBeLessThan(0.98);
  });

  it('puts the observed rate inside its credible interval', () => {
    const [control] = analyze(arms([400, 20], [400, 24]), 1);
    expect(control!.rate).toBe(0.05);
    expect(control!.rateInterval[0]).toBeLessThan(0.05);
    expect(control!.rateInterval[1]).toBeGreaterThan(0.05);
  });

  it('handles arms with no data', () => {
    const result = analyze(arms([0, 0], [0, 0]), 1);
    expect(result[0]!.rate).toBe(0);
    expect(result[1]!.probBeatControl!).toBeGreaterThan(0.4);
    expect(result[1]!.probBeatControl!).toBeLessThan(0.6);
  });
});

describe('verdict', () => {
  it('keeps collecting below the minimum sample', () => {
    const input = arms([50, 1], [50, 25]);
    expect(verdict(input, analyze(input, 1)).status).toBe('collecting');
  });

  it('declares a winner at 95% or more', () => {
    const input = arms([5000, 250], [5000, 350]);
    expect(verdict(input, analyze(input, 1))).toMatchObject({ status: 'winner', armId: 'a' });
  });

  it('can conclude that control wins', () => {
    const input = arms([5000, 350], [5000, 250]);
    expect(verdict(input, analyze(input, 1)).status).toBe('control');
  });

  it('keeps collecting while an arm is leading but not yet at 95%', () => {
    const input = [
      { id: 'control', isControl: true, visitors: 2400, conversions: 86 },
      { id: 'a', isControl: false, visitors: 2300, conversions: 96 },
      { id: 'b', isControl: false, visitors: 2350, conversions: 80 },
    ];
    const stats = analyze(input, 1);
    const a = stats.find((s) => s.id === 'a')!;
    expect(a.probBest).toBeGreaterThan(0.75);
    expect(a.probBeatControl!).toBeLessThan(0.95);
    expect(verdict(input, stats).status).toBe('collecting');
  });

  it('concludes no difference only with a large sample', () => {
    const small = arms([500, 25], [500, 25]);
    expect(verdict(small, analyze(small, 1)).status).toBe('collecting');
    const large = arms([5000, 250], [5000, 250]);
    expect(verdict(large, analyze(large, 1)).status).toBe('no_difference');
  });
});

describe('verdict with several arms', () => {
  it('reports arms that beat control when none is clearly the best', () => {
    const input = [
      { id: 'control', isControl: true, visitors: 2500, conversions: 140 },
      { id: 'a', isControl: false, visitors: 2500, conversions: 185 },
      { id: 'b', isControl: false, visitors: 2500, conversions: 185 },
    ];
    expect(verdict(input, analyze(input, 1))).toEqual({
      status: 'beats_control',
      armIds: ['a', 'b'],
    });
  });
});
