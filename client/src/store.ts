/**
 * Tracker store — Firestore-native.
 *
 * A workout is a single document at users/{uid}/workouts/{wid} with its
 * exercises/sets nested inline (matching the in-memory shape). Reads come from
 * live onSnapshot listeners; writes go straight to Firestore, whose offline
 * persistence queues and replays them automatically — so the old hand-rolled
 * localStorage mutation queue is gone. Every mutation still patches in-memory
 * state first for instant UI; the snapshot reconciles to canonical data.
 *
 * All the pure/derived helpers (volume, per-hand, supersets, muscles, records)
 * are unchanged — they operate on the in-memory workouts array.
 */
import { useSyncExternalStore } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  AUTO_FINISH_MS,
  type DropEntry,
  type Exercise,
  type ExerciseKind,
  type Gym,
  type QueuedMutation,
  type Reminder,
  type SetEntry,
  type SetType,
  type SyncStatus,
  type SyncError,
  type Workout,
} from './types';
import {
  muscleInfoByName,
  registerCustomExercise,
  registerCustomExercises,
  type CustomExercise,
  type MuscleGroup,
} from './data/exercises';
import { currentUid, getRole } from './api';

const STATE_KEY = 'spotter.state';
const GYMS_KEY = 'spotter.gyms';
const REMINDERS_KEY = 'spotter.reminders';

export interface StoreState {
  workouts: Workout[];
  gyms: Gym[];
  reminders: Reminder[];
  /** Retained for compatibility; always empty (Firestore handles queueing). */
  queue: QueuedMutation[];
  syncStatus: SyncStatus;
  syncError: SyncError | null;
  lastSyncAt: number | null;
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

let state: StoreState = {
  workouts: load<Workout[]>(STATE_KEY, []),
  gyms: load<Gym[]>(GYMS_KEY, []),
  reminders: load<Reminder[]>(REMINDERS_KEY, []),
  queue: [],
  syncStatus: 'pending',
  syncError: null,
  lastSyncAt: null,
};

// Pings & dismissals feed reminder computation; kept outside StoreState.
let pings: Array<{ gymId: string; at: number }> = [];
let dismissals: Array<{ gymId: string; visitStart: number }> = [];

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

function persist(): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state.workouts));
    localStorage.setItem(GYMS_KEY, JSON.stringify(state.gyms));
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(state.reminders));
  } catch {
    /* quota / private mode — Firestore cache is the real store */
  }
}

function setState(patch: Partial<StoreState>): void {
  state = { ...state, ...patch };
  persist();
  emit();
}

export function useStore(): StoreState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

export const uuid = (): string => crypto.randomUUID();

export function exerciseKind(ex: Exercise): ExerciseKind {
  return ex.kind ?? 'strength';
}
export function isStrengthExercise(ex: Exercise): boolean {
  return exerciseKind(ex) === 'strength';
}
export function isTimedExercise(ex: Exercise): boolean {
  return exerciseKind(ex) !== 'strength';
}

// --- Set types & drops (design DS-1…DS-4, EQ-4) ----------------------------

export function setTypeOf(s: SetEntry): SetType {
  return s.type ?? (s.isWarmup ? 'warmup' : 'working');
}
export function setDrops(s: SetEntry): DropEntry[] {
  const t = setTypeOf(s);
  return t === 'drop' || t === 'reverse-drop' ? (s.drops ?? []) : [];
}
export function setRepsTotal(s: SetEntry): number {
  return s.reps + setDrops(s).reduce((n, d) => n + d.reps, 0);
}
export function setVolumeKg(s: SetEntry): number {
  if (setTypeOf(s) === 'warmup') return 0;
  return (s.weight ?? 0) * s.reps + setDrops(s).reduce((v, d) => v + (d.weight ?? 0) * d.reps, 0);
}

/**
 * Per-side entry doubling (unchanged from the pre-Firebase store):
 *  - Dumbbells double by default; single-dumbbell / one-arm variants stay ×1.
 *  - Cables: single-stack ×1; bilateral two-cable moves (fly, crossover) ×2.
 */
const ONE_ARM_NAME = /\b(one|single)[- ](arm|hand|leg)\b|unilateral|одн(ією|у|ой)\s*рук/i;
const SINGLE_DUMBBELL = /goblet|pull[- ]?over|two[- ]?hand|both hands|svend|\bskull\s*crusher\b/i;
const BILATERAL_CABLE = /\bflye?\b|cross[- ]?over|pec\b/i;

export function perHandFactor(ex: Pick<Exercise, 'name' | 'equipment'>): number {
  const eq = equipmentFor(ex);
  const name = ex.name;
  if (ONE_ARM_NAME.test(name)) return 1;
  if (eq.includes('dumbbell')) return SINGLE_DUMBBELL.test(name) ? 1 : 2;
  if (eq.includes('cable')) return BILATERAL_CABLE.test(name) ? 2 : 1;
  return 1;
}

