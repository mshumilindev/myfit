/**
 * Volume / session aggregates over nested workout documents
 * (users/{uid}/workouts/{wid} with embedded exercises[].sets[]).
 *
 * Volume math matches the client (`client/src/store.ts`): exclude warm-ups,
 * include dropset parts, apply per-hand factor for dumbbells / bilateral cables.
 */
import { db } from './lib';
import EQUIPMENT_BY_NAME from './data/equipment-by-name.json';
import PER_SIDE from './data/per-side.json';

const DAY = 24 * 60 * 60 * 1000;
const E1RM_MAX_REPS = 10;

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
 * Equipment on the exercise doc, catalog name lookup, or a light name heuristic
 * when older sessions lack `equipment`.
 */
export function equipmentFor(ex: Pick<StoredExercise, 'name' | 'equipment'>): string[] {
  if (ex.equipment && ex.equipment.length > 0) return ex.equipment;
  const key = (ex.name ?? '').trim().toLowerCase();
  const fromCatalog = (EQUIPMENT_BY_NAME as Record<string, string>)[key];
  if (fromCatalog) return [fromCatalog];
  const n = key;
  if (/\bdumbbell\b|\bdb\b|гантел/.test(n)) return ['dumbbell'];
  if (/\bcable\b|кабел|блок/.test(n)) return ['cable'];
  if (/\bbarbell\b|\bbb\b|штан/.test(n)) return ['barbell'];
  if (/\bkettlebell\b|\bkb\b|гир/.test(n)) return ['kettlebell'];
  return [];
}

/**
 * Per-side entry doubling — same rules and same data as client `perHandFactor`.
 * The client resolves localized names to their English catalog name first; here
 * the name is matched as stored, so `per-side.json` also lists the localized
 * variants of hand-classified moves.
 */
const ONE_ARM_NAME = /\b(one|single)[- ](arm|hand|leg)\b|unilateral|одн(ією|у|ой)\s*рук/i;
const SINGLE_IMPLEMENT = /goblet|pull[- ]?over|two[- ]?hand|both hands|svend|\bskull\s*crusher\b/i;
const BILATERAL_CABLE = /\bfly(e|es|s)?\b|cross[- ]?over|\biron cross\b|\bpec\b/i;
const PAIRED_KETTLEBELL = /\bdouble\b|two[- ]arm|two kettlebells|alternating|seesaw/i;
const TWO_SIDED = new Set(PER_SIDE.twoSided);
const ONE_SIDED = new Set(PER_SIDE.oneSided);

export function perHandFactor(ex: Pick<StoredExercise, 'name' | 'equipment'>): number {
  const name = ex.name ?? '';
  const key = name.trim().toLowerCase();
  if (ONE_SIDED.has(key)) return 1;
  if (TWO_SIDED.has(key)) return 2;
  if (ONE_ARM_NAME.test(name)) return 1;
  const eq = equipmentFor(ex);
  if (eq.includes('dumbbell')) return SINGLE_IMPLEMENT.test(key) ? 1 : 2;
  if (eq.includes('kettlebell')) return PAIRED_KETTLEBELL.test(key) ? 2 : 1;
  if (eq.includes('cable')) return BILATERAL_CABLE.test(key) ? 2 : 1;
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

export function estimatedOneRepMaxKg(s: StoredSet): number | null {
  const reps = s.reps ?? 0;
  const weight = s.weight ?? 0;
  if (setTypeOf(s) === 'warmup' || weight <= 0 || reps < 1 || reps > E1RM_MAX_REPS) return null;
  return weight * (1 + reps / 30);
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
