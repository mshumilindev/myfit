import { useSyncExternalStore } from 'react';
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
import { HttpError, getRole, getToken, request } from './api';

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
  queue: load<QueuedMutation[]>(QUEUE_KEY, []),
  syncStatus: 'pending',
  syncError: null,
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

/** Effective type of a set; falls back to the legacy isWarmup flag. */
export function setTypeOf(s: SetEntry): SetType {
  return s.type ?? (s.isWarmup ? 'warmup' : 'working');
}

export function setDrops(s: SetEntry): DropEntry[] {
  const t = setTypeOf(s);
  return t === 'drop' || t === 'reverse-drop' ? (s.drops ?? []) : [];
}

/** Total reps of a set: the start plus every drop (EQ-4 counting rules). */
export function setRepsTotal(s: SetEntry): number {
  return s.reps + setDrops(s).reduce((n, d) => n + d.reps, 0);
}

/** Volume of one set in kg: start + drops. Warm-ups contribute nothing. */
export function setVolumeKg(s: SetEntry): number {
  if (setTypeOf(s) === 'warmup') return 0;
  return (s.weight ?? 0) * s.reps + setDrops(s).reduce((v, d) => v + (d.weight ?? 0) * d.reps, 0);
}

/**
 * Weight is often entered per side, so total volume doubles the entered load:
 *  - Dumbbells: two of them by default (a 20 kg dumbbell in each hand moves
 *    40 kg). Single-dumbbell moves held with both hands (goblet, pullover) and
 *    explicit one-arm variants stay ×1.
 *  - Cables: a single stack pulled with both hands (lat/straight-arm pulldown,
 *    pushdown, seated row) is ×1 — the stack weight IS the total. Only bilateral
 *    two-cable moves (pec fly, crossover) load two stacks, so those double.
 * Records and 1RM estimates keep the entered per-side weight — like with like.
 */
const ONE_ARM_NAME = /\b(one|single)[- ](arm|hand|leg)\b|unilateral|одн(ією|у|ой)\s*рук/i;
/** Dumbbell moves done with a single dumbbell held in both hands → ×1. */
const SINGLE_DUMBBELL = /goblet|pull[- ]?over|two[- ]?hand|both hands|svend|\bskull\s*crusher\b/i;
/** Cable moves that load two separate stacks at once → ×2. */
const BILATERAL_CABLE = /\bflye?\b|cross[- ]?over|pec\b/i;

export function perHandFactor(ex: Pick<Exercise, 'name' | 'equipment'>): number {
  const eq = equipmentFor(ex);
  const name = ex.name;
  if (ONE_ARM_NAME.test(name)) return 1;
  if (eq.includes('dumbbell')) return SINGLE_DUMBBELL.test(name) ? 1 : 2;
  if (eq.includes('cable')) return BILATERAL_CABLE.test(name) ? 2 : 1;
  return 1;
}

/** Volume of one exercise in kg (drops included, warm-ups excluded, per-hand ×2). */
export function exerciseVolumeKg(ex: Exercise): number {
  return ex.sets.reduce((v, s) => v + setVolumeKg(s), 0) * perHandFactor(ex);
}

// --- Supersets (design SS-1…SS-3) ------------------------------------------

export interface SupersetGroup {
  groupId: string;
  /** A, B, C… in first-appearance order. */
  letter: string;
  exercises: Exercise[];
}

/** One entry per card in position order: single exercises or whole groups. */
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

/** Next free superset letter for a workout ('A' when none exist yet). */
export function nextSupersetLetter(w: Workout): string {
  const used = sessionBlocks(w).filter((b) => b.kind === 'group').length;
  return String.fromCharCode(65 + used);
}

/** Rounds in a superset = the longest member (planned or logged, SS-2 note). */
export function groupRounds(g: SupersetGroup): number {
  return Math.max(
    1,
    ...g.exercises.map((e) => Math.max(e.sets.length, Math.max(0, e.plannedSets ?? 0))),
  );
}

/** Current round = shortest member's next set (1-based, capped at rounds). */
export function groupCurrentRound(g: SupersetGroup): number {
  const done = Math.min(...g.exercises.map((e) => e.sets.length));
  return Math.min(done + 1, groupRounds(g));
}

