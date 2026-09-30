/**
 * How a finished workout went, in a few plain numbers — shared by the post-workout
 * suggestions ("Next up" amenities, "Recovery fuel"). Pure: no store, no React.
 * Only ms-epoch arithmetic, except `hour` (local wall-clock hour of the finish,
 * injectable for tests).
 */
import type { Workout } from './types';
import type { MuscleGroup } from './data/exercises';
import { dayFromCounts } from './data/daySuggest';

export type SessionLevel = 'light' | 'moderate' | 'hard';

export interface SessionProfile {
  /** Working (non-warm-up) sets of strength exercises. */
  strengthSets: number;
  /** Sum of cardio minutes (cardio exercises' set durations). */
  cardioMin: number;
  /** Mean logged/estimated RPE of the working strength sets (null when none). */
  avgRpe: number | null;
  /** Wall-clock length in whole minutes (0 while open without a finish). */
  minutes: number;
  /** Dominant training day (push / pull / legs / core / full) or null. */
  dayType: string | null;
  /** Local hour 0–23 the session finished (or now-ish), null when unknown. */
  hour: number | null;
  level: SessionLevel;
}

const isWorking = (s: { type?: string; isWarmup?: boolean }): boolean =>
  (s.type ?? (s.isWarmup ? 'warmup' : 'working')) !== 'warmup';

/** The workout's dominant training day by working-set count per primary muscle. */
export function workoutDayType(w: Workout): string | null {
  const counts = new Map<MuscleGroup, number>();
  for (const e of w.exercises) {
    if ((e.kind ?? 'strength') !== 'strength' || !e.primaryMuscle) continue;
    const working = e.sets.filter(isWorking);
    const m = e.primaryMuscle as MuscleGroup;
    counts.set(m, (counts.get(m) ?? 0) + Math.max(1, working.length));
  }
  return dayFromCounts(counts);
}

export function sessionProfile(w: Workout, opts: { hour?: number | null } = {}): SessionProfile {
  let strengthSets = 0;
  let cardioMin = 0;
  const rpes: number[] = [];
  for (const e of w.exercises) {
    const kind = e.kind ?? 'strength';
    if (kind === 'cardio') {
      for (const s of e.sets) cardioMin += Math.max(0, s.durationMin ?? 0);
    } else if (kind === 'strength') {
      for (const s of e.sets) {
        if (!isWorking(s)) continue;
        strengthSets += 1;
        const r = s.rpe ?? s.rpeAuto ?? null;
        if (r !== null && r > 0) rpes.push(r);
      }
    }
  }
  const avgRpe = rpes.length
    ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10
    : null;
  const minutes = w.finishedAt ? Math.max(0, Math.round((w.finishedAt - w.startedAt) / 60000)) : 0;
  const dayType = workoutDayType(w);
  const hour =
    opts.hour !== undefined ? opts.hour : w.finishedAt ? new Date(w.finishedAt).getHours() : null;

  let level: SessionLevel = 'moderate';
  if (strengthSets === 0) {
    if (cardioMin >= 60) level = 'hard';
    else if (cardioMin > 0 && cardioMin <= 30) level = 'light';
  } else if (
    strengthSets >= 16 ||
    (avgRpe !== null && avgRpe >= 8.5 && strengthSets >= 8) ||
    (strengthSets >= 12 && dayType === 'legs')
  ) {
    level = 'hard';
  } else if (strengthSets <= 8 && cardioMin < 40 && (avgRpe === null || avgRpe < 7.5)) {
    level = 'light';
  }
  return { strengthSets, cardioMin, avgRpe, minutes, dayType, hour, level };
}
