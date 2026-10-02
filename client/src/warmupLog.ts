/**
 * Warm-up logging helpers (pure). A warm-up is the `kind:'warmup'` marker
 * exercise: a plain generic block (optionally with minutes in
 * `plannedDurationMin`), or — when the athlete added exercises from the library
 * — the same block holding `warmupItems`. Markers never carry sets, so none of
 * this touches volume / PR / set-type stats. Old workouts (and the retired
 * `warmupDetailed` flag, ignored here) read as: items present ⇒ show them,
 * otherwise a generic warm-up.
 *
 * "Repeat last warm-up" reads the user's own (already sealed + synced) workout
 * history — nothing extra is stored anywhere.
 */
import { isCardioExerciseName, richExerciseByName } from './data/exercises';
import type { Exercise, Workout, WarmupItem } from './types';

export const isWarmupMarker = (ex: Exercise): boolean =>
  ex.kind === 'warmup' && ex.sets.length === 0;

/** Holds and the like read in seconds, not reps. */
const HOLD = /plank|hold|wall sit|side bridge|hang|stretch/i;

/**
 * The one value a warm-up exercise is logged with, from what the catalog knows
 * about it: stretches, holds and cardio in seconds, everything else in reps.
 */
export function defaultWarmupValue(name: string): { reps: number } | { durationSec: number } {
  const rich = richExerciseByName(name);
  if (isCardioExerciseName(name) || rich?.category === 'cardio') return { durationSec: 60 };
  if (rich?.category === 'stretching' || HOLD.test(name)) return { durationSec: 30 };
  return { reps: 12 };
}

/** Does this exercise log in seconds (otherwise reps)? */
export function isTimedWarmupName(name: string): boolean {
  return 'durationSec' in defaultWarmupValue(name);
}

function positive(n: unknown): number | undefined {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

/** A load in kg, kept to two decimals (lb entries round-trip through kg). */
export function positiveWeight(n: unknown): number | undefined {
  return typeof n === 'number' && Number.isFinite(n) && n > 0
    ? Math.round(n * 100) / 100
    : undefined;
}

/** Equipment that is loaded with a plate / stack / bell: these get a weight. */
const WEIGHTED_EQUIPMENT = new Set([
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'kettlebell',
  'ezBar',
]);

/**
 * Does a warm-up exercise take a weight? Only loaded equipment does (dumbbell,
 * barbell, machine, cable, kettlebell, EZ bar) — and never a timed move.
 * Bodyweight, bands and everything else log reps only.
 */
export function warmupUsesWeight(name: string): boolean {
  if (isTimedWarmupName(name)) return false;
  const eq = richExerciseByName(name)?.equipment;
  return !!eq && WEIGHTED_EQUIPMENT.has(eq);
}

/** The one set a warm-up exercise is logged with: seconds, or reps (+ weight). */
export interface WarmupValues {
  reps?: number;
  durationSec?: number;
  /** kg */
  weight?: number;
}

/**
 * What the athlete last logged for this warm-up exercise (newest finished
 * session first; only logged items count) — the pre-fill of a new logger.
 */
export function lastWarmupValues(
  workouts: readonly Workout[],
  name: string,
  excludeId?: string,
): WarmupValues | null {
  const needle = name.trim().toLowerCase();
  const rows = workouts
    .filter((w) => w.finishedAt !== null && w.id !== excludeId)
    .sort((a, b) => b.startedAt - a.startedAt);
  for (const w of rows) {
    for (const ex of w.exercises) {
      if (!isWarmupMarker(ex)) continue;
      const hit = warmupItemsOf(ex).find((i) => i.done && i.name.trim().toLowerCase() === needle);
      if (hit)
        return {
          ...(hit.reps ? { reps: hit.reps } : {}),
          ...(hit.durationSec ? { durationSec: hit.durationSec } : {}),
          ...(hit.weight ? { weight: hit.weight } : {}),
        };
    }
  }
  return null;
}

/** The marker's items, tolerant of anything malformed that may sit in storage. */
export function warmupItemsOf(ex: Exercise): WarmupItem[] {
  const raw = ex.warmupItems;
  if (!Array.isArray(raw)) return [];
  const out: WarmupItem[] = [];
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue;
    if (typeof it.id !== 'string' || typeof it.name !== 'string' || !it.name.trim()) continue;
    out.push({
      id: it.id,
      name: it.name,
      ...(typeof it.exerciseId === 'string' ? { exerciseId: it.exerciseId } : {}),
      ...(positive(it.durationSec) ? { durationSec: positive(it.durationSec)! } : {}),
      ...(positive(it.reps) ? { reps: positive(it.reps)! } : {}),
      ...(positiveWeight(it.weight) ? { weight: positiveWeight(it.weight)! } : {}),
      done: it.done === true,
      ...(typeof it.at === 'number' ? { at: it.at } : {}),
    });
  }
  return out;
}