/** Group exercises with the given ids as a superset; keeps every set (SS-2). */
export function groupAsSuperset(workoutId: string, exerciseIds: string[]): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w || exerciseIds.length < 2) return;
  const gid = uuid();
  const next = w.exercises.map((e) => {
    const order = exerciseIds.indexOf(e.id);
    if (order < 0) return e;
    return { ...e, groupId: gid, groupOrder: order };
  });
  patchWorkout(workoutId, { exercises: next });
  for (const e of next) {
    if (e.groupId === gid) {
      enqueue('PUT', `/api/tracker/workouts/${workoutId}/exercises/${e.id}`, {
        ...exerciseUpsertBody(e),
      });
    }
  }
  persist();
  void sync();
}

/** Ungroup restores plain numbering and keeps every set (SS-2 note). */
export function ungroupSuperset(workoutId: string, groupId: string): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) return;
  const next = w.exercises.map((e) =>
    e.groupId === groupId ? { ...e, groupId: null, groupOrder: null } : e,
  );
  patchWorkout(workoutId, { exercises: next });
  for (const e of next) {
    if (w.exercises.find((x) => x.id === e.id)?.groupId === groupId) {
      enqueue('PUT', `/api/tracker/workouts/${workoutId}/exercises/${e.id}`, {
        ...exerciseUpsertBody(e),
      });
    }
  }
  persist();
  void sync();
}

// --- Muscle groups (design MG-1…MG-5, EQ-4) --------------------------------

export interface ResolvedMuscles {
  primary: MuscleGroup | null;
  secondary: MuscleGroup[];
}

/** Muscles for an exercise: its own fields first, then the catalog by name. */
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

/** Sets per primary muscle in one workout — drops count as one (DS-4 rail). */
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

/** Volume per primary muscle across workouts (MG-3: sums to the total). */
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

/** Distinct equipment ids used by a workout's exercises (DS-4 rail). */
export function workoutEquipment(w: Workout): string[] {
  const out: string[] = [];
  for (const e of w.exercises) {
    for (const id of equipmentFor(e)) if (!out.includes(id)) out.push(id);
  }
  return out;
}

/** Equipment for an exercise: its own list first, then the catalog. */
export function equipmentFor(ex: Pick<Exercise, 'name' | 'equipment'>): string[] {
  if (ex.equipment && ex.equipment.length > 0) return ex.equipment;
  const info = muscleInfoByName(ex.name);
  return info?.equipment ? [info.equipment] : [];
}

/** Equipment an exercise name needs, learned from history + the catalog. */
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

/** Equipment an exercise needs that a gym's inventory lacks (EQ-2/EQ-3).
 *  A gym with no inventory set is never flagged as missing anything. */
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

// --- Local mutations (optimistic, queued for the server) -------------------

function enqueue(method: QueuedMutation['method'], url: string, body?: unknown): void {
  state.queue.push({ id: uuid(), method, url, body, queuedAt: Date.now() });
}

function sortWorkouts(ws: Workout[]): Workout[] {
  return [...ws].sort((a, b) => b.startedAt - a.startedAt);
}

function exerciseUpsertBody(e: Exercise): ExercisePlan & {
  name: string;
  kind: ExerciseKind;
  position: number;
} {
  return {
    name: e.name,
    kind: exerciseKind(e),
    position: e.position,
    plannedSets: e.plannedSets ?? null,
    plannedReps: e.plannedReps ?? null,
    plannedDurationMin: e.plannedDurationMin ?? null,
    equipment: e.equipment ?? [],
    groupId: e.groupId ?? null,
    groupOrder: e.groupOrder ?? null,
    primaryMuscle: e.primaryMuscle ?? null,
    secondaryMuscles: e.secondaryMuscles ?? [],
  };
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
        gymId: closed.gymId ?? null,
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
  if (state.syncStatus === 'failed') return 'failed';
  return navigator.onLine ? 'pending' : 'offline';
}

