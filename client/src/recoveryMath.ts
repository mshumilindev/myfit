/**
 * Pure recovery maths (SRA curve, linearised) shared by recovery.ts and
 * fatigue.ts. No store/personalize imports, so fatigue.ts can use it without
 * an import cycle (fatigue -> recovery -> personalize -> fatigue). The
 * nicotine/alcohol readiness multiplier is passed in (calcMods pulls the store).
 */
import type { MuscleGroup } from './data/exercises';

/** Baseline full-recovery window (days) per fine muscle — smaller muscles are
 *  faster. Consensus SRA guidance (Israetel / Renaissance Periodization). */
export const RECOVERY_DAYS: Partial<Record<MuscleGroup, number>> = {
  forearms: 1.5,
  calves: 1.5,
  core: 1.5,
  biceps: 2,
  triceps: 2,
  shoulders: 2,
  traps: 2,
  chest: 2.5,
  lats: 2.5,
  hamstrings: 2.5,
  glutes: 2.5,
  lower_back: 3,
  quads: 3,
};

export type ReadyState = 'recovering' | 'nearly' | 'ready' | 'stale';

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

function stateOf(readiness: number, daysSince: number | null, effDays: number): ReadyState {
  // Never trained (in window), or long past the window and under-stimulated.
  if (daysSince === null) return 'stale';
  if (readiness >= 1) return daysSince > effDays * 2.2 ? 'stale' : 'ready';
  if (readiness >= 0.9) return 'ready';
  if (readiness >= 0.5) return 'nearly';
  return 'recovering';
}

/**
 * The pure recovery math for one muscle, split out so it's testable without the
 * workout history. `daysSince` null = not trained in the lookback window.
 */
export function computeReadinessWith(
  mult: number,
  daysSince: number | null,
  dose: number,
  base: number,
  mav: number,
  boost = 0,
): { recoveryDays: number; readiness: number; state: ReadyState } {
  if (daysSince === null) {
    return { recoveryDays: base, readiness: 1, state: 'stale' };
  }
  // A session near half the weekly MAV is a "normal" dose (factor 1); lighter
  // recovers quicker, a big one stretches the window.
  const doseFactor = clamp(dose / ((mav || 12) * 0.5), 0.7, 1.6);
  // Nicotine and alcohol (midpoints of their ranges, product <= 1; exactly 1 when off): the window stretches by
  // 1 / factor, which is the same as readiness being `factor` times lower at any moment.
  const effDays = (base * doseFactor) / mult;
  const readiness = clamp(daysSince / effDays + clamp(boost, 0, 1) * 0.12, 0, 1);
  return { recoveryDays: effDays, readiness, state: stateOf(readiness, daysSince, effDays) };
}