export function exerciseVolumeKg(ex: Exercise): number {
  return ex.sets.reduce((v, s) => v + setVolumeKg(s), 0) * perHandFactor(ex);
}

// --- Supersets (design SS-1…SS-3) ------------------------------------------

export interface SupersetGroup {
  groupId: string;
  letter: string;
  exercises: Exercise[];
}
export type SessionBlock =
  { kind: 'single'; exercise: Exercise } | { kind: 'group'; group: SupersetGroup };

export function sessionBlocks(w: Workout): SessionBlock[] {
  const sorted = [...w.exercises].sort((a, b) => a.position - b.position);
  const seen = new Set<string>();
  const blocks: SessionBlock[] = [];
  let letterIdx = 0;
  for (const ex of sorted) {
    const gid = ex.groupId ?? null;
    if (!gid) {
      blocks.push({ kind: 'single', exercise: ex });
      continue;
    }
    if (seen.has(gid)) continue;
    seen.add(gid);
    const members = sorted
      .filter((e) => (e.groupId ?? null) === gid)
      .sort((a, b) => (a.groupOrder ?? 0) - (b.groupOrder ?? 0));
    if (members.length < 2) {
      blocks.push({ kind: 'single', exercise: ex });
      continue;
    }
    blocks.push({
      kind: 'group',
      group: { groupId: gid, letter: String.fromCharCode(65 + letterIdx++), exercises: members },
    });
  }
  return blocks;
}

export function nextSupersetLetter(w: Workout): string {
  const used = sessionBlocks(w).filter((b) => b.kind === 'group').length;
  return String.fromCharCode(65 + used);
}
export function groupRounds(g: SupersetGroup): number {
  return Math.max(
    1,
    ...g.exercises.map((e) => Math.max(e.sets.length, Math.max(0, e.plannedSets ?? 0))),
  );
}
export function groupCurrentRound(g: SupersetGroup): number {
  const done = Math.min(...g.exercises.map((e) => e.sets.length));
  return Math.min(done + 1, groupRounds(g));
}

export function groupAsSuperset(workoutId: string, exerciseIds: string[]): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w || exerciseIds.length < 2) return;
  const gid = uuid();
  const next = w.exercises.map((e) => {
    const order = exerciseIds.indexOf(e.id);
    return order < 0 ? e : { ...e, groupId: gid, groupOrder: order };
  });
  patchWorkout(workoutId, { exercises: next });
  saveWorkout(workoutId);
}

export function ungroupSuperset(workoutId: string, groupId: string): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) return;
  const next = w.exercises.map((e) =>
    e.groupId === groupId ? { ...e, groupId: null, groupOrder: null } : e,
  );
  patchWorkout(workoutId, { exercises: next });
  saveWorkout(workoutId);
}

// --- Muscle groups (design MG-1…MG-5, EQ-4) --------------------------------

export interface ResolvedMuscles {
  primary: MuscleGroup | null;
  secondary: MuscleGroup[];
}

export function resolveMuscles(
  ex: Pick<Exercise, 'name' | 'primaryMuscle' | 'secondaryMuscles' | 'kind'>,
): ResolvedMuscles {
  if (ex.primaryMuscle) {
    return {
      primary: ex.primaryMuscle as MuscleGroup,
      secondary: (ex.secondaryMuscles ?? []) as MuscleGroup[],
    };
  }
  if ((ex.kind ?? 'strength') !== 'strength') return { primary: null, secondary: [] };
  const info = muscleInfoByName(ex.name);
  if (!info || info.primary === 'cardio') return { primary: null, secondary: [] };
  return { primary: info.primary, secondary: info.secondary };
}

export function muscleSetsInWorkout(w: Workout): Map<MuscleGroup, number> {
  const m = new Map<MuscleGroup, number>();
  for (const e of w.exercises) {
    if (!isStrengthExercise(e)) continue;
    const { primary } = resolveMuscles(e);
    if (!primary) continue;
    m.set(primary, (m.get(primary) ?? 0) + e.sets.length);
  }
  return m;
}

export function muscleVolumeKg(workouts: Workout[]): Map<MuscleGroup, number> {
  const m = new Map<MuscleGroup, number>();
  for (const w of workouts) {
    for (const e of w.exercises) {
      if (!isStrengthExercise(e)) continue;
      const { primary } = resolveMuscles(e);
      if (!primary) continue;
      m.set(primary, (m.get(primary) ?? 0) + exerciseVolumeKg(e));
    }
  }
  return m;
}

