/**
 * Progression engine (design PROG-1..W): the recommended next target for a
 * lift, from the athlete's own history. Double progression on load -- add weight
 * once the top of the rep range is reached, otherwise chase one more rep -- with
 * a light deload when the top set has stalled, and a from-scratch aim when there
 * is no history. Pure: feed it the exercise's top-set history and options.
 *
 * We already prefill last weight and log RPE; this turns that into an actual
 * target instead of "repeat last time".
 */
import { topSet, isStrengthExercise } from './store';
import type { Workout } from './types';
import type { MuscleGroup } from './data/exercises';

export interface TopPoint {
  ts: number;
  weight: number | null;
  reps: number;
}

/** Top working set per past session for `name`, newest first (optionally only
 *  sessions before `beforeTs`, so the live session excludes itself). */
export function topHistory(finished: Workout[], name: string, beforeTs?: number): TopPoint[] {
  const needle = name.trim().toLowerCase();
  const pts: TopPoint[] = [];
  for (const w of finished) {
    if (beforeTs !== undefined && w.startedAt >= beforeTs) continue;
    const ex = w.exercises.find(
      (e) => e.name.trim().toLowerCase() === needle && isStrengthExercise(e),
    );
    if (!ex) continue;
    const top = topSet(ex.sets);
    if (!top) continue;
    pts.push({ ts: w.startedAt, weight: top.weight, reps: top.reps });
  }
  return pts.sort((a, b) => b.ts - a.ts);
}

export type ProgState = 'first' | 'progress' | 'hold' | 'stall';

export interface Target {
  state: ProgState;
  weight: number | null;
  reps: number;
  deltaKg: number;
  repLow: number;
  repHigh: number;
  prevWeight: number | null;
  prevReps: number | null;
}

export interface ProgOpts {
  plannedReps?: number | null;
  equipment?: string[];
  primary?: MuscleGroup | null;
  bodyweight?: boolean;
}

// Loaded compound barbell work on these gets a 5 kg jump; everything else 2.5.
const BIG: MuscleGroup[] = ['quads', 'hamstrings', 'glutes', 'back', 'lats', 'chest'];

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

function repRange(plannedReps?: number | null): { low: number; high: number } {
  const high = plannedReps && plannedReps > 0 ? plannedReps : 10;
  return { low: Math.max(5, high - 3), high };
}

function stepFor(opts: ProgOpts): number {
  const barbell = (opts.equipment ?? []).includes('barbell');
  const big = opts.primary ? BIG.includes(opts.primary) : false;
  return barbell && big ? 5 : 2.5;
}

/** Top weight flat (no new high) across the last 3+ loaded sessions. */
function isStalled(history: TopPoint[]): boolean {
  const loaded = history.filter((p) => (p.weight ?? 0) > 0);
  if (loaded.length < 3) return false;
  const recent = loaded.slice(0, 3);
  const w = recent[0].weight ?? 0;
  return recent.every((p) => (p.weight ?? 0) <= w) && (recent[2].weight ?? 0) === w;
}

export function nextTarget(history: TopPoint[], opts: ProgOpts = {}): Target {
  const { low, high } = repRange(opts.plannedReps);
  const base = { repLow: low, repHigh: high };

  if (history.length === 0) {
    return {
      state: 'first',
      weight: null,
      reps: high,
      deltaKg: 0,
      ...base,
      prevWeight: null,
      prevReps: null,
    };
  }

  const last = history[0];
  const prevWeight = last.weight;
  const prevReps = last.reps;

  // Bodyweight / unloaded: progress by reps.
  if (opts.bodyweight || prevWeight === null || prevWeight === 0) {
    return {
      state: 'progress',
      weight: null,
      reps: prevReps + 1,
      deltaKg: 0,
      ...base,
      prevWeight,
      prevReps,
    };
  }

  if (isStalled(history)) {
    const deloaded = Math.max(roundTo(prevWeight * 0.9, 2.5), 2.5);
    return {
      state: 'stall',
      weight: deloaded,
      reps: low,
      deltaKg: deloaded - prevWeight,
      ...base,
      prevWeight,
      prevReps,
    };
  }

  // Double progression: hit the top of the range -> add load, reset reps.
  if (prevReps >= high) {
    const step = stepFor(opts);
    return {
      state: 'progress',
      weight: prevWeight + step,
      reps: low,
      deltaKg: step,
      ...base,
      prevWeight,
      prevReps,
    };
  }

  // Otherwise hold the weight and chase one more rep.
  return {
    state: 'hold',
    weight: prevWeight,
    reps: Math.min(prevReps + 1, high),
    deltaKg: 0,
    ...base,
    prevWeight,
    prevReps,
  };
}
