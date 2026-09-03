/**
 * Per-muscle recovery model (design "Readiness", feature #1 foundation). Fatigue
 * (fatigue.ts) reads chronic weekly load against MRV; this reads the other axis
 * — time. Each muscle recovers on its OWN clock: small muscles bounce back in a
 * day or so, big damage-prone ones take longer, and a bigger last session
 * stretches the window. Readiness climbs from 0 right after training back to
 * 100% over that window (an SRA curve, linearised).
 *
 * Pure over the finished-workout history. Feeds the readiness coach and sharpens
 * the deload nudge (a muscle long past its window shouldn't read as fatigued).
 */
import { muscleSetsInWorkout } from './store';
import { LANDMARKS, VOLUME_MUSCLES, type Landmark } from './volume';
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

export type ReadyState = 'recovering' | 'nearly' | 'ready' | 'stale';

export interface MuscleReadiness {
  muscle: MuscleGroup;
  /** Days since the muscle was last meaningfully trained; null if not in window. */
  daysSince: number | null;
  /** Effective recovery window (days), the baseline stretched by the last dose. */
  recoveryDays: number;
  /** Fractional working sets the muscle took in that last session. */
  lastDose: number;
  /** 0..1 recovered. 1 = ready. */
  readiness: number;
  state: ReadyState;
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** How long we look back for a "last trained" session; older reads as recovered. */
const LOOKBACK_DAYS = 16;

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
export function computeReadiness(
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
  const effDays = base * doseFactor;
  const readiness = clamp(daysSince / effDays + clamp(boost, 0, 1) * 0.12, 0, 1);
  return { recoveryDays: effDays, readiness, state: stateOf(readiness, daysSince, effDays) };
}

/**
 * Per-muscle readiness right now. `recoveryBoost` (0..1, e.g. from logged
 * recovery activities) lifts every readiness a touch — sleep/sauna/mobility
 * bring a muscle back sooner. Returns every landmarked muscle.
 */
export function muscleReadiness(
  finished: Workout[],
  now: number,
  recoveryBoost = 0,
): Map<MuscleGroup, MuscleReadiness> {
  const since = now - LOOKBACK_DAYS * DAY;
  // Most-recent-first, so the first hit per muscle is its last session.
  const recent = finished
    // finishedAt not required, so an in-progress session's logged sets count
    // for callers that pass them (e.g. the Progress maps); finished-only callers
    // are unaffected since their input has no in-progress workouts.
    .filter((w) => w.startedAt >= since)
    .sort((a, b) => b.startedAt - a.startedAt);

  const last = new Map<MuscleGroup, { daysSince: number; dose: number }>();
  for (const w of recent) {
    const days = (now - w.startedAt) / DAY;
    for (const [m, sets] of muscleSetsInWorkout(w)) {
      if (sets <= 0 || last.has(m)) continue;
      last.set(m, { daysSince: days, dose: sets });
    }
  }

  const out = new Map<MuscleGroup, MuscleReadiness>();
  for (const m of VOLUME_MUSCLES) {
    const base = RECOVERY_DAYS[m] ?? 2;
    const mav = (LANDMARKS[m] as Landmark).mav || 12;
    const hit = last.get(m) ?? null;
    const r = computeReadiness(
      hit ? hit.daysSince : null,
      hit?.dose ?? 0,
      base,
      mav,
      recoveryBoost,
    );
    out.set(m, {
      muscle: m,
      daysSince: hit ? hit.daysSince : null,
      recoveryDays: r.recoveryDays,
      lastDose: hit?.dose ?? 0,
      readiness: r.readiness,
      state: r.state,
    });
  }
  return out;
}

/** Muscles ready to train now (ready or stale), worst-recovered dropped. */
export function readyMuscles(map: Map<MuscleGroup, MuscleReadiness>): MuscleGroup[] {
  return [...map.values()]
    .filter((r) => r.state === 'ready' || r.state === 'stale')
    .map((r) => r.muscle);
}

/** Muscles still recovering (not yet ready), most-fatigued first. */
export function recoveringMuscles(map: Map<MuscleGroup, MuscleReadiness>): MuscleReadiness[] {
  return [...map.values()]
    .filter((r) => r.state === 'recovering' || r.state === 'nearly')
    .sort((a, b) => a.readiness - b.readiness);
}

/** Muscles trained long enough ago that they're recovered AND under-stimulated. */
export function staleMuscles(map: Map<MuscleGroup, MuscleReadiness>): MuscleReadiness[] {
  return [...map.values()].filter((r) => r.state === 'stale' && r.daysSince !== null);
}

/** CSS colour per readiness state: recovering (ruby) → ready (green), stale
 *  in the lazurite recovery/energy hue. Mirrors the fatigue scale's family. */
export const READINESS_COLOR: Record<ReadyState, string> = {
  recovering: 'var(--color-danger)',
  nearly: 'var(--color-accent)',
  ready: 'var(--color-ok)',
  stale: 'var(--color-kcal)',
};

/** Heatmap tints for the muscles trained in the window (others stay dim). */
export function readinessColors(
  map: Map<MuscleGroup, MuscleReadiness>,
): Partial<Record<MuscleGroup, string>> {
  const out: Partial<Record<MuscleGroup, string>> = {};
  for (const r of map.values()) if (r.daysSince !== null) out[r.muscle] = READINESS_COLOR[r.state];
  return out;
}

export type ReadinessMood = 'fresh' | 'mixed' | 'cooked';

/** A coarse read of the whole body for the day's headline. */
export function readinessMood(map: Map<MuscleGroup, MuscleReadiness>): ReadinessMood {
  const cooling = recoveringMuscles(map).length;
  if (cooling === 0) return 'fresh';
  if (cooling >= 4) return 'cooked';
  return 'mixed';
}
