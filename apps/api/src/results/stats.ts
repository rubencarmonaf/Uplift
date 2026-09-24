/**
 * Bayesian A/B/n statistics for conversion rates. Each arm's rate gets a Beta(1 + conversions,
 * 1 + non-conversions) posterior (uniform prior); probabilities come from Monte Carlo draws with
 * a seeded generator, so the same data always yields the same numbers.
 */

/** Mulberry32: tiny, fast, good enough for Monte Carlo; seeded for reproducibility. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFrom(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function normal(rand: () => number) {
  // Box-Muller; 1 - u avoids log(0).
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Marsaglia-Tsang gamma sampler (shape >= 1, which always holds with a uniform prior). */
function gamma(shape: number, rand: () => number) {
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = normal(rand);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rand();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function beta(a: number, b: number, rand: () => number) {
  const x = gamma(a, rand);
  return x / (x + gamma(b, rand));
}

const quantile = (sorted: number[], q: number) =>
  sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))]!;

export type ArmCounts = { id: string; isControl: boolean; visitors: number; conversions: number };

export type ArmStats = {
  id: string;
  visitors: number;
  conversions: number;
  /** Observed conversion rate. */
  rate: number;
  /** 95% credible interval for the true rate. */
  rateInterval: [number, number];
  /** Relative uplift of the posterior mean over control (0.1 = +10%); null for control. */
  uplift: number | null;
  /** 95% credible interval for the relative uplift; null for control. */
  upliftInterval: [number, number] | null;
  /** P(this arm's rate > control's); null for control. */
  probBeatControl: number | null;
  /** P(this arm has the highest rate of all arms). */
  probBest: number;
};

export function analyze(arms: ArmCounts[], seed: number, draws = 20_000): ArmStats[] {
  const rand = seededRandom(seed);
  const posteriors = arms.map((a) => ({
    alpha: 1 + a.conversions,
    beta: 1 + Math.max(0, a.visitors - a.conversions),
  }));
  const samples = arms.map(() => new Float64Array(draws));
  const wins = new Array<number>(arms.length).fill(0);

  for (let i = 0; i < draws; i++) {
    let best = 0;
    for (let k = 0; k < arms.length; k++) {
      const value = beta(posteriors[k]!.alpha, posteriors[k]!.beta, rand);
      samples[k]![i] = value;
      if (value > samples[best]![i]!) best = k;
    }
    wins[best]!++;
  }

  const controlIndex = arms.findIndex((a) => a.isControl);
  const control = controlIndex >= 0 ? samples[controlIndex]! : null;

  return arms.map((arm, k) => {
    const own = samples[k]!;
    const sorted = Array.from(own).sort((x, y) => x - y);
    const base = {
      id: arm.id,
      visitors: arm.visitors,
      conversions: arm.conversions,
      rate: arm.visitors > 0 ? arm.conversions / arm.visitors : 0,
      rateInterval: [quantile(sorted, 0.025), quantile(sorted, 0.975)] as [number, number],
      probBest: wins[k]! / draws,
    };
    if (arm.isControl || !control) {
      return { ...base, uplift: null, upliftInterval: null, probBeatControl: null };
    }
    let beats = 0;
    const lifts = new Float64Array(draws);
    for (let i = 0; i < draws; i++) {
      if (own[i]! > control[i]!) beats++;
      lifts[i] = own[i]! / control[i]! - 1;
    }
    const sortedLifts = Array.from(lifts).sort((x, y) => x - y);
    const meanOwn = posteriors[k]!.alpha / (posteriors[k]!.alpha + posteriors[k]!.beta);
    const pc = posteriors[controlIndex]!;
    const meanControl = pc.alpha / (pc.alpha + pc.beta);
    return {
      ...base,
      uplift: meanOwn / meanControl - 1,
      upliftInterval: [quantile(sortedLifts, 0.025), quantile(sortedLifts, 0.975)] as [
        number,
        number,
      ],
      probBeatControl: beats / draws,
    };
  });
}

export const DECISION_THRESHOLD = 0.95;
export const MIN_VISITORS_PER_ARM = 100;
/** Below this probability of being best, nothing is leading. */
export const NO_DIFFERENCE_CEILING = 0.75;

export type Verdict =
  | { status: 'collecting'; minVisitors: number }
  | { status: 'winner'; armId: string; probability: number }
  | { status: 'control'; probability: number }
  | { status: 'beats_control'; armIds: string[] }
  | { status: 'no_difference' };

/**
 * A decision needs enough visitors in every arm and one arm with at least 95% probability of
 * being the best. `no_difference` needs 10x the minimum sample in every arm and no arm above 75%.
 */
export function verdict(arms: ArmCounts[], stats: ArmStats[]): Verdict {
  const smallest = Math.min(...arms.map((a) => a.visitors));
  if (smallest < MIN_VISITORS_PER_ARM) {
    return { status: 'collecting', minVisitors: MIN_VISITORS_PER_ARM };
  }
  const leader = stats.reduce((best, s) => (s.probBest > best.probBest ? s : best));
  if (leader.probBest >= DECISION_THRESHOLD) {
    const isControl = arms.find((a) => a.id === leader.id)?.isControl;
    return isControl
      ? { status: 'control', probability: leader.probBest }
      : { status: 'winner', armId: leader.id, probability: leader.probBest };
  }
  const beating = stats
    .filter((s) => s.probBeatControl !== null && s.probBeatControl >= DECISION_THRESHOLD)
    .map((s) => s.id);
  if (beating.length > 0) return { status: 'beats_control', armIds: beating };
  // "No difference" only when nothing is even close to leading, with plenty of data.
  if (smallest >= MIN_VISITORS_PER_ARM * 10 && leader.probBest < NO_DIFFERENCE_CEILING) {
    return { status: 'no_difference' };
  }
  return { status: 'collecting', minVisitors: MIN_VISITORS_PER_ARM };
}