export function workoutEquipment(w: Workout): string[] {
  const out: string[] = [];
  for (const e of w.exercises)
    for (const id of equipmentFor(e)) if (!out.includes(id)) out.push(id);
  return out;
}

export function equipmentFor(ex: Pick<Exercise, 'name' | 'equipment'>): string[] {
  if (ex.equipment && ex.equipment.length > 0) return ex.equipment;
  const info = muscleInfoByName(ex.name);
  return info?.equipment ? [info.equipment] : [];
}

export function exerciseNeeds(name: string): string[] {
  const needle = name.trim().toLowerCase();
  const out: string[] = [];
  const info = muscleInfoByName(name);
  if (info?.equipment) out.push(info.equipment);
  for (const w of state.workouts) {
    for (const e of w.exercises) {
      if (e.name.trim().toLowerCase() !== needle) continue;
      for (const id of e.equipment ?? []) if (!out.includes(id)) out.push(id);
    }
  }
  return out;
}

export function missingAtGym(gym: Gym | null | undefined, needs: string[]): string[] {
  if (!gym?.inventory || gym.inventory.length === 0) return [];
  return needs.filter((id) => !gym.inventory!.includes(id));
}

interface ExercisePlan {
  plannedSets?: number | null;
  plannedReps?: number | null;
  plannedDurationMin?: number | null;
  equipment?: string[];
  groupId?: string | null;
  groupOrder?: number | null;
  primaryMuscle?: string | null;
  secondaryMuscles?: string[];
}

// --- Firestore writes -------------------------------------------------------

function onWriteError(err: unknown): void {
  const code = (err as { code?: string })?.code ?? '';
  if (code === 'permission-denied') {
    setState({
      syncStatus: 'failed',
      syncError: { status: 403, statusLine: 'Firestore write rejected (permission-denied)' },
    });
  }
  // Transient errors: Firestore retries automatically; nothing to do.
}

function writeWorkoutDoc(w: Workout): void {
  const uid = currentUid();
  if (!uid) return;
  setDoc(doc(db, 'users', uid, 'workouts', w.id), { ...w, updatedAt: Date.now() }).catch(
    onWriteError,
  );
}
function saveWorkout(id: string): void {
  const w = state.workouts.find((x) => x.id === id);
  if (w) writeWorkoutDoc(w);
}
function deleteWorkoutDoc(id: string): void {
  const uid = currentUid();
  if (!uid) return;
  deleteDoc(doc(db, 'users', uid, 'workouts', id)).catch(onWriteError);
}
function writeGymDoc(g: Gym): void {
  const uid = currentUid();
  if (!uid) return;
  setDoc(doc(db, 'users', uid, 'gyms', g.id), { ...g, updatedAt: Date.now() }).catch(onWriteError);
}
function deleteGymDoc(id: string): void {
  const uid = currentUid();
  if (!uid) return;
  deleteDoc(doc(db, 'users', uid, 'gyms', id)).catch(onWriteError);
}
function writePingDoc(id: string, gymId: string, at: number): void {
  const uid = currentUid();
  if (!uid) return;
  setDoc(doc(db, 'users', uid, 'pings', id), { gymId, at }).catch(onWriteError);
}
function writeDismissalDoc(gymId: string, visitStart: number): void {
  const uid = currentUid();
  if (!uid) return;
  setDoc(doc(db, 'users', uid, 'reminderDismissals', `${gymId}:${visitStart}`), {
    gymId,
    visitStart,
  }).catch(onWriteError);
}

function sortWorkouts(ws: Workout[]): Workout[] {
  return [...ws].sort((a, b) => b.startedAt - a.startedAt);
}

function bumpPending(): SyncStatus {
  if (state.syncStatus === 'failed') return 'failed';
  return navigator.onLine ? 'pending' : 'offline';
}

/** Mirrors the 8h auto-finish rule locally (also runs offline). */
export function applyAutoFinish(): void {
  const now = Date.now();
  const changed: string[] = [];
  const workouts = state.workouts.map((w) => {
    if (w.finishedAt === null && w.startedAt + AUTO_FINISH_MS <= now) {
      changed.push(w.id);
      return { ...w, finishedAt: w.startedAt + AUTO_FINISH_MS, autoFinished: true };
    }
    return w;
  });
  if (changed.length) {
    setState({ workouts, syncStatus: bumpPending() });
    for (const id of changed) saveWorkout(id);
  }
}

export function getOpenWorkout(): Workout | undefined {
  return state.workouts.find((w) => w.finishedAt === null);
}

