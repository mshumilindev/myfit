/**
 * The max the person's history implies for an exercise (Periodization chunk), computed live from the logged sets every time it
 * is asked, so it follows the training: a new heavy set raises it at once, with no stored copy to go stale.
 *
 * Rules, the same as the records use: Epley (`est1rm`: weight × (1 + reps / 30), sets of 1–10 reps), warm-ups excluded, drop
 * parts counted, the exercise matched by name (case and spacing ignored). "Recent" means the last RECENT_DAYS; when nothing
 * was lifted in that window the best of all time is used instead and flagged as older.
 */
import { est1rm } from '../store';
import { setDrops, setTypeOf } from '../setMath';
import type { Exercise, Workout } from '../types';

/** How far back "your best recent sets" reaches. */
export const RECENT_DAYS = 90;
const DAY_MS = 86_400_000;

export interface BestSet {
  weight: number;
  reps: number;
  /** The estimated one-rep max this set implies, kg. */
  e1rm: number;
  /** When it was logged (the workout's start, ms). */
  at: number;
}

const isStrength = (e: Exercise): boolean => (e.kind ?? 'strength') === 'strength';

/** The set (or drop part) with the highest estimated max for an exercise, from `since` (ms) on; null when there is none. */
export function bestSetIn(workouts: readonly Workout[], name: string, since = 0): BestSet | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  let best: BestSet | null = null;
  for (const w of workouts) {
    if (w.startedAt < since) continue;
    for (const e of w.exercises) {
      if (!isStrength(e) || e.name.trim().toLowerCase() !== needle) continue;
      for (const s of e.sets) {
        if (setTypeOf(s) === 'warmup') continue;
        const parts = [{ weight: s.weight, reps: s.reps }, ...setDrops(s)];
        for (const p of parts) {
          const v = est1rm(p.weight ?? 0, p.reps);
          if (v > 0 && (!best || v > best.e1rm))
            best = { weight: p.weight as number, reps: p.reps, e1rm: v, at: w.startedAt };
        }
      }
    }
  }
  return best;
}

export interface HistoryMax {
  set: BestSet;
  /** No set in the recent window: this is the best of all time. */
  older: boolean;
}

/** The max the history implies at `now`: the best recent set, else the best ever (flagged older), else null. */
export function historyMax(
  workouts: readonly Workout[],
  name: string,
  now: number = Date.now(),
): HistoryMax | null {
  const recent = bestSetIn(workouts, name, now - RECENT_DAYS * DAY_MS);
  if (recent) return { set: recent, older: false };
  const ever = bestSetIn(workouts, name);
  return ever ? { set: ever, older: true } : null;
}
