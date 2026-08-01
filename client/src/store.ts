import { useSyncExternalStore } from 'react';
import {
  AUTO_FINISH_MS,
  type Exercise,
  type Gym,
  type QueuedMutation,
  type Reminder,
  type SetEntry,
  type SyncStatus,
  type Workout,
} from './types';
import { HttpError, getToken, request } from './api';

const STATE_KEY = 'gym.state';
const QUEUE_KEY = 'gym.queue';
const GYMS_KEY = 'gym.gyms';
const REMINDERS_KEY = 'gym.reminders';

export interface StoreState {
  workouts: Workout[];
  gyms: Gym[];
  reminders: Reminder[];
  queue: QueuedMutation[];
  syncStatus: SyncStatus;
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
  queue: load<QueuedMutation[]>(QUEUE_KEY, []),
  syncStatus: 'pending',
  lastSyncAt: null,
};

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

function persist(): void {
  localStorage.setItem(STATE_KEY, JSON.stringify(state.workouts));
  localStorage.setItem(GYMS_KEY, JSON.stringify(state.gyms));
  localStorage.setItem(REMINDERS_KEY, JSON.stringify(state.reminders));
  localStorage.setItem(QUEUE_KEY, JSON.stringify(state.queue));
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

// --- Local mutations (optimistic, queued for the server) -------------------

function enqueue(method: QueuedMutation['method'], url: string, body?: unknown): void {
  state.queue.push({ id: uuid(), method, url, body, queuedAt: Date.now() });
}

function sortWorkouts(ws: Workout[]): Workout[] {
  return [...ws].sort((a, b) => b.startedAt - a.startedAt);
}

/**
 * Mirrors the server's 8h rule locally so it also works offline:
 * open workouts older than 8h get finishedAt = startedAt + 8h + auto flag.
 */
export function applyAutoFinish(): void {
  const now = Date.now();
  let changed = false;
  const workouts = state.workouts.map((w) => {
    if (w.finishedAt === null && w.startedAt + AUTO_FINISH_MS <= now) {
      changed = true;
      const closed: Workout = {
        ...w,
        finishedAt: w.startedAt + AUTO_FINISH_MS,
        autoFinished: true,
      };
      enqueue('PUT', `/api/tracker/workouts/${w.id}`, {
        startedAt: closed.startedAt,
        finishedAt: closed.finishedAt,
        autoFinished: true,
      });
      return closed;
    }
    return w;
  });
  if (changed) setState({ workouts, syncStatus: bumpPending() });
}

export function getOpenWorkout(): Workout | undefined {
  return state.workouts.find((w) => w.finishedAt === null);
}

function bumpPending(): SyncStatus {
  return navigator.onLine ? 'pending' : 'offline';
}

export function startWorkout(): Workout {
  applyAutoFinish();
  const now = Date.now();
  // Starting a new workout closes any still-open one (marked as auto).
  const workouts = state.workouts.map((w) => {
    if (w.finishedAt === null) {
      const closed: Workout = { ...w, finishedAt: now, autoFinished: true };
      enqueue('PUT', `/api/tracker/workouts/${w.id}`, {
        startedAt: closed.startedAt,
        finishedAt: closed.finishedAt,
        autoFinished: true,
      });
      return closed;
    }
    return w;
  });
  const workout: Workout = {
    id: uuid(),
    startedAt: now,
    finishedAt: null,
    autoFinished: false,
    exercises: [],
  };
  enqueue('PUT', `/api/tracker/workouts/${workout.id}`, {
    startedAt: workout.startedAt,
    finishedAt: null,
    autoFinished: false,
  });
  setState({
    workouts: sortWorkouts([workout, ...workouts]),
    syncStatus: bumpPending(),
  });
  void sync();
  return workout;
}

function patchWorkout(id: string, patch: Partial<Workout>): void {
  const workouts = state.workouts.map((w) => (w.id === id ? { ...w, ...patch } : w));
  setState({ workouts: sortWorkouts(workouts), syncStatus: bumpPending() });
}

export function finishWorkout(id: string, at = Date.now()): void {
  const w = state.workouts.find((x) => x.id === id);
  if (!w) return;
  patchWorkout(id, { finishedAt: at, autoFinished: false });
  enqueue('PUT', `/api/tracker/workouts/${id}`, {
    startedAt: w.startedAt,
    finishedAt: at,
    autoFinished: false,
  });
  persist();
  void sync();
}

/** Edit workout times (allowed even after it's finished). */
export function updateWorkoutTimes(
  id: string,
  startedAt: number,
  finishedAt: number | null,
  autoFinished: boolean,
): void {
  patchWorkout(id, { startedAt, finishedAt, autoFinished });
  enqueue('PUT', `/api/tracker/workouts/${id}`, { startedAt, finishedAt, autoFinished });
  persist();
  void sync();
}

export function deleteWorkout(id: string): void {
  setState({
    workouts: state.workouts.filter((w) => w.id !== id),
    syncStatus: bumpPending(),
  });
  enqueue('DELETE', `/api/tracker/workouts/${id}`);
  persist();
  void sync();
}

export function addExercise(workoutId: string, name: string): Exercise {
  const w = state.workouts.find((x) => x.id === workoutId);
  const exercise: Exercise = {
    id: uuid(),
    name,
    position: w ? w.exercises.length : 0,
    sets: [],
  };
  patchWorkout(workoutId, {
    exercises: [...(w?.exercises ?? []), exercise],
  });
  enqueue('PUT', `/api/tracker/workouts/${workoutId}/exercises/${exercise.id}`, {
    name,
    position: exercise.position,
  });
  persist();
  void sync();
  return exercise;
}

export function renameExercise(workoutId: string, exerciseId: string, name: string): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) return;
  const ex = w.exercises.find((e) => e.id === exerciseId);
  if (!ex) return;
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) => (e.id === exerciseId ? { ...e, name } : e)),
  });
  enqueue('PUT', `/api/tracker/workouts/${workoutId}/exercises/${exerciseId}`, {
    name,
    position: ex.position,
  });
  persist();
  void sync();
}

