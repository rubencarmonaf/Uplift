import { z } from 'zod';

export type ArmResult = {
  armId: string;
  name: string;
  isControl: boolean;
  visitors: number;
  conversions: number;
  rate: number;
  rateInterval: [number, number];
  uplift: number | null;
  upliftInterval: [number, number] | null;
  probBeatControl: number | null;
  probBest: number;
};

export type Verdict =
  | { status: 'collecting'; minVisitors: number }
  | { status: 'winner'; armId: string; probability: number }
  | { status: 'control'; probability: number }
  | { status: 'no_difference' };

export type ExperimentResults = {
  status: 'draft' | 'running' | 'paused' | 'finished';
  startedAt: string | null;
  endedAt: string | null;
  winnerArmId: string | null;
  primaryGoal: { id: string; name: string } | null;
  arms: ArmResult[];
  verdict: Verdict;
  /** Other goals, with the same statistics per arm. */
  secondary: { goalId: string; name: string; arms: ArmResult[] }[];
  /** Cumulative visitors and primary-goal conversions per arm, one point per day. */
  series: { date: string; arms: Record<string, { visitors: number; conversions: number }> }[];
  simulated: boolean;
};

export const simulateTrafficSchema = z.object({
  days: z.number().int().min(1).max(60).default(14),
  visitorsPerDay: z.number().int().min(10).max(5000).default(400),
});
export type SimulateTrafficInput = z.input<typeof simulateTrafficSchema>;