export function startWorkout(gymId: string | null = null): Workout {
  applyAutoFinish();
  const now = Date.now();
  const closed: string[] = [];
  const workouts = state.workouts.map((w) => {
    if (w.finishedAt === null) {
      closed.push(w.id);
      return { ...w, finishedAt: now, autoFinished: true };
    }
    return w;
  });
  const workout: Workout = {
    id: uuid(),
    startedAt: now,
    finishedAt: null,
    autoFinished: false,
    gymId,
    exercises: [],
  };
  setState({ workouts: sortWorkouts([workout, ...workouts]), syncStatus: bumpPending() });
  for (const id of closed) saveWorkout(id);
  writeWorkoutDoc(workout);
  return workout;
}

function patchWorkout(id: string, patch: Partial<Workout>): void {
  const workouts = state.workouts.map((w) => (w.id === id ? { ...w, ...patch } : w));
  setState({ workouts: sortWorkouts(workouts), syncStatus: bumpPending() });
}

export function finishWorkout(id: string, at = Date.now()): void {
  if (!state.workouts.find((x) => x.id === id)) return;
  patchWorkout(id, { finishedAt: at, autoFinished: false });
  saveWorkout(id);
}

export function updateWorkoutTimes(
  id: string,
  startedAt: number,
  finishedAt: number | null,
  autoFinished: boolean,
): void {
  patchWorkout(id, { startedAt, finishedAt, autoFinished });
  saveWorkout(id);
}

export function attachGymToWorkout(workoutId: string, gymId: string | null): void {
  if (!state.workouts.find((x) => x.id === workoutId)) return;
  patchWorkout(workoutId, { gymId });
  saveWorkout(workoutId);
}

export function reorderExercises(workoutId: string, orderedIds: string[]): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) return;
  const byId = new Map(w.exercises.map((e) => [e.id, e]));
  const next = orderedIds
    .map((id, i) => {
      const e = byId.get(id);
      return e ? { ...e, position: i } : null;
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);
  if (next.length !== w.exercises.length) return;
  patchWorkout(workoutId, { exercises: next });
  saveWorkout(workoutId);
}

export function deleteWorkout(id: string): void {
  setState({ workouts: state.workouts.filter((w) => w.id !== id), syncStatus: bumpPending() });
  deleteWorkoutDoc(id);
}

export function addExercise(
  workoutId: string,
  name: string,
  kind: ExerciseKind = 'strength',
  plan: ExercisePlan = {},
): Exercise {
  const w = state.workouts.find((x) => x.id === workoutId);
  const info = kind === 'strength' ? muscleInfoByName(name) : null;
  const exercise: Exercise = {
    id: uuid(),
    name,
    kind,
    position: w ? w.exercises.length : 0,
    plannedSets: plan.plannedSets ?? null,
    plannedReps: plan.plannedReps ?? null,
    plannedDurationMin: plan.plannedDurationMin ?? null,
    equipment: plan.equipment ?? (info?.equipment ? [info.equipment] : []),
    groupId: plan.groupId ?? null,
    groupOrder: plan.groupOrder ?? null,
    primaryMuscle: plan.primaryMuscle ?? (info && info.primary !== 'cardio' ? info.primary : null),
    secondaryMuscles: plan.secondaryMuscles ?? (info ? info.secondary : []),
    sets: [],
  };
  patchWorkout(workoutId, { exercises: [...(w?.exercises ?? []), exercise] });
  saveWorkout(workoutId);
  return exercise;
}

export function renameExercise(workoutId: string, exerciseId: string, name: string): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w?.exercises.find((e) => e.id === exerciseId)) return;
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) => (e.id === exerciseId ? { ...e, name } : e)),
  });
  saveWorkout(workoutId);
}

export function deleteExercise(workoutId: string, exerciseId: string): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) return;
  patchWorkout(workoutId, { exercises: w.exercises.filter((e) => e.id !== exerciseId) });
  saveWorkout(workoutId);
}

export function upsertSet(
  workoutId: string,
  exerciseId: string,
  set: Omit<SetEntry, 'id' | 'position'> & { id?: string },
): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  const ex = w?.exercises.find((e) => e.id === exerciseId);
  if (!w || !ex) return;
  const existing = set.id ? ex.sets.find((s) => s.id === set.id) : undefined;
  const type: SetType = set.type ?? (set.isWarmup ? 'warmup' : 'working');
  const full: SetEntry = {
    id: set.id ?? uuid(),
    reps: set.reps,
    weight: set.weight,
    isWarmup: type === 'warmup',
    type,
    drops: type === 'drop' || type === 'reverse-drop' ? (set.drops ?? []) : [],
    durationMin: set.durationMin ?? null,
    distanceKm: set.distanceKm ?? null,
    calories: set.calories ?? null,
    rpe: set.rpe ?? null,
    position: existing ? existing.position : ex.sets.length,
  };
  const sets = existing ? ex.sets.map((s) => (s.id === full.id ? full : s)) : [...ex.sets, full];
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) => (e.id === exerciseId ? { ...e, sets } : e)),
  });
  saveWorkout(workoutId);
}