export function startWorkout(gymId: string | null = null): Workout {
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
    gymId,
    exercises: [],
  };
  enqueue('PUT', `/api/tracker/workouts/${workout.id}`, {
    startedAt: workout.startedAt,
    finishedAt: null,
    autoFinished: false,
    gymId,
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
    gymId: w.gymId ?? null,
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
  const w = state.workouts.find((x) => x.id === id);
  patchWorkout(id, { startedAt, finishedAt, autoFinished });
  enqueue('PUT', `/api/tracker/workouts/${id}`, {
    startedAt,
    finishedAt,
    autoFinished,
    gymId: w?.gymId ?? null,
  });
  persist();
  void sync();
}

/** Attach (or change) the gym a session belongs to, mid-session or after. */
export function attachGymToWorkout(workoutId: string, gymId: string | null): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) return;
  patchWorkout(workoutId, { gymId });
  enqueue('PUT', `/api/tracker/workouts/${workoutId}`, {
    startedAt: w.startedAt,
    finishedAt: w.finishedAt,
    autoFinished: w.autoFinished,
    gymId,
  });
  persist();
  void sync();
}

/** Drag-and-drop reorder: rewrite positions 0..n-1 and sync changed ones. */
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
  for (const e of next) {
    const old = byId.get(e.id)!;
    if (old.position !== e.position) {
      enqueue('PUT', `/api/tracker/workouts/${workoutId}/exercises/${e.id}`, {
        ...exerciseUpsertBody(e),
      });
    }
  }
  patchWorkout(workoutId, { exercises: next });
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
  patchWorkout(workoutId, {
    exercises: [...(w?.exercises ?? []), exercise],
  });
  enqueue('PUT', `/api/tracker/workouts/${workoutId}/exercises/${exercise.id}`, {
    ...exerciseUpsertBody(exercise),
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
    ...exerciseUpsertBody({ ...ex, name }),
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
  enqueue('PUT', `/api/tracker/exercises/${exerciseId}/sets/${full.id}`, {
    reps: full.reps,
    weight: full.weight,
    isWarmup: full.isWarmup,
    type: full.type,
    drops: full.drops ?? [],
    durationMin: full.durationMin ?? null,
    distanceKm: full.distanceKm ?? null,
    calories: full.calories ?? null,
    rpe: full.rpe ?? null,
    position: full.position,
  });
  persist();
  void sync();
}

/** Append one drop to an already-logged set (DS-2 · “Add a drop”). */
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
  upsertSet(workoutId, exerciseId, {
    ...s,
    id: s.id,
    type,
    drops: [...(s.drops ?? []), drop],
  });
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
    favorite: full.favorite ?? false,
    inventory: full.inventory ?? [],
  });
  persist();
  void sync();
  return full;
}

