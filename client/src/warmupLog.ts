/**
 * Warm-up logging helpers (pure). A warm-up is the `kind:'warmup'` marker
 * exercise — either ONE single block (the classic marker, optionally with
 * minutes in `plannedDurationMin`) or split into specific moves
 * (`warmupDetailed` + `warmupItems`). Markers never carry sets, so none of this
 * touches volume / PR / set-type stats. Old workouts without the new fields are
 * simply "single".
 *
 * "Repeat last warm-up" reads the user's own (already sealed + synced) workout
 * history — nothing extra is stored anywhere.
 */
import type { MuscleGroup } from './data/exercises';
import type { Exercise, Workout, WarmupItem } from './types';

const isWarmupMarker = (ex: Exercise): boolean => ex.kind === 'warmup' && ex.sets.length === 0;

/** A detailed warm-up: a warm-up marker the user chose to split into moves. */
export function isDetailedWarmup(ex: Exercise): boolean {
  return isWarmupMarker(ex) && ex.warmupDetailed === true;
}

function positive(n: unknown): number | undefined {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
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
      done: it.done === true,
      ...(typeof it.at === 'number' ? { at: it.at } : {}),
    });
  }
  return out;
}

/** Seconds across the items that were actually done. */
export function warmupDoneSeconds(items: readonly WarmupItem[]): number {
  return items.reduce((n, i) => n + (i.done ? (i.durationSec ?? 0) : 0), 0);
}

/** Whole minutes for a number of seconds; 0 stays 0 (nothing to show). */
export function secToMinutes(sec: number): number {
  return sec > 0 ? Math.max(1, Math.round(sec / 60)) : 0;
}

export interface WarmupSummary {
  detailed: boolean;
  /** Items ticked off (detailed only). */
  count: number;
  /** All items on the list (detailed only). */
  total: number;
  /** Minutes to show, or null when none was logged. */
  minutes: number | null;
}

/** One reading of a warm-up marker for the session card, summary and history. */
export function warmupSummary(ex: Exercise): WarmupSummary {
  if (isDetailedWarmup(ex)) {
    const items = warmupItemsOf(ex);
    const min = secToMinutes(warmupDoneSeconds(items));
    return {
      detailed: true,
      count: items.filter((i) => i.done).length,
      total: items.length,
      minutes: min > 0 ? min : ex.plannedDurationMin || null,
    };
  }
  return { detailed: false, count: 0, total: 0, minutes: ex.plannedDurationMin || null };
}

export interface LastWarmup {
  detailed: boolean;
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
      return s.detailed ? s.total > 0 : !!s.minutes;
    })
    .sort((a, b) => b.w.startedAt - a.w.startedAt);
  const pick =
    (name && rows.find((r) => r.w.dayName?.trim().toLowerCase() === name)) ||
    (ctx.weekday !== undefined && rows.find((r) => weekdayOf(r.w.startedAt) === ctx.weekday)) ||
    rows[0];
  if (!pick) return null;
  const s = warmupSummary(pick.ex);
  return {
    detailed: s.detailed,
    items: s.detailed ? warmupItemsOf(pick.ex) : [],
    minutes: s.minutes,
    startedAt: pick.w.startedAt,
  };
}

/** Today's weekday in the same Monday-based index. */
export const weekdayIndex = (ms: number): number => weekdayOf(ms);

/**
 * Primary muscles of the session's first lifts (or the program day's muscle
 * targets) — what the warm-up suggestions aim at. Empty when nothing says.
 */
export function dayMuscles(w: Workout, max = 3): MuscleGroup[] {
  const out: MuscleGroup[] = [];
  const add = (m: string | null | undefined) => {
    if (m && !out.includes(m as MuscleGroup)) out.push(m as MuscleGroup);
  };
  for (const m of w.targetMuscles ?? []) add(m);
  if (out.length) return out.slice(0, max);
  for (const e of [...w.exercises].sort((a, b) => a.position - b.position)) {
    if (e.kind === 'warmup' || e.kind === 'cooldown' || e.kind === 'cardio') continue;
    add(e.primaryMuscle);
    if (out.length >= max) break;
  }
  return out;
}
