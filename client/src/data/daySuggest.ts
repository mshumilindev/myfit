/**
 * Day-aware training-day inference (Ex suggestions, AC-1).
 *
 * Pure logic: maps a primary muscle to a training day, infers the session's
 * day from what has been logged (falling back to the weekday split), and picks
 * the day with the most sets. No hard-coded exercise lists — callers feed it
 * muscle set-counts derived from the shared catalog (AC-4.2).
 */
import type { MuscleGroup } from './exercises';

export type TrainingDay = 'push' | 'pull' | 'legs' | 'core' | 'full';

const MUSCLE_DAY: Record<string, TrainingDay> = {
  chest: 'push',
  shoulders: 'push',
  triceps: 'push',
  back: 'pull',
  biceps: 'pull',
  forearms: 'pull',
  quads: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  calves: 'legs',
  core: 'core',
  fullbody: 'full',
};

/** Weekday (0 = Sunday … 6 = Saturday) → the usual split. Friday → Legs. */
const WEEKDAY_DAY: Record<number, TrainingDay> = {
  1: 'push',
  2: 'pull',
  3: 'legs',
  4: 'push',
  5: 'legs',
  6: 'pull',
  0: 'full',
};

export function exerciseDay(primary: MuscleGroup | null | undefined): TrainingDay | null {
  return primary ? (MUSCLE_DAY[primary] ?? null) : null;
}

export function weekdayDay(weekday: number): TrainingDay {
  return WEEKDAY_DAY[weekday] ?? 'full';
}

/** The training day with the most logged sets, or null when nothing is logged. */
export function dayFromCounts(counts: Map<MuscleGroup, number>): TrainingDay | null {
  const byDay = new Map<TrainingDay, number>();
  for (const [m, n] of counts) {
    const d = MUSCLE_DAY[m];
    if (d && n > 0) byDay.set(d, (byDay.get(d) ?? 0) + n);
  }
  let best: TrainingDay | null = null;
  let bestN = 0;
  for (const [d, n] of byDay) {
    if (n > bestN) {
      bestN = n;
      best = d;
    }
  }
  return best;
}