export function deleteExercise(workoutId: string, exerciseId: string): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) return;
  patchWorkout(workoutId, {
    exercises: w.exercises.filter((e) => e.id !== exerciseId),
  });
  enqueue('DELETE', `/api/tracker/exercises/${exerciseId}`);
  persist();
  void sync();
}

export function upsertSet(
  workoutId: string,
  exerciseId: string,
  set: Omit<SetEntry, 'id' | 'position'> & { id?: string },
): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) return;
  const ex = w.exercises.find((e) => e.id === exerciseId);
  if (!ex) return;
  const existing = set.id ? ex.sets.find((s) => s.id === set.id) : undefined;
  const full: SetEntry = {
    id: set.id ?? uuid(),
    reps: set.reps,
    weight: set.weight,
    isWarmup: set.isWarmup,
    position: existing ? existing.position : ex.sets.length,
  };
  const sets = existing ? ex.sets.map((s) => (s.id === full.id ? full : s)) : [...ex.sets, full];
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) => (e.id === exerciseId ? { ...e, sets } : e)),
  });
  enqueue('PUT', `/api/tracker/exercises/${exerciseId}/sets/${full.id}`, {
    reps: full.reps,
    weight: full.weight,
    isWarmup: full.isWarmup,
    position: full.position,
  });
  persist();
  void sync();
}

export function deleteSet(workoutId: string, exerciseId: string, setId: string): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) return;
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) =>
      e.id === exerciseId ? { ...e, sets: e.sets.filter((s) => s.id !== setId) } : e,
    ),
  });
  enqueue('DELETE', `/api/tracker/sets/${setId}`);
  persist();
  void sync();
}

// --- Gyms & presence -------------------------------------------------------

export function upsertGym(gym: Omit<Gym, 'id'> & { id?: string }): Gym {
  const full: Gym = { id: gym.id ?? uuid(), ...gym };
  const exists = state.gyms.some((g) => g.id === full.id);
  setState({
    gyms: exists ? state.gyms.map((g) => (g.id === full.id ? full : g)) : [...state.gyms, full],
    syncStatus: bumpPending(),
  });
  enqueue('PUT', `/api/tracker/gyms/${full.id}`, {
    name: full.name,
    lat: full.lat,
    lng: full.lng,
    radiusM: full.radiusM,
  });
  persist();
  void sync();
  return full;
}

export function deleteGym(id: string): void {
  setState({
    gyms: state.gyms.filter((g) => g.id !== id),
    syncStatus: bumpPending(),
  });
  enqueue('DELETE', `/api/tracker/gyms/${id}`);
  persist();
  void sync();
}