/** Flip the favourite flag on a gym (used as a fallback suggestion). */
export function toggleFavorite(id: string): void {
  const g = state.gyms.find((x) => x.id === id);
  if (!g) return;
  upsertGym({ ...g, favorite: !g.favorite });
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
    gymId: r.gymId,
    exercises: [],
  };
  enqueue('PUT', `/api/tracker/workouts/${workout.id}`, {
    startedAt: workout.startedAt,
    finishedAt: workout.finishedAt,
    autoFinished: false,
    gymId: r.gymId,
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
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
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
          // Permanent rejection: halt the queue rather than skip, and surface
          // the blocking change with its raw status line (AC-SYNC-02, AC-SYNC-05).
          setState({
            syncStatus: 'failed',
            syncError: {
              status: err.status,
              statusLine: `${item.method} ${item.url} → ${err.status} ${err.message}`.trim(),
            },
          });
          return;
        }
        throw err; // network error or 401 — stop, keep the queue
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
      syncError: null,
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

/** Retry a queue blocked by a permanent rejection (AC-SYNC-05). */
export function retrySync(): void {
  setState({ syncStatus: navigator.onLine ? 'pending' : 'offline', syncError: null });
  void sync();
}

/** Drop the change blocking the queue and resume (AC-SYNC-05). */
export function discardBlockingChange(): void {
  if (state.queue.length === 0) return;
  setState({
    queue: state.queue.slice(1),
    syncStatus: navigator.onLine ? 'pending' : 'offline',
    syncError: null,
  });
  void sync();
}

/** Pull the shared custom-exercise catalog (admin/trainer-authored). */
function refreshExerciseCatalog(): void {
  request<{ exercises: CustomExercise[] }>('GET', '/api/exercises')
    .then((d) => {
      if (Array.isArray(d?.exercises)) {
        registerCustomExercises(d.exercises);
        emit();
      }
    })
    .catch(() => {});
}

/**
 * Persist a custom exercise to the shared server catalog (admins and trainers
 * only — members keep it purely local). Registers locally right away so the
 * chips and the picker know the muscles immediately, before the round-trip.
 */
export function saveCatalogExercise(meta: {
  name: string;
  kind?: string;
  primaryMuscle: MuscleGroup | null;
  secondaryMuscles: MuscleGroup[];
  equipment: string[];
}): void {
  const role = getRole();
  if (role !== 'admin' && role !== 'trainer') return;
  registerCustomExercise({ id: `pending-${meta.name.toLowerCase()}`, ...meta });
  emit();
  request<{ exercise: CustomExercise }>('PUT', '/api/exercises', meta)
    .then((d) => {
      if (d?.exercise) {
        registerCustomExercise(d.exercise);
        emit();
      }
    })
    .catch(() => {});
}

/** Update an exercise's muscles/equipment in place (and sync it). */
export function updateExerciseMeta(
  workoutId: string,
  exerciseId: string,
  meta: {
    primaryMuscle: MuscleGroup | null;
    secondaryMuscles: MuscleGroup[];
    equipment: string[];
  },
): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) return;
  const ex = w.exercises.find((e) => e.id === exerciseId);
  if (!ex) return;
  const next = {
    ...ex,
    primaryMuscle: meta.primaryMuscle,
    secondaryMuscles: meta.secondaryMuscles,
    equipment: meta.equipment,
  };
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) => (e.id === exerciseId ? next : e)),
  });
  enqueue('PUT', `/api/tracker/workouts/${workoutId}/exercises/${exerciseId}`, {
    ...exerciseUpsertBody(next),
  });
  persist();
  void sync();
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
  refreshExerciseCatalog();
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

/** Heaviest weight touched in a set, drops included. */
export function setTopWeight(s: SetEntry): number {
  return Math.max(s.weight ?? 0, ...setDrops(s).map((d) => d.weight ?? 0));
}

/** Working top set of an exercise: heaviest weight, then most reps. */
export function topSet(sets: SetEntry[]): SetEntry | undefined {
  return [...sets]
    .filter((s) => setTypeOf(s) !== 'warmup')
    .sort((a, b) => setTopWeight(b) - setTopWeight(a) || b.reps - a.reps)[0];
}

/** Last finished session that contains this exercise name (case-insensitive). */
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
      if (!isStrengthExercise(e)) continue;
      if (e.name.trim().toLowerCase() !== needle) continue;
      for (const s of e.sets) {
        if (setTypeOf(s) !== 'warmup' && setTopWeight(s) > max) max = setTopWeight(s);
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
      if (!key) continue;
      if (out.some((o) => o.name.toLowerCase() === key.toLowerCase())) continue;
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
  enqueue('PUT', `/api/tracker/exercises/${exerciseId}/sets/${set.id}`, {
    reps: set.reps,
    weight: set.weight,
    isWarmup: set.isWarmup,
    type: setTypeOf(set),
    drops: set.drops ?? [],
    durationMin: set.durationMin ?? null,
    distanceKm: set.distanceKm ?? null,
    calories: set.calories ?? null,
    rpe: set.rpe ?? null,
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
    ...exerciseUpsertBody(exercise),
  });
  for (const s of exercise.sets) {
    enqueue('PUT', `/api/tracker/exercises/${exercise.id}/sets/${s.id}`, {
      reps: s.reps,
      weight: s.weight,
      isWarmup: s.isWarmup,
      type: setTypeOf(s),
      drops: s.drops ?? [],
      durationMin: s.durationMin ?? null,
      distanceKm: s.distanceKm ?? null,
      calories: s.calories ?? null,
      rpe: s.rpe ?? null,
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
  enqueue('PUT', `/api/tracker/workouts/${workout.id}`, {
    startedAt: workout.startedAt,
    finishedAt: workout.finishedAt,
    autoFinished: false,
    gymId,
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
    addExercise(w.id, e.name, exerciseKind(e));
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
