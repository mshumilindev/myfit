/**
 * Volume / session aggregates, reimplemented over the nested workout documents
 * (users/{uid}/workouts/{wid} with embedded exercises[].sets[]) in place of the
 * old SQL SUM/COUNT joins. Parity note: like the server, these count *raw*
 * reps × weight for strength exercises (warm-ups included, no per-hand factor
 * and no drops) — the app's richer per-hand volume math stays client-side.
 */
import { db } from './lib';

const DAY = 24 * 60 * 60 * 1000;

export interface StoredSet {
  reps?: number;
  weight?: number | null;
  isWarmup?: boolean;
}
export interface StoredExercise {
  kind?: string;
  sets?: StoredSet[];
}
export interface StoredWorkout {
  id: string;
  startedAt: number;
  finishedAt: number | null;
  autoFinished?: boolean;
  gymId?: string | null;
  exercises?: StoredExercise[];
}

function isStrength(e: StoredExercise): boolean {
  return (e.kind ?? 'strength') === 'strength';
}

/** { strength set count, raw strength volume } for one workout. */
export function workoutStrengthStats(w: StoredWorkout): { sets: number; volumeKg: number } {
  let sets = 0;
  let volumeKg = 0;
  for (const e of w.exercises ?? []) {
    if (!isStrength(e)) continue;
    for (const s of e.sets ?? []) {
      sets += 1;
      volumeKg += (s.reps ?? 0) * (s.weight ?? 0);
    }
  }
  return { sets, volumeKg };
}

export async function listUserWorkouts(uid: string, limit?: number): Promise<StoredWorkout[]> {
  let q = db.collection('users').doc(uid).collection('workouts').orderBy('startedAt', 'desc');
  if (limit) q = q.limit(limit);
  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StoredWorkout, 'id'>) }));
}

export function volume30d(workouts: StoredWorkout[], now = Date.now()): number {
  const cutoff = now - 30 * DAY;
  let v = 0;
  for (const w of workouts) if (w.startedAt >= cutoff) v += workoutStrengthStats(w).volumeKg;
  return v;
}

export function lastSession(workouts: StoredWorkout[]): {
  at: number | null;
  live: boolean;
  liveStartedAt: number | null;
} {
  // `workouts` is newest-first.
  const w = workouts[0];
  if (!w) return { at: null, live: false, liveStartedAt: null };
  const live = w.finishedAt === null;
  return { at: w.startedAt, live, liveStartedAt: live ? w.startedAt : null };
}
