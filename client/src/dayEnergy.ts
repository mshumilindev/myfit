/**
 * Daily resting-energy model. Turns body metrics + an automatically inferred
 * lifestyle level into a whole-day baseline burn, so energy readouts count what
 * the body spends just living — not only the calories of logged workouts.
 *
 * The lifestyle level is derived from how often the athlete actually trains and
 * does conditioning, mapped to a NEAT (non-exercise activity) multiplier on BMR.
 * That multiplier deliberately stays in a modest range because logged workouts
 * and activities are still counted on top: the baseline is "everything but the
 * session", the session is added separately, and the two never double-count.
 *
 * Pure over its inputs (no store or React imports) so it unit-tests as data.
 */
import type { Activity, BodyMetrics, LifestyleLevel, Workout } from './types';
import { bmrKcal } from './energy';
import { activityCategory, durationMin } from './activities';

const DAY_MS = 24 * 3600 * 1000;

/** NEAT multiplier on BMR per lifestyle band (structured exercise excluded — it
 *  is added on top from the actual logged sessions). */
export const NEAT_FACTOR: Record<LifestyleLevel, number> = {
  sedentary: 1.2,
  light: 1.3,
  moderate: 1.4,
  active: 1.5,
};

export interface Lifestyle {
  level: LifestyleLevel;
  factor: number;
  /** Effective training + conditioning sessions per week over the window. */
  perWeek: number;
}

/**
 * Infer the lifestyle band from training + conditioning frequency over a
 * trailing window. Recovery-only activities (sauna, massage, mobility) don't
 * count toward how active a life is. A longer window (28 days) keeps the band
 * from flipping on a single busy or quiet week.
 */
export function autoLifestyle(
  workouts: Workout[] | null | undefined,
  activities: Activity[] | null | undefined,
  now: number = Date.now(),
  windowDays = 28,
): Lifestyle {
  const since = now - windowDays * DAY_MS;
  let sessions = 0;
  for (const w of workouts ?? []) {
    if (w.finishedAt !== null && w.startedAt >= since && w.startedAt <= now) sessions++;
  }
  for (const a of activities ?? []) {
    if (
      a.finishedAt !== null &&
      a.startedAt >= since &&
      a.startedAt <= now &&
      activityCategory(a) === 'conditioning' &&
      durationMin(a) > 0
    )
      sessions++;
  }
  const perWeek = sessions / (windowDays / 7);
  const level: LifestyleLevel =
    perWeek < 1 ? 'sedentary' : perWeek < 3 ? 'light' : perWeek < 5 ? 'moderate' : 'active';
  return { level, factor: NEAT_FACTOR[level], perWeek };
}

/**
 * Whole-day baseline burn = round(BMR * NEAT factor * fraction). `fraction`
 * prorates a partial (still-running) day; a completed day uses 1. Null when BMR
 * can't be computed honestly (incomplete body metrics).
 */
export function restingDayKcal(
  bmr: number | null | undefined,
  factor: number,
  fraction = 1,
): number | null {
  if (!bmr || bmr <= 0 || factor <= 0 || fraction <= 0) return null;
  return Math.round(bmr * factor * Math.min(1, fraction));
}

/** Fraction of the local day that has elapsed at `now` (0..1). `dayStartMs` is
 *  local midnight of that day. Days fully in the past return 1, future days 0. */
export function dayElapsedFraction(dayStartMs: number, now: number = Date.now()): number {
  const f = (now - dayStartMs) / DAY_MS;
  return Math.max(0, Math.min(1, f));
}

/** Body weight (kg) in effect at `ts` — the most recent weigh-in on or before
 *  `ts`, falling back to the earliest recorded weigh-in when `ts` predates them
 *  all. Null when no weigh-ins exist. */
export function weightAsOfKg(bm: BodyMetrics | null | undefined, ts: number): number | null {
  const ws = bm?.weights;
  if (!ws || ws.length === 0) return null;
  let best: { at: number; weight: number } | null = null;
  for (const w of ws) if (w.at <= ts && (!best || w.at > best.at)) best = w;
  if (best) return best.weight;
  return ws.reduce((a, b) => (b.at < a.at ? b : a)).weight;
}

/**
 * Whole-day resting/baseline burn for one calendar day, computed on the fly from
 * data already in the store — no persistence. Uses the body weight and age in
 * effect at that day and the lifestyle inferred from the training/conditioning
 * frequency in the trailing window ending that day. A completed past day counts
 * a full day; today is prorated by how much of it has elapsed; future days and
 * days without enough body data return null.
 *
 * `dayStartMs` is local midnight of the day.
 */
export function restingForDay(
  bm: BodyMetrics | null | undefined,
  workouts: Workout[] | null | undefined,
  activities: Activity[] | null | undefined,
  dayStartMs: number,
  now: number = Date.now(),
): number | null {
  if (dayStartMs > now) return null;
  const dayEnd = dayStartMs + DAY_MS;
  // Evaluate weight, age and lifestyle as of the end of the day (capped at now).
  const ref = Math.min(dayEnd, now);
  const bodyKg = weightAsOfKg(bm, ref);
  if (!bodyKg) return null;
  const bmr = bmrKcal(bm, bodyKg, ref);
  if (!bmr) return null;
  const ls = autoLifestyle(workouts, activities, ref);
  const fraction = now < dayEnd ? dayElapsedFraction(dayStartMs, now) : 1;
  return restingDayKcal(bmr, ls.factor, fraction);
}
