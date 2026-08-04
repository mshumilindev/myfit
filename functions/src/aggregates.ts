/**
 * Volume / session aggregates over nested workout documents
 * (users/{uid}/workouts/{wid} with embedded exercises[].sets[]).
 *
 * Volume math matches the client (`client/src/store.ts`): exclude warm-ups,
 * include dropset parts, apply per-hand factor for dumbbells / bilateral cables.
 */
import { db } from './lib';

const DAY = 24 * 60 * 60 * 1000;

export interface StoredDrop {
  reps?: number;
  weight?: number | null;
}
export interface StoredSet {
  reps?: number;
  weight?: number | null;
  isWarmup?: boolean;
  type?: 'working' | 'warmup' | 'drop' | 'reverse-drop';
  drops?: StoredDrop[];
}
export interface StoredExercise {
  kind?: string;
  name?: string;
  equipment?: string[];
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

type SetType = 'working' | 'warmup' | 'drop' | 'reverse-drop';

function setTypeOf(s: StoredSet): SetType {
  return s.type ?? (s.isWarmup ? 'warmup' : 'working');
}

function setDrops(s: StoredSet): StoredDrop[] {
  const t = setTypeOf(s);
  return t === 'drop' || t === 'reverse-drop' ? (s.drops ?? []) : [];
}

/** Working-set volume for one set (warm-ups = 0; drop parts included). */
export function setVolumeKg(s: StoredSet): number {
  if (setTypeOf(s) === 'warmup') return 0;
  const reps = s.reps ?? 0;
  return (
    (s.weight ?? 0) * reps + setDrops(s).reduce((v, d) => v + (d.weight ?? 0) * (d.reps ?? 0), 0)
  );
}

/**
 * Equipment on the exercise doc, or a light name heuristic when older sessions
 * lack `equipment` (full catalog lives only on the client).
 */
export function equipmentFor(ex: Pick<StoredExercise, 'name' | 'equipment'>): string[] {
  if (ex.equipment && ex.equipment.length > 0) return ex.equipment;
  const n = (ex.name ?? '').toLowerCase();
  if (/\bdumbbell\b|\bdb\b|гантел/.test(n)) return ['dumbbell'];
  if (/\bcable\b|кабел|блок/.test(n)) return ['cable'];
  if (/\bbarbell\b|\bbb\b|штан/.test(n)) return ['barbell'];
  if (/\bkettlebell\b|\bkb\b|гир/.test(n)) return ['kettlebell'];
  return [];
}

/** Per-side entry doubling — same rules as client `perHandFactor`. */
const ONE_ARM_NAME = /\b(one|single)[- ](arm|hand|leg)\b|unilateral|одн(ією|у|ой)\s*рук/i;
const SINGLE_DUMBBELL = /goblet|pull[- ]?over|two[- ]?hand|both hands|svend|\bskull\s*crusher\b/i;
const BILATERAL_CABLE = /\bflye?\b|cross[- ]?over|pec\b/i;

export function perHandFactor(ex: Pick<StoredExercise, 'name' | 'equipment'>): number {
  const eq = equipmentFor(ex);
  const name = ex.name ?? '';
  if (ONE_ARM_NAME.test(name)) return 1;
  if (eq.includes('dumbbell')) return SINGLE_DUMBBELL.test(name) ? 1 : 2;
  if (eq.includes('cable')) return BILATERAL_CABLE.test(name) ? 2 : 1;
  return 1;
}

export function exerciseVolumeKg(ex: StoredExercise): number {
  const raw = (ex.sets ?? []).reduce((v, s) => v + setVolumeKg(s), 0);
  return raw * perHandFactor(ex);
}

/** { strength set count, strength volume with per-hand / drops / no warm-ups }. */
export function workoutStrengthStats(w: StoredWorkout): { sets: number; volumeKg: number } {
  let sets = 0;
  let volumeKg = 0;
  for (const e of w.exercises ?? []) {
    if (!isStrength(e)) continue;
    sets += (e.sets ?? []).length;
    volumeKg += exerciseVolumeKg(e);
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