export function addDropToSet(
  workoutId: string,
  exerciseId: string,
  setId: string,
  drop: DropEntry,
  reverse = false,
): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  const ex = w?.exercises.find((e) => e.id === exerciseId);
  const s = ex?.sets.find((x) => x.id === setId);
  if (!w || !ex || !s) return;
  const type: SetType =
    setTypeOf(s) === 'drop' || setTypeOf(s) === 'reverse-drop'
      ? setTypeOf(s)
      : reverse
        ? 'reverse-drop'
        : 'drop';
  upsertSet(workoutId, exerciseId, { ...s, id: s.id, type, drops: [...(s.drops ?? []), drop] });
}

export function deleteSet(workoutId: string, exerciseId: string, setId: string): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) return;
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) =>
      e.id === exerciseId ? { ...e, sets: e.sets.filter((s) => s.id !== setId) } : e,
    ),
  });
  saveWorkout(workoutId);
}

// --- Gyms & presence -------------------------------------------------------

export function upsertGym(gym: Omit<Gym, 'id'> & { id?: string }): Gym {
  const full: Gym = { id: gym.id ?? uuid(), ...gym };
  const exists = state.gyms.some((g) => g.id === full.id);
  setState({
    gyms: exists ? state.gyms.map((g) => (g.id === full.id ? full : g)) : [...state.gyms, full],
    syncStatus: bumpPending(),
  });
  writeGymDoc(full);
  return full;
}

export function toggleFavorite(id: string): void {
  const g = state.gyms.find((x) => x.id === id);
  if (!g) return;
  upsertGym({ ...g, favorite: !g.favorite });
}

export function deleteGym(id: string): void {
  setState({ gyms: state.gyms.filter((g) => g.id !== id), syncStatus: bumpPending() });
  deleteGymDoc(id);
}

export function dismissReminder(r: Reminder): void {
  dismissals = [...dismissals, { gymId: r.gymId, visitStart: r.visitStart }];
  setState({
    reminders: state.reminders.filter(
      (x) => !(x.gymId === r.gymId && x.visitStart === r.visitStart),
    ),
    syncStatus: bumpPending(),
  });
  writeDismissalDoc(r.gymId, r.visitStart);
}

export function logVisitAsWorkout(r: Reminder): Workout {
  const workout: Workout = {
    id: uuid(),
    startedAt: r.visitStart,
    finishedAt: r.visitEnd,
    autoFinished: false,
    gymId: r.gymId,
    exercises: [],
  };
  setState({
    workouts: sortWorkouts([workout, ...state.workouts]),
    reminders: state.reminders.filter(
      (x) => !(x.gymId === r.gymId && x.visitStart === r.visitStart),
    ),
    syncStatus: bumpPending(),
  });
  writeWorkoutDoc(workout);
  return workout;
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const LAST_PING_KEY = 'spotter.lastPingAt';
const PING_EVERY_MS = 5 * 60 * 1000;

export function recordPresence(): void {
  if (state.gyms.length === 0 || !('geolocation' in navigator)) return;
  const last = Number(localStorage.getItem(LAST_PING_KEY) ?? 0);
  if (Date.now() - last < PING_EVERY_MS) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      if (accuracy > 500) return;
      const gym = state.gyms.find(
        (g) => haversineM(latitude, longitude, g.lat, g.lng) <= g.radiusM + accuracy,
      );
      if (!gym) return;
      localStorage.setItem(LAST_PING_KEY, String(Date.now()));
      writePingDoc(uuid(), gym.id, Date.now());
    },
    () => {
      /* denied — stay quiet */
    },
    { enableHighAccuracy: false, maximumAge: 120_000, timeout: 10_000 },
  );
}

export function getCurrentPositionOnce(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Геолокація недоступна в цьому браузері'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? 'Доступ до геолокації заборонено. Дозволь його в налаштуваннях браузера.'
              : 'Не вдалося визначити локацію',
          ),
        ),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}

// --- Reminders (computed client-side from own pings + workouts) ------------

const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const VISIT_GAP_MS = 45 * 60 * 1000;
const MIN_VISIT_MS = 60 * 60 * 1000;
const OVERLAP_SLACK_MS = 30 * 60 * 1000;