export function dismissReminder(r: Reminder): void {
  setState({
    reminders: state.reminders.filter(
      (x) => !(x.gymId === r.gymId && x.visitStart === r.visitStart),
    ),
    syncStatus: bumpPending(),
  });
  // Dismissals go through the queue too, so it works offline. Replay is
  // safe: the server does INSERT OR IGNORE.
  enqueue('POST', `/api/tracker/reminders/dismiss`, {
    gymId: r.gymId,
    visitStart: r.visitStart,
  });
  persist();
  void sync();
}

/** «Залогувати заднім числом»: тренування на час візиту в зал. */
export function logVisitAsWorkout(r: Reminder): Workout {
  const workout: Workout = {
    id: uuid(),
    startedAt: r.visitStart,
    finishedAt: r.visitEnd,
    autoFinished: false,
    exercises: [],
  };
  enqueue('PUT', `/api/tracker/workouts/${workout.id}`, {
    startedAt: workout.startedAt,
    finishedAt: workout.finishedAt,
    autoFinished: false,
  });
  setState({
    workouts: sortWorkouts([workout, ...state.workouts]),
    reminders: state.reminders.filter(
      (x) => !(x.gymId === r.gymId && x.visitStart === r.visitStart),
    ),
    syncStatus: bumpPending(),
  });
  persist();
  void sync();
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

const LAST_PING_KEY = 'gym.lastPingAt';
const PING_EVERY_MS = 5 * 60 * 1000;

/**
 * Якщо додаток відкритий і ми фізично в радіусі одного із залів —
 * пишемо "presence ping" (не частіше ніж раз на 5 хв). Із цих точок
 * сервер збирає візити й нагадує про незалоговані тренування.
 * (Браузер не дає геолокацію у фоні — тому точки з'являються лише
 * коли додаток відкривають.)
 */
export function recordPresence(): void {
  if (state.gyms.length === 0 || !('geolocation' in navigator)) return;
  const last = Number(localStorage.getItem(LAST_PING_KEY) ?? 0);
  if (Date.now() - last < PING_EVERY_MS) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      if (accuracy > 500) return; // надто неточно, щоб судити
      const gym = state.gyms.find(
        (g) => haversineM(latitude, longitude, g.lat, g.lng) <= g.radiusM + accuracy,
      );
      if (!gym) return;
      localStorage.setItem(LAST_PING_KEY, String(Date.now()));
      enqueue('PUT', `/api/tracker/pings/${uuid()}`, {
        gymId: gym.id,
        at: Date.now(),
      });
      persist();
      void sync();
    },
    () => {
      /* відмова в доступі — просто мовчимо */
    },
    { enableHighAccuracy: false, maximumAge: 120_000, timeout: 10_000 },
  );
}

export function getCurrentPositionOnce(): Promise<{
  lat: number;
  lng: number;
  accuracy: number;
}> {
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
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  });
}

// --- Sync ------------------------------------------------------------------

let syncing = false;

/**
 * The contract the user asked for:
 * 1) replay the offline queue to the server, in order;
 * 2) if everything is delivered — clear the queue;
 * 3) fetch fresh state from the server and REPLACE the local copy
 *    (server is the single source of truth).
 * On network failure we keep everything local and retry later.
 */
export async function sync(): Promise<void> {
  if (syncing || !getToken()) return;
  syncing = true;
  setState({ syncStatus: 'syncing' });
  try {
    while (state.queue.length > 0) {
      const item = state.queue[0];
      try {
        await request(item.method, item.url, item.body);
      } catch (err) {
        if (err instanceof HttpError && err.status !== 401) {
          // Permanent rejection (bad payload etc.) — drop so the queue
          // doesn't get poisoned; the refetch below will restore truth.
          console.warn('sync: dropping rejected mutation', item, err.message);
        } else {
          throw err; // network error or 401 — stop, keep the queue
        }
      }
      setState({ queue: state.queue.slice(1) });
    }
    const data = await request<{
      workouts: Workout[];
      gyms: Gym[];
      reminders: Reminder[];
    }>('GET', '/api/tracker/state');
    setState({
      workouts: sortWorkouts(data.workouts),
      gyms: data.gyms ?? [],
      reminders: data.reminders ?? [],
      syncStatus: 'synced',
      lastSyncAt: Date.now(),
    });
  } catch {
    setState({
      syncStatus:
        navigator.onLine && state.queue.length === 0
          ? 'pending'
          : navigator.onLine
            ? 'pending'
            : 'offline',
    });
  } finally {
    syncing = false;
  }
}

