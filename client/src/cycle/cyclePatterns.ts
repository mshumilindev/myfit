/**
 * Patterns: how the person's OWN rated effort differs by phase. Never a general rule.
 *
 * Cycle boundaries come only from start dates the person actually entered (the setup date and
 * every "update date"). Between two consecutive entered starts a..b we interpolate n = round((b−a)/L)
 * equal cycles — an interpolation between two observations, not an extrapolation. A phase is then
 * compared with the SAME cycle's overall average (a paired difference, so a hard week or a new
 * programme cancels out), and the mean difference over cycles gets a deterministic bootstrap 95% CI.
 * We say "different" only when the CI excludes 0; otherwise "cannot tell them apart".
 */
import { dayOfTimestamp } from '../components/ui/calendarDays';
import type { Workout } from '../types';
import { LIMITS, phaseOfDay, type CyclePhase, type CycleSettings } from './cycleCore';

export const MIN_CYCLES = 3;
export const PHASES: readonly CyclePhase[] = ['menses', 'early', 'mid', 'late'];

export interface ObservedCycle {
  start: number;
  length: number;
}

/** Complete cycles between consecutive entered starts (skips implausible gaps). */
export function observedCycles(starts: readonly number[], s: CycleSettings): ObservedCycle[] {
  const out: ObservedCycle[] = [];
  const sorted = [...starts].sort((x, y) => x - y);
  for (let i = 0; i + 1 < sorted.length; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const n = Math.max(1, Math.round((b - a) / s.length));
    const len = (b - a) / n;
    if (len < LIMITS.length[0] || len > LIMITS.length[1]) continue;
    for (let k = 0; k < n; k++) out.push({ start: a + Math.round(k * len), length: len });
  }
  return out;
}

/** Rated working-set RPEs by day. Unrated and warm-up sets are ignored; nothing is inferred. */
export function ratedRpeByDay(workouts: readonly Workout[]): Map<number, number[]> {
  const m = new Map<number, number[]>();
  for (const w of workouts) {
    if (w.finishedAt == null) continue;
    const day = dayOfTimestamp(w.startedAt);
    for (const e of w.exercises)
      for (const set of e.sets) {
        if (set.isWarmup || typeof set.rpe !== 'number' || !(set.rpe > 0)) continue;
        const list = m.get(day) ?? [];
        list.push(set.rpe);
        m.set(day, list);
      }
  }
  return m;
}

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Small deterministic PRNG so the interval does not flicker between renders. */
function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
}

export function bootstrapCI(diffs: readonly number[], iters = 2000): { lo: number; hi: number } {
  const rand = rng(diffs.length * 7919 + 13);
  const means: number[] = [];
  for (let i = 0; i < iters; i++) {
    let sum = 0;
    for (let j = 0; j < diffs.length; j++) sum += diffs[Math.floor(rand() * diffs.length)];
    means.push(sum / diffs.length);
  }
  means.sort((a, b) => a - b);
  return { lo: means[Math.floor(iters * 0.025)], hi: means[Math.ceil(iters * 0.975) - 1] };
}

export interface PhasePattern {
  phase: CyclePhase;
  /** Cycles that had rated sets both in this phase and elsewhere. */
  cycles: number;
  /** Mean paired difference vs the cycle's own average, RPE points. */
  diff: number;
  lo: number;
  hi: number;
  /** The interval excludes 0. */
  distinct: boolean;
}

export interface PatternResult {
  /** Entered-start cycles available. */
  cycles: number;
  enough: boolean;
  phases: PhasePattern[];
}

export function cyclePatterns(
  starts: readonly number[],
  s: CycleSettings,
  workouts: readonly Workout[],
): PatternResult {
  const cycles = observedCycles(starts, s);
  const byDay = ratedRpeByDay(workouts);
  const diffs: Record<CyclePhase, number[]> = { menses: [], early: [], mid: [], late: [] };
  for (const c of cycles) {
    const per: Record<CyclePhase, number[]> = { menses: [], early: [], mid: [], late: [] };
    for (let d = 0; d < Math.floor(c.length); d++) {
      const rpes = byDay.get(c.start + d);
      if (rpes) per[phaseOfDay(d, c.length, s.period)].push(...rpes);
    }
    const all = PHASES.flatMap((p) => per[p]);
    if (all.length < 4) continue;
    const overall = mean(all);
    for (const p of PHASES) if (per[p].length >= 2) diffs[p].push(mean(per[p]) - overall);
  }
  const phases: PhasePattern[] = [];
  for (const p of PHASES) {
    const d = diffs[p];
    if (d.length < MIN_CYCLES) continue;
    const ci = bootstrapCI(d);
    phases.push({
      phase: p,
      cycles: d.length,
      diff: mean(d),
      lo: ci.lo,
      hi: ci.hi,
      distinct: ci.lo > 0 || ci.hi < 0,
    });
  }
  return { cycles: cycles.length, enough: phases.length > 0, phases };
}