function computeReminders(now = Date.now()): Reminder[] {
  const recent = pings
    .filter((p) => p.at >= now - LOOKBACK_MS)
    .sort((a, b) => a.gymId.localeCompare(b.gymId) || a.at - b.at);
  if (recent.length === 0) return [];
  const gymNames = new Map(state.gyms.map((g) => [g.id, g.name]));
  const dismissed = new Set(dismissals.map((d) => `${d.gymId}:${d.visitStart}`));
  const out: Reminder[] = [];
  let visit: { gymId: string; start: number; end: number } | null = null;

  const flush = (v: { gymId: string; start: number; end: number }) => {
    if (v.end - v.start < MIN_VISIT_MS) return;
    if (dismissed.has(`${v.gymId}:${v.start}`)) return;
    const overlaps = state.workouts.some((w) => {
      const wEnd = w.finishedAt ?? now;
      return w.startedAt <= v.end + OVERLAP_SLACK_MS && wEnd >= v.start - OVERLAP_SLACK_MS;
    });
    if (overlaps) return;
    out.push({
      gymId: v.gymId,
      gymName: gymNames.get(v.gymId) ?? 'зал',
      visitStart: v.start,
      visitEnd: v.end,
    });
  };

  for (const p of recent) {
    if (!visit || visit.gymId !== p.gymId || p.at - visit.end > VISIT_GAP_MS) {
      if (visit) flush(visit);
      visit = { gymId: p.gymId, start: p.at, end: p.at };
    } else {
      visit.end = p.at;
    }
  }
  if (visit) flush(visit);
  return out.sort((a, b) => b.visitStart - a.visitStart);
}

function recomputeReminders(): void {
  setState({ reminders: computeReminders() });
}

// --- Live listeners (replaces the old sync loop) ---------------------------

let unsubs: Unsubscribe[] = [];
let presenceTimer: ReturnType<typeof setInterval> | null = null;

function markSynced(fromCache: boolean, hasPending: boolean): void {
  const status: SyncStatus = hasPending
    ? navigator.onLine
      ? 'pending'
      : 'offline'
    : fromCache && !navigator.onLine
      ? 'offline'
      : 'synced';
  const patch: Partial<StoreState> = {
    syncStatus: state.syncStatus === 'failed' ? 'failed' : status,
  };
  if (status === 'synced') {
    patch.lastSyncAt = Date.now();
    patch.syncError = null;
    if (state.syncStatus === 'failed') patch.syncStatus = 'synced';
  }
  setState(patch);
}

export function startSyncLoop(): () => void {
  const uid = currentUid();
  if (!uid) return () => undefined;
  stopListeners();

  unsubs.push(
    onSnapshot(
      collection(db, 'users', uid, 'workouts'),
      (snap) => {
        state = {
          ...state,
          workouts: sortWorkouts(snap.docs.map((d) => d.data() as Workout)),
        };
        recomputeReminders();
        markSynced(snap.metadata.fromCache, snap.metadata.hasPendingWrites);
        applyAutoFinish();
      },
      onWriteError,
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'users', uid, 'gyms'),
      (snap) => {
        state = { ...state, gyms: snap.docs.map((d) => d.data() as Gym) };
        recomputeReminders();
        emit();
      },
      onWriteError,
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'users', uid, 'pings'),
      (snap) => {
        pings = snap.docs.map((d) => d.data() as { gymId: string; at: number });
        recomputeReminders();
      },
      onWriteError,
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'users', uid, 'reminderDismissals'),
      (snap) => {
        dismissals = snap.docs.map((d) => d.data() as { gymId: string; visitStart: number });
        recomputeReminders();
      },
      onWriteError,
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'exerciseCatalog'),
      (snap) => {
        registerCustomExercises(snap.docs.map((d) => d.data() as CustomExercise));
        emit();
      },
      () => undefined,
    ),
  );

  const tick = () => {
    applyAutoFinish();
    recordPresence();
  };
  presenceTimer = setInterval(tick, 15_000);
  window.addEventListener('online', tick);
  window.addEventListener('focus', tick);
  tick();

  return () => stopListeners();
}

function stopListeners(): void {
  for (const u of unsubs) u();
  unsubs = [];
  if (presenceTimer) {
    clearInterval(presenceTimer);
    presenceTimer = null;
  }
}

/** No-op kept for compatibility — Firestore syncs continuously on its own. */
export async function sync(): Promise<void> {
  /* writes flush automatically; nothing to drain */
}

/** No-ops kept for API/UI compatibility — Firestore retries writes itself. */
export function retrySync(): void {
  setState({ syncStatus: navigator.onLine ? 'pending' : 'offline', syncError: null });
}
export function discardBlockingChange(): void {
  setState({ syncStatus: navigator.onLine ? 'pending' : 'offline', syncError: null });
}

// --- Shared exercise catalog -----------------------------------------------

