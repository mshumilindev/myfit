/**
 * Weak-point radar (design "Weak points", feature #2). The volume view is a
 * snapshot of THIS week; this reads the trend — muscles that have sat under
 * their minimum effective volume across most of the last several weeks are
 * chronically neglected, not just light this week. A second lens flags a
 * strength pattern that lags its neighbours (e.g. bench a tier below squat).
 *
 * Pure over the finished-workout history + (optionally) the strength standards.
 */
import { muscleSetsInWorkout } from './store';
import { LANDMARKS, VOLUME_MUSCLES, type Landmark } from './volume';
import type { Workout } from './types';
import type { MuscleGroup } from './data/exercises';

const DAY = 24 * 3600 * 1000;
const WEEK = 7 * DAY;

export interface WeakPoint {
  muscle: MuscleGroup;
  /** Weeks under MEV among the tracked (trained) weeks. */
  weeksUnder: number;
  /** Weeks in the window with any training logged. */
  weeksTracked: number;
  /** Average weekly working sets over the tracked weeks. */
  avgSets: number;
  mev: number;
  /** 0..1 — how neglected: how often, and how far under. */
  severity: number;
}

/** Sets per muscle within one half-open week window [lo, hi). */
function weekSets(finished: Workout[], lo: number, hi: number): Map<MuscleGroup, number> {
  const out = new Map<MuscleGroup, number>();
  for (const w of finished) {
    if (w.startedAt < lo || w.startedAt >= hi) continue;
    for (const [m, n] of muscleSetsInWorkout(w)) out.set(m, (out.get(m) ?? 0) + n);
  }
  return out;
}

/**
 * Chronically under-volumed muscles over the trailing `weeks`. A muscle counts
 * as a weak point when it sat under MEV in most of the weeks the athlete
 * actually trained (so a rest week doesn't frame everything as neglected), and
 * there's enough history to trust it. Sorted most-severe first.
 */
export function volumeWeakPoints(
  finished: Workout[],
  now: number,
  weeks = 6,
  landmarks?: ReadonlyMap<MuscleGroup, Landmark>,
): WeakPoint[] {
  const done = finished.filter((w) => w.finishedAt !== null);
  // Per-week set maps, newest window first.
  const buckets: Map<MuscleGroup, number>[] = [];
  for (let k = 0; k < weeks; k++) {
    const hi = now - k * WEEK;
    buckets.push(weekSets(done, hi - WEEK, hi));
  }
  const trackedWeeks = buckets.filter((b) => [...b.values()].some((v) => v > 0)).length;
  if (trackedWeeks < 3) return []; // not enough history to call anything chronic

  // Per-muscle weekly sets over the weeks the athlete actually trained.
  const trained = buckets.filter((b) => [...b.values()].some((v) => v > 0));
  const out: WeakPoint[] = [];
  for (const m of VOLUME_MUSCLES) {
    const lm = landmarks?.get(m) ?? (LANDMARKS[m] as Landmark);
    if (lm.mev <= 0) continue; // no meaningful floor (e.g. core) → skip
    const weekly = trained.map((b) => b.get(m) ?? 0);
    const wp = classifyWeakPoint(weekly, lm.mev);
    if (wp) out.push({ muscle: m, ...wp });
  }
  return out.sort((a, b) => b.severity - a.severity);
}

/**
 * Decide whether a muscle's per-(trained-)week set counts make it a chronic weak
 * point. Pure: no history/store needed, so it's directly testable. Returns the
 * weak-point fields (minus the muscle) or null when it's not chronically under.
 */
export function classifyWeakPoint(
  weeklySets: number[],
  mev: number,
): Omit<WeakPoint, 'muscle'> | null {
  const tracked = weeklySets.length;
  if (tracked < 3 || mev <= 0) return null;
  const under = weeklySets.filter((s) => s < mev).length;
  const total = weeklySets.reduce((a, b) => a + b, 0);
  const share = under / tracked;
  if (share < 0.6) return null; // under most weeks, or not a weak point
  const avgSets = total / tracked;
  const depth = Math.max(0, 1 - avgSets / mev); // how far under, on average
  return {
    weeksUnder: under,
    weeksTracked: tracked,
    avgSets: Math.round(avgSets * 10) / 10,
    mev,
    severity: Math.min(1, share * 0.6 + depth * 0.4),
  };
}

export interface StrengthGap {
  /** The lagging lift's discipline key (e.g. 'bench'). */
  lift: string;
  /** The strongest of the compared lifts. */
  strongest: string;
  /** Tiers behind the strongest (>=1). */
  behind: number;
}

/**
 * A strength-pattern imbalance from the big-three classification: the lift that
 * sits a full tier or more below the strongest of the three, when all are
 * trained. Feed it the `results` from computeStandards. Null when balanced or
 * under-trained. Kept structural (no import) so it doesn't couple to standards.
 */
export function strengthImbalance(
  results: { key: string; trained: boolean; achievedIdx: number }[],
): StrengthGap | null {
  const keys = ['squat', 'bench', 'deadlift'];
  const three = results.filter((r) => keys.includes(r.key) && r.trained);
  if (three.length < 3) return null;
  const strongest = three.reduce((a, b) => (b.achievedIdx > a.achievedIdx ? b : a));
  const weakest = three.reduce((a, b) => (b.achievedIdx < a.achievedIdx ? b : a));
  const behind = strongest.achievedIdx - weakest.achievedIdx;
  if (behind < 1) return null;
  return { lift: weakest.key, strongest: strongest.key, behind };
}
