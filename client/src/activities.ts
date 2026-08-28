/**
 * Activities & calories (design feature 6): cardio and recovery logged
 * alongside lifting, so Spotter sees the whole load. Pure over the activity
 * list + a body weight — the catalog (MET + category + icon), a MET-based
 * calorie estimate, and the conditioning/recovery balance that feeds the
 * fatigue model. No store or React imports, so it unit-tests as plain data.
 */
import type { Activity, ActivityCategory, ActivityEffort } from './types';

const DAY = 24 * 3600 * 1000;

export interface ActivityType {
  key: string;
  category: ActivityCategory;
  /** Icon name in the shared Icon set. */
  icon: string;
  /** Metabolic equivalent at moderate effort (compendium-based). */
  met: number;
  /** Whether a distance field is worth offering. */
  tracksDistance?: boolean;
}

/**
 * The catalog. Conditioning adds load; recovery (massage, sauna, cold, mobility)
 * counts as recovery and eases it. MET values are moderate-effort baselines from
 * the Compendium of Physical Activities; effort nudges them at estimate time.
 */
export const ACTIVITY_TYPES: ActivityType[] = [
  {
    key: 'run',
    category: 'conditioning',
    icon: 'person-simple-run',
    met: 9.8,
    tracksDistance: true,
  },
  { key: 'cycle', category: 'conditioning', icon: 'bicycle', met: 7.5, tracksDistance: true },
  {
    key: 'swim',
    category: 'conditioning',
    icon: 'person-simple-swim',
    met: 8.3,
    tracksDistance: true,
  },
  { key: 'row', category: 'conditioning', icon: 'wave-sine', met: 7.0, tracksDistance: true },
  {
    key: 'walk',
    category: 'conditioning',
    icon: 'person-simple-walk',
    met: 3.8,
    tracksDistance: true,
  },
  { key: 'hiit', category: 'conditioning', icon: 'lightning', met: 8.0 },
  { key: 'cardio', category: 'conditioning', icon: 'heartbeat', met: 6.0 },
  { key: 'yoga', category: 'recovery', icon: 'yoga', met: 2.5 },
  { key: 'mobility', category: 'recovery', icon: 'person-simple-tai-chi', met: 2.3 },
  { key: 'massage', category: 'recovery', icon: 'hand-heart', met: 1.3 },
  { key: 'sauna', category: 'recovery', icon: 'fire', met: 1.5 },
  { key: 'cold', category: 'recovery', icon: 'snowflake', met: 1.5 },
];

const BY_KEY = new Map(ACTIVITY_TYPES.map((t) => [t.key, t]));

/** Look up a type by key (unknown keys — from newer clients — return null). */
export function activityType(key: string): ActivityType | null {
  return BY_KEY.get(key) ?? null;
}

/** The category for an activity, trusting its stored value, then its type. */
export function activityCategory(a: Activity): ActivityCategory {
  return a.category ?? activityType(a.type)?.category ?? 'conditioning';
}

/** Elapsed minutes of an activity (stored duration, else start→finish). */
export function durationMin(a: Activity): number {
  if (a.durationMin && a.durationMin > 0) return a.durationMin;
  if (a.finishedAt && a.finishedAt > a.startedAt) return (a.finishedAt - a.startedAt) / 60000;
  return 0;
}

/** Whether an activity is still live (running or paused). */
export function isActivityLive(a: Activity): boolean {
  return a.finishedAt === null;
}

/** Whether a live activity is currently paused. */
export function isActivityPaused(a: Activity): boolean {
  return a.finishedAt === null && !a.runningSince;
}

/** Live elapsed ms of a running/paused activity (banked + current segment). */
export function activityElapsedMs(a: Activity, now: number): number {
  const banked = a.accumulatedMs ?? 0;
  return banked + (a.runningSince ? Math.max(0, now - a.runningSince) : 0);
}

const EFFORT_MULT: Record<ActivityEffort, number> = { light: 0.82, moderate: 1, hard: 1.22 };

/**
 * MET-based energy estimate: kcal ≈ MET · body-mass(kg) · hours, with effort
 * scaling the MET. Returns null when it can't be honest — no body weight, or no
 * time — so the UI degrades to a soft prompt instead of a fake number.
 */
export function estimateCalories(
  type: ActivityType,
  minutes: number,
  bodyKg: number | null | undefined,
  effort: ActivityEffort = 'moderate',
): number | null {
  if (!bodyKg || bodyKg <= 0 || minutes <= 0) return null;
  const met = type.met * (EFFORT_MULT[effort] ?? 1);
  return Math.round(met * bodyKg * (minutes / 60));
}

/** Convenience: estimate for a stored activity. */
export function activityCalories(a: Activity, bodyKg: number | null | undefined): number | null {
  const t = activityType(a.type);
  if (!t) return a.calories ?? null;
  return estimateCalories(t, durationMin(a), bodyKg, a.effort ?? 'moderate');
}

/**
 * Rough calories for a lifting session over its wall-clock duration. A blended
 * MET (~4.0) accounts for the long rests between sets, so the number reads as
 * an honest "energy out", not a peak-effort figure. Null without a body weight.
 */
const LIFT_MET = 4.0;
export function liftingCalories(minutes: number, bodyKg: number | null | undefined): number | null {
  if (!bodyKg || bodyKg <= 0 || minutes <= 0) return null;
  return Math.round(LIFT_MET * bodyKg * (minutes / 60));
}

export interface ActivityWeek {
  conditioningMin: number;
  recoveryMin: number;
  conditioningKcal: number;
  count: number;
}

/** Trailing-window rollup of conditioning vs recovery minutes and kcal. */
export function activityWeek(
  activities: Activity[] | null | undefined,
  now: number,
  bodyKg: number | null | undefined,
  days = 7,
): ActivityWeek {
  const since = now - days * DAY;
  const out: ActivityWeek = {
    conditioningMin: 0,
    recoveryMin: 0,
    conditioningKcal: 0,
    count: 0,
  };
  for (const a of activities ?? []) {
    if (a.startedAt < since) continue;
    out.count++;
    const min = durationMin(a);
    if (activityCategory(a) === 'recovery') {
      out.recoveryMin += min;
    } else {
      out.conditioningMin += min;
      out.conditioningKcal += activityCalories(a, bodyKg) ?? 0;
    }
  }
  return out;
}

/**
 * How activities should tilt the deload read (design: "conditioning & recovery
 * feed the fatigue model"). Positive = recovery-dominant, so hold off a deload;
 * negative = conditioning-heavy on top of lifting, so trigger a touch sooner.
 * Bounded to [-1, 1]; ~1 recovery-point per 3h of recovery work.
 */
export function activityRecoveryBias(
  activities: Activity[] | null | undefined,
  now: number,
  days = 7,
): number {
  const w = activityWeek(activities, now, null, days);
  const raw = (w.recoveryMin * 1.2 - w.conditioningMin) / 180;
  return Math.max(-1, Math.min(1, raw));
}