export function saveCatalogExercise(meta: {
  name: string;
  kind?: string;
  primaryMuscle: MuscleGroup | null;
  secondaryMuscles: MuscleGroup[];
  equipment: string[];
}): void {
  const role = getRole();
  if (role !== 'admin' && role !== 'trainer') return;
  const id = meta.name.trim().toLowerCase();
  registerCustomExercise({ id: `pending-${id}`, ...meta });
  emit();
  const uid = currentUid();
  if (!uid) return;
  // Rules gate this to trainer/admin; id is the lowercased name (uniqueness).
  setDoc(doc(db, 'exerciseCatalog', id), {
    id,
    name: meta.name.trim(),
    kind: meta.kind ?? 'strength',
    primaryMuscle: meta.primaryMuscle,
    secondaryMuscles: meta.secondaryMuscles,
    equipment: meta.equipment,
    createdBy: uid,
    updatedAt: Date.now(),
  })
    .then(() => registerCustomExercise({ id, ...meta }))
    .catch(onWriteError);
}

export function updateExerciseMeta(
  workoutId: string,
  exerciseId: string,
  meta: { primaryMuscle: MuscleGroup | null; secondaryMuscles: MuscleGroup[]; equipment: string[] },
): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  const ex = w?.exercises.find((e) => e.id === exerciseId);
  if (!w || !ex) return;
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) =>
      e.id === exerciseId
        ? {
            ...e,
            primaryMuscle: meta.primaryMuscle,
            secondaryMuscles: meta.secondaryMuscles,
            equipment: meta.equipment,
          }
        : e,
    ),
  });
  saveWorkout(workoutId);
}

// --- Derived data for the designed UI (ghost rows, PRs, compare) -----------

export interface PrevLift {
  reps: number;
  weight: number | null;
}

export function setTopWeight(s: SetEntry): number {
  return Math.max(s.weight ?? 0, ...setDrops(s).map((d) => d.weight ?? 0));
}
export function topSet(sets: SetEntry[]): SetEntry | undefined {
  return [...sets]
    .filter((s) => setTypeOf(s) !== 'warmup')
    .sort((a, b) => setTopWeight(b) - setTopWeight(a) || b.reps - a.reps)[0];
}
export function lastSessionWith(
  name: string,
  beforeWorkoutId?: string,
): { workout: Workout; exercise: Exercise } | undefined {
  const needle = name.trim().toLowerCase();
  for (const w of state.workouts) {
    if (w.id === beforeWorkoutId || w.finishedAt === null) continue;
    const ex = w.exercises.find(
      (e) => isStrengthExercise(e) && e.name.trim().toLowerCase() === needle,
    );
    if (ex && ex.sets.length > 0) return { workout: w, exercise: ex };
  }
  return undefined;
}
export function prevLift(name: string, currentWorkoutId?: string): PrevLift | undefined {
  const found = lastSessionWith(name, currentWorkoutId);
  if (!found) return undefined;
  const top = topSet(found.exercise.sets) ?? found.exercise.sets[found.exercise.sets.length - 1];
  return top ? { reps: top.reps, weight: top.weight } : undefined;
}
export function recordWeight(name: string, excludeWorkoutId?: string): number {
  const needle = name.trim().toLowerCase();
  let max = 0;
  for (const w of state.workouts) {
    if (w.id === excludeWorkoutId) continue;
    for (const e of w.exercises) {
      if (!isStrengthExercise(e) || e.name.trim().toLowerCase() !== needle) continue;
      for (const s of e.sets)
        if (setTypeOf(s) !== 'warmup' && setTopWeight(s) > max) max = setTopWeight(s);
    }
  }
  return max;
}
export function est1rm(weight: number, reps: number): number {
  return Math.round(weight * (1 + reps / 30));
}
export function knownExercises(): { name: string; last?: PrevLift }[] {
  const seen = new Map<string, PrevLift | undefined>();
  for (const w of state.workouts) {
    for (const e of w.exercises) {
      if (!isStrengthExercise(e)) continue;
      const key = e.name.trim();
      if (!key || seen.has(key.toLowerCase())) continue;
      const top = topSet(e.sets) ?? e.sets[e.sets.length - 1];
      seen.set(key.toLowerCase(), top ? { reps: top.reps, weight: top.weight } : undefined);
    }
  }
  const out: { name: string; last?: PrevLift }[] = [];
  for (const w of state.workouts) {
    for (const e of w.exercises) {
      if (!isStrengthExercise(e)) continue;
      const key = e.name.trim();
      if (!key || out.some((o) => o.name.toLowerCase() === key.toLowerCase())) continue;
      out.push({ name: key, last: seen.get(key.toLowerCase()) });
    }
  }
  return out;
}

