/**
 * THE shared "recent load" window (SPO-114). Every screen that asks "how loaded
 * is this muscle right now?" (session muscle map, Today landmarks, volume heat
 * map, muscle panel, notifications, session builder) reads this one function,
 * so they cannot disagree. Raw period counts (weeklyMuscleSets in volume.ts)
 * remain only for explicit historical ranges ("sets in the last 28 days").
 * Kept free of volume/recovery imports so both can depend on it without a cycle.
 */
import { muscleSetsInWorkout } from './store';
import type { Workout } from './types';
import type { MuscleGroup } from './data/exercises';

const DAY = 24 * 3600 * 1000;

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

/** Half-life of a session's load = this many recovery windows of the muscle
 *  (chest 2.5 d → 3.75 d; calves 1.5 d → 2.25 d): bigger muscles shed load slower. */
export const LOAD_HALF_LIFE_RECOVERY = 1.5;
/** Past this age a session's load is negligible (< 2% of a chest set) — skipped. */
export const LOAD_LOOKBACK_DAYS = 28;

/**
 * Recent load per muscle in WEEKLY-SET currency, fading smoothly instead of
 * dropping out of a 7-day window. Every set decays exponentially with the
 * muscle's half-life (see LOAD_HALF_LIFE_RECOVERY) and the sum is scaled by
 * (1 - 2^(-7/h)), so a muscle trained at a steady S sets/week reads exactly S —
 * the same scale as the MEV/MAV/MRV landmarks. Consequences (SPO-114):
 *   - one big day can't flip a muscle to "over" for a week (24 chest sets today
 *     read ~17, not 24; the same day a week ago reads ~5 and keeps fading);
 *   - one more set near a limit nudges the number, it doesn't switch a state;
 *   - it shares the recovery clocks (RECOVERY_DAYS) the readiness read uses.
 * Sessions after `now` are ignored; an in-progress workout may be passed in.
 */
export function recentLoadSets(finished: Workout[], now: number): Map<MuscleGroup, number> {
  const out = new Map<MuscleGroup, number>();
  const since = now - LOAD_LOOKBACK_DAYS * DAY;
  for (const w of finished) {
    if (w.startedAt < since || w.startedAt > now) continue;
    const days = (now - w.startedAt) / DAY;
    for (const [m, sets] of muscleSetsInWorkout(w)) {
      if (sets <= 0) continue;
      const half = (RECOVERY_DAYS[m] ?? 2) * LOAD_HALF_LIFE_RECOVERY;
      const norm = 1 - Math.pow(2, -7 / half);
      out.set(m, (out.get(m) ?? 0) + sets * Math.pow(2, -days / half) * norm);
    }
  }
  return out;
}