export function startSyncLoop(): () => void {
  const tick = () => {
    applyAutoFinish();
    recordPresence();
    void sync();
  };
  const interval = setInterval(tick, 15_000);
  window.addEventListener('online', tick);
  window.addEventListener('focus', tick);
  tick();
  return () => {
    clearInterval(interval);
    window.removeEventListener('online', tick);
    window.removeEventListener('focus', tick);
  };
}

// --- Derived data for the designed UI (ghost rows, PRs, compare) -----------

export interface PrevLift {
  reps: number;
  weight: number | null;
}

/** Working top set of an exercise: heaviest weight, then most reps. */
export function topSet(sets: SetEntry[]): SetEntry | undefined {
  return [...sets]
    .filter((s) => !s.isWarmup)
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || b.reps - a.reps)[0];
}

/** Last finished session that contains this exercise name (case-insensitive). */
export function lastSessionWith(
  name: string,
  beforeWorkoutId?: string,
): { workout: Workout; exercise: Exercise } | undefined {
  const needle = name.trim().toLowerCase();
  for (const w of state.workouts) {
    if (w.id === beforeWorkoutId || w.finishedAt === null) continue;
    const ex = w.exercises.find((e) => e.name.trim().toLowerCase() === needle);
    if (ex && ex.sets.length > 0) return { workout: w, exercise: ex };
  }
  return undefined;
}

/** «prev 85 × 8» + ghost prefill for an exercise name. */
export function prevLift(name: string, currentWorkoutId?: string): PrevLift | undefined {
  const found = lastSessionWith(name, currentWorkoutId);
  if (!found) return undefined;
  const top = topSet(found.exercise.sets) ?? found.exercise.sets[found.exercise.sets.length - 1];
  return top ? { reps: top.reps, weight: top.weight } : undefined;
}

/** All-time record weight for a name (working sets), excluding one workout. */
export function recordWeight(name: string, excludeWorkoutId?: string): number {
  const needle = name.trim().toLowerCase();
  let max = 0;
  for (const w of state.workouts) {
    if (w.id === excludeWorkoutId) continue;
    for (const e of w.exercises) {
      if (e.name.trim().toLowerCase() !== needle) continue;
      for (const s of e.sets) {
        if (!s.isWarmup && (s.weight ?? 0) > max) max = s.weight ?? 0;
      }
    }
  }
  return max;
}

/** Epley estimated 1RM, rounded. */
export function est1rm(weight: number, reps: number): number {
  return Math.round(weight * (1 + reps / 30));
}

/** Distinct exercise names across history, most recent first. */
export function knownExercises(): { name: string; last?: PrevLift }[] {
  const seen = new Map<string, PrevLift | undefined>();
  for (const w of state.workouts) {
    for (const e of w.exercises) {
      const key = e.name.trim();
      if (!key || seen.has(key.toLowerCase())) continue;
      const top = topSet(e.sets) ?? e.sets[e.sets.length - 1];
      seen.set(key.toLowerCase(), top ? { reps: top.reps, weight: top.weight } : undefined);
    }
  }
  const out: { name: string; last?: PrevLift }[] = [];
  for (const w of state.workouts) {
    for (const e of w.exercises) {
      const key = e.name.trim();
      if (!key) continue;
      if (out.some((o) => o.name.toLowerCase() === key.toLowerCase())) continue;
      out.push({ name: key, last: seen.get(key.toLowerCase()) });
    }
  }
  return out;
}

export function workoutSets(w: Workout): number {
  return w.exercises.reduce((n, e) => n + e.sets.length, 0);
}