export function workoutSets(w: Workout): number {
  return w.exercises.reduce((n, e) => n + (isStrengthExercise(e) ? e.sets.length : 0), 0);
}
export function workoutVolumeKg(w: Workout): number {
  return w.exercises.reduce((v, e) => v + (isStrengthExercise(e) ? exerciseVolumeKg(e) : 0), 0);
}
export function workoutCardioMinutes(w: Workout): number {
  return w.exercises.reduce(
    (n, e) =>
      n +
      (isTimedExercise(e) ? e.sets.reduce((s, x) => s + Math.max(0, x.durationMin ?? 0), 0) : 0),
    0,
  );
}
export function workoutCardioDistanceKm(w: Workout): number {
  return w.exercises.reduce(
    (n, e) =>
      n + (isTimedExercise(e) ? e.sets.reduce((s, x) => s + Math.max(0, x.distanceKm ?? 0), 0) : 0),
    0,
  );
}

// --- Undo (reversible deletes re-insert via idempotent upserts) ------------

export function restoreSet(workoutId: string, exerciseId: string, set: SetEntry): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  const ex = w?.exercises.find((e) => e.id === exerciseId);
  if (!w || !ex) return;
  const sets = [...ex.sets, set].sort((a, b) => a.position - b.position);
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) => (e.id === exerciseId ? { ...e, sets } : e)),
  });
  saveWorkout(workoutId);
}

export function restoreExercise(workoutId: string, exercise: Exercise): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) return;
  patchWorkout(workoutId, {
    exercises: [...w.exercises, exercise].sort((a, b) => a.position - b.position),
  });
  saveWorkout(workoutId);
}

export function clearSets(workoutId: string, exerciseId: string): SetEntry[] {
  const w = state.workouts.find((x) => x.id === workoutId);
  const ex = w?.exercises.find((e) => e.id === exerciseId);
  if (!w || !ex) return [];
  const removed = ex.sets;
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) => (e.id === exerciseId ? { ...e, sets: [] } : e)),
  });
  saveWorkout(workoutId);
  return removed;
}

export function duplicateExercise(workoutId: string, exerciseId: string): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  const ex = w?.exercises.find((e) => e.id === exerciseId);
  if (!w || !ex) return;
  const copy: Exercise = {
    id: uuid(),
    name: ex.name,
    kind: exerciseKind(ex),
    position: w.exercises.length,
    plannedSets: ex.plannedSets ?? null,
    plannedReps: ex.plannedReps ?? null,
    plannedDurationMin: ex.plannedDurationMin ?? null,
    equipment: ex.equipment ?? [],
    primaryMuscle: ex.primaryMuscle ?? null,
    secondaryMuscles: ex.secondaryMuscles ?? [],
    sets: ex.sets.map((s, i) => ({ ...s, id: uuid(), position: i })),
  };
  restoreExercise(workoutId, copy);
}

export function finishWorkoutClean(id: string): Workout | undefined {
  const w = state.workouts.find((x) => x.id === id);
  if (!w) return undefined;
  const kept = w.exercises.filter((e) => e.sets.length > 0);
  if (kept.length !== w.exercises.length) patchWorkout(id, { exercises: kept });
  finishWorkout(id);
  return state.workouts.find((x) => x.id === id);
}

export function reopenWorkout(id: string): void {
  if (!state.workouts.find((x) => x.id === id)) return;
  patchWorkout(id, { finishedAt: null, autoFinished: false });
  saveWorkout(id);
}

export function backfillWorkout(
  startedAt: number,
  durationMs: number,
  gymId: string | null = null,
): Workout {
  const workout: Workout = {
    id: uuid(),
    startedAt,
    finishedAt: startedAt + durationMs,
    autoFinished: false,
    gymId,
    exercises: [],
  };
  setState({ workouts: sortWorkouts([workout, ...state.workouts]), syncStatus: bumpPending() });
  writeWorkoutDoc(workout);
  return workout;
}

export function repeatWorkout(sourceId: string): Workout | undefined {
  const src = state.workouts.find((x) => x.id === sourceId);
  if (!src) return undefined;
  const w = startWorkout();
  for (const e of [...src.exercises].sort((a, b) => a.position - b.position)) {
    addExercise(w.id, e.name, exerciseKind(e));
  }
  return state.workouts.find((x) => x.id === w.id);
}

export function resetLocalData(): void {
  stopListeners();
  localStorage.removeItem(STATE_KEY);
  localStorage.removeItem(GYMS_KEY);
  localStorage.removeItem(REMINDERS_KEY);
  pings = [];
  dismissals = [];
  state = {
    workouts: [],
    gyms: [],
    reminders: [],
    queue: [],
    syncStatus: 'pending',
    syncError: null,
    lastSyncAt: null,
  };
  emit();
}

export function __getStateForTests(): StoreState {
  return structuredClone(state);
}
export function __replaceStateForTests(next: StoreState): void {
  state = structuredClone(next);
  persist();
  emit();
}