/** Seconds across the logged items. */
export function warmupDoneSeconds(items: readonly WarmupItem[]): number {
  return items.reduce((n, i) => n + (i.done ? (i.durationSec ?? 0) : 0), 0);
}

/** Whole minutes for a number of seconds; 0 stays 0 (nothing to show). */
export function secToMinutes(sec: number): number {
  return sec > 0 ? Math.max(1, Math.round(sec / 60)) : 0;
}

export interface WarmupSummary {
  /** Exercises logged. */
  count: number;
  /** All exercises on the block (0 = a generic warm-up). */
  total: number;
  /** Minutes to show, or null when none was logged. */
  minutes: number | null;
}

/** One reading of a warm-up marker for the session card, summary and history. */
export function warmupSummary(ex: Exercise): WarmupSummary {
  const items = warmupItemsOf(ex);
  if (items.length > 0) {
    const min = secToMinutes(warmupDoneSeconds(items));
    return {
      count: items.filter((i) => i.done).length,
      total: items.length,
      minutes: min > 0 ? min : ex.plannedDurationMin || null,
    };
  }
  return { count: 0, total: 0, minutes: ex.plannedDurationMin || null };
}

export interface LastWarmup {
  items: WarmupItem[];
  minutes: number | null;
  startedAt: number;
}

/** Monday-based weekday index (0–6) of a timestamp, in local time. */
function weekdayOf(ms: number): number {
  return (new Date(ms).getDay() + 6) % 7;
}

/**
 * The warm-up the user logged last time — same named program day first, then the
 * same weekday, then the most recent one. Only finished sessions count.
 */
export function findLastWarmup(
  workouts: readonly Workout[],
  ctx: { dayName?: string | null; weekday?: number; excludeId?: string },
): LastWarmup | null {
  const name = ctx.dayName?.trim().toLowerCase() || null;
  const rows = workouts
    .filter((w) => w.finishedAt !== null && w.id !== ctx.excludeId)
    .map((w) => ({ w, ex: w.exercises.find(isWarmupMarker) }))
    .filter((r): r is { w: Workout; ex: Exercise } => !!r.ex)
    .filter((r) => {
      const s = warmupSummary(r.ex);
      return s.count > 0 || !!s.minutes;
    })
    .sort((a, b) => b.w.startedAt - a.w.startedAt);
  const pick =
    (name && rows.find((r) => r.w.dayName?.trim().toLowerCase() === name)) ||
    (ctx.weekday !== undefined && rows.find((r) => weekdayOf(r.w.startedAt) === ctx.weekday)) ||
    rows[0];
  if (!pick) return null;
  const s = warmupSummary(pick.ex);
  return {
    // Only what was logged is worth repeating.
    items: warmupItemsOf(pick.ex).filter((i) => i.done),
    minutes: s.minutes,
    startedAt: pick.w.startedAt,
  };
}

/** When the first regular strength set (not a warm-up set) was logged. */
export function firstStrengthSetAt(w: Workout): number | null {
  let first: number | null = null;
  for (const e of w.exercises) {
    if (e.kind === 'cardio' || e.kind === 'warmup' || e.kind === 'cooldown') continue;
    if (isCardioExerciseName(e.name)) continue;
    for (const s of e.sets) {
      if (s.isWarmup || s.type === 'warmup' || typeof s.loggedAt !== 'number') continue;
      if (first === null || s.loggedAt < first) first = s.loggedAt;
    }
  }
  return first;
}

/** When the warm-up started: its own stamp, else the session start if it opens the session. */
export function warmupStartMs(ex: Exercise, w: Workout): number | null {
  if (typeof ex.markerAt === 'number' && ex.markerAt > 0) return ex.markerAt;
  const opener = w.exercises.every((e) => e.id === ex.id || e.position > ex.position);
  return opener ? w.startedAt : null;
}

/**
 * Measured warm-up time in seconds: start -> first strength set, else -> finish,
 * else -> `now` while live. A stored `warmupMeasuredSec` wins (frozen). Null when
 * nothing can be measured (legacy data) — never an estimate.
 */
export function warmupMeasuredSec(ex: Exercise, w: Workout, now: number): number | null {
  if (typeof ex.warmupMeasuredSec === 'number' && ex.warmupMeasuredSec >= 0) {
    return ex.warmupMeasuredSec;
  }
  const start = warmupStartMs(ex, w);
  if (start === null) return null;
  const end = firstStrengthSetAt(w) ?? w.finishedAt ?? now;
  return Math.max(0, Math.floor((end - start) / 1000));
}

/** Is the measurement still running (no strength set yet, not finished, not frozen)? */
export function warmupMeasureLive(ex: Exercise, w: Workout): boolean {
  return (
    !(typeof ex.warmupMeasuredSec === 'number') &&
    w.finishedAt === null &&
    firstStrengthSetAt(w) === null &&
    warmupStartMs(ex, w) !== null
  );
}

/** "m:ss" for a measured warm-up. */
export function fmtWarmupClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
