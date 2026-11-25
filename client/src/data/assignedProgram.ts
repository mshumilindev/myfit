/**
 * What the assigned program prescribes for the current week, read from the in-memory assignment (cached from Today).
 * The week is the cycle week when Periodization is live, else the program's own (`periodizationApi.weekPlanFor`).
 */
import type { MuscleGroup } from './exercises';
import { cycleLiveFor, weekPlanFor, type WeekSource } from '../periodizationApi';
import { readProgramMemory } from './programMemory';

export interface CachedAssignment {
  program: {
    dayNames?: Record<string, string>;
    targetMuscles?: Record<string, MuscleGroup[]>;
    items?: { day: number }[];
  };
  week?: number;
  /** When program week 1 began (the assignment, moved back for a later start week). */
  startedAt?: number;
}
export function readAssignment(): CachedAssignment | null {
  try {
    return readProgramMemory<CachedAssignment>(); // memory only: the on-device copy is the sealed snapshot
  } catch {
    return null;
  }
}

/** The days of the assignment's current week. */
export const assignedWeek = (a: CachedAssignment) =>
  weekPlanFor(a.program as unknown as WeekSource, a.week ?? 1);

/** Weekdays (1–7) the assigned program prescribes training on (items or target
 *  muscles). Empty when there is no cached program. Drives "missed" markers. */
export function prescribedTrainingDays(): Set<number> {
  const a = readAssignment();
  const set = new Set<number>();
  if (!a) return set;
  const wk = assignedWeek(a);
  for (const it of wk.items ?? []) set.add(it.day);
  for (const [k, v] of Object.entries(wk.targetMuscles ?? {})) {
    if (Array.isArray(v) && v.length > 0) set.add(Number(k));
  }
  return set;
}

/** How many days back a "missed" marker is trustworthy — roughly since the
 *  program began (bounded by its current week), matching programDayNameFor.
 *  With a live weekly cycle the plan on hand is only the current week's, so older days are not judged against it
 *  (a deload week must not flag last week's days as missed): the lookback stops at the start of the current week. */
export function programLookbackDays(now: number = Date.now()): number {
  const a = readAssignment();
  if (!a) return 0;
  const full = (a.week ?? 1) * 7 + 6;
  if (!cycleLiveFor(a.program as unknown as WeekSource) || !a.startedAt) return full;
  const into = Math.max(0, Math.floor((now - a.startedAt) / 86_400_000)) % 7;
  return Math.min(full, into);
}

/** The assigned program's day name for a weekday (1=Mon…7=Sun), or null. Used to
 *  name a missed gym day ("you skipped Legs 2"). */
export function programDayNameForWeekday(weekday: number): string | null {
  const a = readAssignment();
  return a ? (assignedWeek(a).dayNames?.[String(weekday)] ?? null) : null;
}