export function workoutVolumeKg(w: Workout): number {
  return w.exercises.reduce(
    (v, e) => v + e.sets.reduce((s, x) => s + (x.weight ?? 0) * x.reps, 0),
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
  enqueue('PUT', `/api/tracker/exercises/${exerciseId}/sets/${set.id}`, {
    reps: set.reps,
    weight: set.weight,
    isWarmup: set.isWarmup,
    position: set.position,
  });
  persist();
  void sync();
}

export function restoreExercise(workoutId: string, exercise: Exercise): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) return;
  patchWorkout(workoutId, {
    exercises: [...w.exercises, exercise].sort((a, b) => a.position - b.position),
  });
  enqueue('PUT', `/api/tracker/workouts/${workoutId}/exercises/${exercise.id}`, {
    name: exercise.name,
    position: exercise.position,
  });
  for (const s of exercise.sets) {
    enqueue('PUT', `/api/tracker/exercises/${exercise.id}/sets/${s.id}`, {
      reps: s.reps,
      weight: s.weight,
      isWarmup: s.isWarmup,
      position: s.position,
    });
  }
  persist();
  void sync();
}

export function clearSets(workoutId: string, exerciseId: string): SetEntry[] {
  const w = state.workouts.find((x) => x.id === workoutId);
  const ex = w?.exercises.find((e) => e.id === exerciseId);
  if (!w || !ex) return [];
  const removed = ex.sets;
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) => (e.id === exerciseId ? { ...e, sets: [] } : e)),
  });
  for (const s of removed) enqueue('DELETE', `/api/tracker/sets/${s.id}`);
  persist();
  void sync();
  return removed;
}

export function duplicateExercise(workoutId: string, exerciseId: string): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  const ex = w?.exercises.find((e) => e.id === exerciseId);
  if (!w || !ex) return;
  const copy: Exercise = {
    id: uuid(),
    name: ex.name,
    position: w.exercises.length,
    sets: ex.sets.map((s, i) => ({ ...s, id: uuid(), position: i })),
  };
  restoreExercise(workoutId, copy);
}

/** Drops set-less exercises on finish (design S-28) and returns the workout. */
export function finishWorkoutClean(id: string): Workout | undefined {
  const w = state.workouts.find((x) => x.id === id);
  if (!w) return undefined;
  for (const e of w.exercises) {
    if (e.sets.length === 0) {
      patchWorkout(id, {
        exercises: state.workouts.find((x) => x.id === id)!.exercises.filter((x) => x.id !== e.id),
      });
      enqueue('DELETE', `/api/tracker/exercises/${e.id}`);
    }
  }
  finishWorkout(id);
  return state.workouts.find((x) => x.id === id);
}

/** Reopen an auto-closed session: clock keeps the original start (S-27). */
export function reopenWorkout(id: string): void {
  const w = state.workouts.find((x) => x.id === id);
  if (!w) return;
  patchWorkout(id, { finishedAt: null, autoFinished: false });
  enqueue('PUT', `/api/tracker/workouts/${id}`, {
    startedAt: w.startedAt,
    finishedAt: null,
    autoFinished: false,
  });
  persist();
  void sync();
}

/** Backfill (spec docs/specs/backfill-session.md): create an already-finished
 * past session; it goes through the same idempotent upsert queue. */
export function backfillWorkout(startedAt: number, durationMs: number): Workout {
  const workout: Workout = {
    id: uuid(),
    startedAt,
    finishedAt: startedAt + durationMs,
    autoFinished: false,
    exercises: [],
  };
  enqueue('PUT', `/api/tracker/workouts/${workout.id}`, {
    startedAt: workout.startedAt,
    finishedAt: workout.finishedAt,
    autoFinished: false,
  });
  setState({
    workouts: sortWorkouts([workout, ...state.workouts]),
    syncStatus: bumpPending(),
  });
  persist();
  void sync();
  return workout;
}

/** «Repeat X»: new session pre-seeded with the exercises of a past one. */
export function repeatWorkout(sourceId: string): Workout | undefined {
  const src = state.workouts.find((x) => x.id === sourceId);
  if (!src) return undefined;
  const w = startWorkout();
  for (const e of [...src.exercises].sort((a, b) => a.position - b.position)) {
    addExercise(w.id, e.name);
  }
  return state.workouts.find((x) => x.id === w.id);
}

export function resetLocalData(): void {
  localStorage.removeItem(STATE_KEY);
  localStorage.removeItem(GYMS_KEY);
  localStorage.removeItem(REMINDERS_KEY);
  localStorage.removeItem(QUEUE_KEY);
  state = {
    workouts: [],
    gyms: [],
    reminders: [],
    queue: [],
    syncStatus: 'pending',
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
