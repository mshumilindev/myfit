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
  type Activity,
  type ActivityCategory,
  type ActivityEffort,
  type BodyMetrics,
  type DropEntry,
  type Exercise,
  type ExerciseKind,
  type Gym,
  type QueuedMutation,
  type Reminder,
  type RestMode,
  type RestPeriod,
  type SetEntry,
  type SetType,
  type SyncStatus,
  type SyncError,
  type WeightEntry,
  type Workout,
} from './types';
import {
  canonicalExerciseName,
  isBuiltInExercise,
  muscleInfoByName,
  registerCustomExercise,
  registerCustomExercises,
  customExercises,
  type CustomExercise,
  type MuscleGroup,
} from './data/exercises';
import PER_SIDE from './data/per-side.json';
import { deriveLoadType, BAND_DEFAULTS, type LoadType, type BandRung } from './loads';
import { isFlagOn } from './data/flags';
import { describeDay, type DayReadout } from './data/daySuggest';
import { currentUid, getRole } from './api';

const STATE_KEY = 'spotter.state';
const GYMS_KEY = 'spotter.gyms';
const REMINDERS_KEY = 'spotter.reminders';
const BODY_KEY = 'spotter.body';
const REST_KEY = 'spotter.restPeriods';
const ACTIVITIES_KEY = 'spotter.activities';
const EX_UNIT_KEY = 'spotter.exerciseUnits';
const EX_LOAD_KEY = 'spotter.exerciseLoads';
const WEIGHT_UNIT_KEY = 'spotter.weightUnit';

const EMPTY_BODY: BodyMetrics = { weights: [] };

/** Per-exercise weight display unit (Load-entry B). Storage stays canonical kg;
 *  this only changes how the weight is shown/entered for a given lift/machine. */
export type DisplayUnit = 'kg' | 'lb';

export interface StoreState {
  workouts: Workout[];
  gyms: Gym[];
  reminders: Reminder[];
  /** Planned rest / recovery / vacation windows. */
  restPeriods: RestPeriod[];
  /** Logged non-lifting activities (cardio & recovery). */
  activities: Activity[];
  /** Account-wide weight unit (Load-entry B): the default everything is shown
   *  in. Defaults to kg; a per-exercise entry overrides it for one machine. */
  weightUnit: DisplayUnit;
  /** Per-exercise display unit override (absent = use weightUnit). Local only. */
  exerciseUnits: Record<string, DisplayUnit>;
  /** Per-exercise load-type override (Load-entry C). Absent = derive from the
   *  exercise (equipment + name). Local only. */
  exerciseLoadTypes: Record<string, LoadType>;
  /** Own body metrics (weigh-ins, height, optional composition). */
  bodyMetrics: BodyMetrics;
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
  restPeriods: load<RestPeriod[]>(REST_KEY, []),
  activities: load<Activity[]>(ACTIVITIES_KEY, []),
  weightUnit: load<DisplayUnit>(WEIGHT_UNIT_KEY, 'kg'),
  exerciseUnits: load<Record<string, DisplayUnit>>(EX_UNIT_KEY, {}),
  exerciseLoadTypes: load<Record<string, LoadType>>(EX_LOAD_KEY, {}),
  bodyMetrics: load<BodyMetrics>(BODY_KEY, EMPTY_BODY),
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
    localStorage.setItem(REST_KEY, JSON.stringify(state.restPeriods));
    localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(state.activities));
    localStorage.setItem(WEIGHT_UNIT_KEY, JSON.stringify(state.weightUnit));
    localStorage.setItem(EX_UNIT_KEY, JSON.stringify(state.exerciseUnits));
    localStorage.setItem(EX_LOAD_KEY, JSON.stringify(state.exerciseLoadTypes));
    localStorage.setItem(BODY_KEY, JSON.stringify(state.bodyMetrics));
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
/** Warm-up as an exercise kind is a session marker — no sets to log. */
export function isMarkerExercise(ex: Exercise): boolean {
  return exerciseKind(ex) === 'warmup';
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
  // Null/0 means bodyweight in the UI, but contributes no external load to total volume.
  const load = (w: number | null): number => w ?? 0;
  return load(s.weight) * s.reps + setDrops(s).reduce((v, d) => v + load(d.weight) * d.reps, 0);
}

/**
 * Per-side entry doubling: ×2 means the logged weight is one side's load.
 *  - `per-side.json` decides first — the only place a move is classified by hand.
 *  - Dumbbells / kettlebell pairs: ×2, unless one implement is shared by both hands.
 *  - Cables: one stack ×1 (a cable crunch is not doubled); two-stack moves ×2.
 * Names are matched on the English catalog name, so the factor does not depend
 * on the interface language the set was logged in.
 */
const ONE_ARM_NAME = /\b(one|single)[- ](arm|hand|leg)\b|unilateral|одн(ією|у|ой)\s*рук/i;
const SINGLE_IMPLEMENT = /goblet|pull[- ]?over|two[- ]?hand|both hands|svend|\bskull\s*crusher\b/i;
const BILATERAL_CABLE = /\bfly(e|es|s)?\b|cross[- ]?over|\biron cross\b|\bpec\b/i;
const PAIRED_KETTLEBELL = /\bdouble\b|two[- ]arm|two kettlebells|alternating|seesaw/i;
const TWO_SIDED = new Set(PER_SIDE.twoSided);
const ONE_SIDED = new Set(PER_SIDE.oneSided);

export function perHandFactor(ex: Pick<Exercise, 'name' | 'equipment'>): number {
  const name = ex.name;
  const canon = canonicalExerciseName(name).toLowerCase();
  if (ONE_SIDED.has(canon) || ONE_SIDED.has(name.trim().toLowerCase())) return 1;
  if (TWO_SIDED.has(canon) || TWO_SIDED.has(name.trim().toLowerCase())) return 2;
  if (ONE_ARM_NAME.test(name) || ONE_ARM_NAME.test(canon)) return 1;
  const eq = equipmentFor(ex);
  if (eq.includes('dumbbell')) return SINGLE_IMPLEMENT.test(canon) ? 1 : 2;
  if (eq.includes('kettlebell')) return PAIRED_KETTLEBELL.test(canon) ? 2 : 1;
  if (eq.includes('cable')) return BILATERAL_CABLE.test(canon) ? 2 : 1;
  return 1;
}

export function exerciseVolumeKg(ex: Exercise): number {
  // Assist (negative help) and band (estimate) loads never count as real
  // tonnage — they'd otherwise subtract from or inflate the total (Load-entry C).
  if (loadTypeFor(ex) !== 'weight') return 0;
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
  // A named exercise in the catalog — BUILT-IN or CUSTOM — resolves from the
  // catalog, the source of truth, not from the muscles snapshotted onto the log
  // at add time. This is what lets a catalog change — the finer muscle split, or
  // editing a custom exercise's muscles — flow into every past session, the
  // muscles-worked readout and the trends with no per-log migration. The stored
  // primaryMuscle is trusted only for an ad-hoc exercise with no catalog entry.
  const info = (ex.kind ?? 'strength') === 'strength' ? muscleInfoByName(ex.name) : null;
  if (info && info.primary !== 'cardio') {
    return { primary: info.primary, secondary: info.secondary };
  }
  if (ex.primaryMuscle) {
    return {
      primary: ex.primaryMuscle as MuscleGroup,
      secondary: (ex.secondaryMuscles ?? []) as MuscleGroup[],
    };
  }
  return { primary: null, secondary: [] };
}

/** Per-muscle work in a workout, best-practice fractional set counting: the
 *  primary mover earns a full set, each secondary/synergist earns half
 *  (SECONDARY_SET_WEIGHT). `primary` flags whether the muscle was ever a direct
 *  target in the session, so the UI can tone it brass (primary) vs grey
 *  (secondary-only). Load volume (kg) and day inference stay primary-only —
 *  splitting tonnage across synergists double-counts, and half-credited
 *  synergists would make the day label noisy. */
export const SECONDARY_SET_WEIGHT = 0.5;

export interface MuscleWork {
  sets: number;
  primary: boolean;
}

export function muscleWorkInWorkout(w: Workout): Map<MuscleGroup, MuscleWork> {
  const m = new Map<MuscleGroup, MuscleWork>();
  const bump = (g: MuscleGroup, sets: number, isPrimary: boolean): void => {
    const cur = m.get(g) ?? { sets: 0, primary: false };
    cur.sets += sets;
    cur.primary = cur.primary || isPrimary;
    m.set(g, cur);
  };
  for (const e of w.exercises) {
    if (!isStrengthExercise(e)) continue;
    const n = e.sets.length;
    if (n === 0) continue;
    const { primary, secondary } = resolveMuscles(e);
    if (primary) bump(primary, n, true);
    for (const s of secondary) if (s !== primary) bump(s, n * SECONDARY_SET_WEIGHT, false);
  }
  return m;
}

/** Fractional set counts per muscle (see muscleWorkInWorkout). */
export function muscleSetsInWorkout(w: Workout): Map<MuscleGroup, number> {
  const out = new Map<MuscleGroup, number>();
  for (const [g, v] of muscleWorkInWorkout(w)) out.set(g, v.sets);
  return out;
}

/** Worked muscles for display: primary (direct) groups first, then
 *  secondary-only, each block ordered by set count. */
export function muscleWorkSorted(
  w: Workout,
): { muscle: MuscleGroup; sets: number; primary: boolean }[] {
  return [...muscleWorkInWorkout(w).entries()]
    .filter(([, v]) => v.sets > 0)
    .map(([muscle, v]) => ({ muscle, sets: v.sets, primary: v.primary }))
    .sort((a, b) => Number(b.primary) - Number(a.primary) || b.sets - a.sets);
}

/**
 * A session's day read from the muscle GROUPS trained (Ex suggestions): one
 * group → that muscle, one split → Push/Pull/Legs, several across splits → the
 * groups listed, many → full body. Groups are ordered by the exercise trained
 * first, so the main lift leads. Used to name logged sessions in lists (program
 * sessions keep their own day name instead).
 */
export function workoutDayReadout(w: Workout): DayReadout | null {
  const order: MuscleGroup[] = [];
  const counts = new Map<MuscleGroup, number>();
  for (const e of [...w.exercises].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))) {
    if (!isStrengthExercise(e)) continue;
    const { primary } = resolveMuscles(e);
    if (!primary || primary === 'cardio') continue;
    if (!counts.has(primary)) order.push(primary);
    counts.set(primary, (counts.get(primary) ?? 0) + Math.max(1, e.sets.length));
  }
  return describeDay(order.map((m) => [m, counts.get(m) as number]));
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
function writeBodyDoc(): void {
  const uid = currentUid();
  if (!uid) return;
  // JSON round-trip drops `undefined` (Firestore rejects it).
  const clean = JSON.parse(JSON.stringify({ ...state.bodyMetrics, updatedAt: Date.now() }));
  setDoc(doc(db, 'users', uid, 'meta', 'body'), clean).catch(onWriteError);
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

export function startWorkout(
  gymId: string | null = null,
  meta: Pick<Workout, 'dayName' | 'targetMuscles'> = {},
): Workout {
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
    dayName: meta.dayName ?? null,
    targetMuscles: meta.targetMuscles ?? [],
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

/**
 * Replace (substitute) an exercise in place: swap its identity — name, kind and
 * muscle/equipment tags — while keeping its logged sets. Muscles/equipment come
 * from the explicit meta if given, else from the catalogue for the new name.
 * Used by the "Replace" action (live session and day history alike).
 */
export function replaceExercise(
  workoutId: string,
  exerciseId: string,
  name: string,
  kind: ExerciseKind,
  meta?: {
    primaryMuscle?: MuscleGroup | null;
    secondaryMuscles?: MuscleGroup[];
    equipment?: string[];
  },
): void {
  const w = state.workouts.find((x) => x.id === workoutId);
  const ex = w?.exercises.find((e) => e.id === exerciseId);
  if (!w || !ex) return;
  const info = muscleInfoByName(name);
  const primaryMuscle =
    meta?.primaryMuscle ?? (info && info.primary !== 'cardio' ? info.primary : null);
  const secondaryMuscles = meta?.secondaryMuscles ?? info?.secondary ?? [];
  const equipment = meta?.equipment ?? (info?.equipment ? [info.equipment] : []);
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) =>
      e.id === exerciseId
        ? { ...e, name: name.trim(), kind, primaryMuscle, secondaryMuscles, equipment }
        : e,
    ),
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
  const loggedAt = set.loggedAt ?? existing?.loggedAt ?? Date.now();
  // Rest before a NEW set = the real gap to the most-recently logged set
  // anywhere in the workout (so rest between exercise cards is captured too),
  // stamped once at log time. Edits keep their existing value; absurd gaps
  // (backfilled / resumed-next-day) are dropped.
  const restSec =
    set.restSec !== undefined
      ? set.restSec
      : existing
        ? (existing.restSec ?? null)
        : (() => {
            const prevMax = Math.max(
              0,
              ...ex.sets.map((s) => s.loggedAt ?? 0),
              ...w.exercises.flatMap((e) => e.sets.map((s) => s.loggedAt ?? 0)),
            );
            if (!prevMax || prevMax >= loggedAt) return null;
            const gap = Math.round((loggedAt - prevMax) / 1000);
            return gap > 0 && gap < 3 * 3600 ? gap : null;
          })();
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
    // Rest timer (AC-2.1): stamp new sets; keep the original stamp on edits.
    loggedAt,
    restSec,
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

/**
 * Duplicate set (AC-1): deep-copy the whole set object — including its type
 * and all drops — assign a fresh id + rest timestamp, splice it in right after
 * the source, and renumber positions. Returns the new set's id.
 */
export function duplicateSet(workoutId: string, exerciseId: string, setId: string): string | null {
  const w = state.workouts.find((x) => x.id === workoutId);
  const ex = w?.exercises.find((e) => e.id === exerciseId);
  const src = ex?.sets.find((s) => s.id === setId);
  if (!w || !ex || !src) return null;
  const ordered = [...ex.sets].sort((a, b) => a.position - b.position);
  const srcIdx = ordered.findIndex((s) => s.id === setId);
  if (srcIdx < 0) return null;
  const dupAt = Date.now();
  const copy: SetEntry = {
    ...src,
    id: uuid(),
    drops: src.drops ? src.drops.map((d) => ({ ...d })) : [],
    // Rest for the copy = gap since the set it was duplicated from (AC-1.5).
    loggedAt: dupAt,
    restSec:
      src.loggedAt != null
        ? Math.min(3 * 3600, Math.max(0, Math.round((dupAt - src.loggedAt) / 1000)))
        : null,
  };
  ordered.splice(srcIdx + 1, 0, copy);
  const renumbered = ordered.map((s, i) => ({ ...s, position: i }));
  patchWorkout(workoutId, {
    exercises: w.exercises.map((e) => (e.id === exerciseId ? { ...e, sets: renumbered } : e)),
  });
  saveWorkout(workoutId);
  return copy.id;
}

/**
 * Actual rest before a set: the real elapsed time between the two set logs
 * (AC-2.2). Matches the live "since last set" count-up. Null when a stamp is
 * missing.
 */
export function restMs(prevLoggedAt?: number | null, loggedAt?: number | null): number | null {
  if (!prevLoggedAt || !loggedAt) return null;
  return Math.max(0, loggedAt - prevLoggedAt);
}

/**
 * One-time cleanup: the per-set `restSec` values stored by older builds were
 * computed incorrectly. Rest is now derived from real set timestamps at display
 * time, so clear every stored value. Idempotent — guarded by a local flag and
 * only rewrites workouts that actually carry stale rest.
 */
const REST_CLEARED_KEY = 'spotter.restCleared.v2';
export function clearStoredRest(): void {
  try {
    if (localStorage.getItem(REST_CLEARED_KEY)) return;
  } catch {
    /* private mode — attempt the cleanup anyway */
  }
  // Wait until workouts have actually loaded, so we don't set the flag on an
  // empty first snapshot and skip the real cleanup.
  if (state.workouts.length === 0) return;
  for (const w of state.workouts) {
    if (!w.exercises.some((e) => e.sets.some((s) => s.restSec != null))) continue;
    const exercises = w.exercises.map((e) =>
      e.sets.some((s) => s.restSec != null)
        ? { ...e, sets: e.sets.map((s) => (s.restSec != null ? { ...s, restSec: null } : s)) }
        : e,
    );
    patchWorkout(w.id, { exercises });
    saveWorkout(w.id);
  }
  try {
    localStorage.setItem(REST_CLEARED_KEY, '1');
  } catch {
    /* ignore */
  }
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

// --- Body metrics ----------------------------------------------------------

function commitBody(patch: Partial<BodyMetrics>): void {
  setState({ bodyMetrics: { ...state.bodyMetrics, ...patch }, syncStatus: bumpPending() });
  writeBodyDoc();
}

export function addWeight(weight: number, at: number): void {
  const entry: WeightEntry = { id: uuid(), at, weight };
  commitBody({ weights: [...state.bodyMetrics.weights, entry].sort((a, b) => a.at - b.at) });
}

export function editWeight(id: string, weight: number, at: number): void {
  commitBody({
    weights: state.bodyMetrics.weights
      .map((w) => (w.id === id ? { ...w, weight, at } : w))
      .sort((a, b) => a.at - b.at),
  });
}

export function removeWeight(id: string): void {
  commitBody({ weights: state.bodyMetrics.weights.filter((w) => w.id !== id) });
}

/** Height + optional composition (body fat, muscle, goal, waist/chest/hip). */
export function updateBodyMetrics(
  patch: Partial<Omit<BodyMetrics, 'weights' | 'updatedAt' | 'weighInDismissedDay'>>,
): void {
  commitBody(patch);
}

export function dismissWeighInToday(dayKey: string): void {
  commitBody({ weighInDismissedDay: dayKey });
}

// --- Rest / recovery periods (deloads, vacations) --------------------------
const REST_DAY_MS = 86_400_000;
/** Local-calendar day bucket: the index of the LOCAL Y-M-D of `ts`, so day
 *  boundaries follow the user's own midnight (not UTC). Consistent for
 *  workouts, rest periods and the date picker alike. */
export const dayKey = (ts: number): number => {
  const d = new Date(ts);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / REST_DAY_MS);
};

function writeRestPeriodDoc(r: RestPeriod): void {
  const uid = currentUid();
  if (!uid) return;
  setDoc(doc(db, 'users', uid, 'restPeriods', r.id), { ...r, updatedAt: Date.now() }).catch(
    onWriteError,
  );
}
function deleteRestPeriodDoc(id: string): void {
  const uid = currentUid();
  if (!uid) return;
  deleteDoc(doc(db, 'users', uid, 'restPeriods', id)).catch(onWriteError);
}

/** Start (or schedule) a rest period covering [startDay, endDay] inclusive. */
export function startRestPeriod(input: {
  mode: RestMode;
  startDay: number;
  endDay: number;
  note?: string | null;
}): RestPeriod {
  const period: RestPeriod = {
    id: uuid(),
    startDay: Math.min(input.startDay, input.endDay),
    endDay: Math.max(input.startDay, input.endDay),
    mode: input.mode,
    createdAt: Date.now(),
    note: input.note ?? null,
  };
  setState({ restPeriods: [period, ...state.restPeriods], syncStatus: bumpPending() });
  writeRestPeriodDoc(period);
  return period;
}

/** Interrupt a rest period: stop it from today on (the days already rested up to
 *  yesterday stay counted). If it hasn't started resting any earlier day yet
 *  (began today or is scheduled), remove it entirely. */
export function endRestPeriod(id: string, now: number = Date.now()): void {
  const today = dayKey(now);
  const period = state.restPeriods.find((r) => r.id === id);
  if (!period) return;
  if (period.startDay >= today) {
    deleteRestPeriod(id);
    return;
  }
  const list = state.restPeriods.map((r) => (r.id === id ? { ...r, endDay: today - 1 } : r));
  setState({ restPeriods: list, syncStatus: bumpPending() });
  const updated = list.find((r) => r.id === id);
  if (updated) writeRestPeriodDoc(updated);
}

export function deleteRestPeriod(id: string): void {
  setState({
    restPeriods: state.restPeriods.filter((r) => r.id !== id),
    syncStatus: bumpPending(),
  });
  deleteRestPeriodDoc(id);
}

/** The rest period covering `now`, if any (most recently created wins). */
export function activeRestPeriod(now: number = Date.now()): RestPeriod | null {
  const d = dayKey(now);
  return (
    [...state.restPeriods]
      .filter((r) => r.startDay <= d && d <= r.endDay)
      .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null
  );
}

/** Every day key covered by any rest period. */
export function restDayKeys(periods: RestPeriod[] = state.restPeriods): Set<number> {
  const set = new Set<number>();
  for (const r of periods) for (let d = r.startDay; d <= r.endDay; d++) set.add(d);
  return set;
}

// --- Activities (design feature 6: cardio & recovery + calories) -----------
function writeActivityDoc(a: Activity): void {
  const uid = currentUid();
  if (!uid) return;
  setDoc(doc(db, 'users', uid, 'activities', a.id), { ...a, updatedAt: Date.now() }).catch(
    onWriteError,
  );
}
function deleteActivityDoc(id: string): void {
  const uid = currentUid();
  if (!uid) return;
  deleteDoc(doc(db, 'users', uid, 'activities', id)).catch(onWriteError);
}

/** The live (unfinished) activity, if one is running or paused. */
export function liveActivity(): Activity | null {
  return state.activities.find((a) => a.finishedAt === null) ?? null;
}

/** Begin a live activity (design feature 6): a persisted, resumable timer that
 *  survives closing the page — mirrors how an open workout works. */
export function startActivity(type: string, category: ActivityCategory): Activity {
  const now = Date.now();
  const activity: Activity = {
    id: uuid(),
    type,
    category,
    startedAt: now,
    finishedAt: null,
    durationMin: 0,
    effort: 'moderate',
    runningSince: now,
    accumulatedMs: 0,
  };
  setState({
    activities: [activity, ...state.activities].sort((a, b) => b.startedAt - a.startedAt),
    syncStatus: bumpPending(),
  });
  writeActivityDoc(activity);
  return activity;
}

function patchActivity(id: string, patch: Partial<Activity>): void {
  const list = state.activities.map((a) => (a.id === id ? { ...a, ...patch } : a));
  setState({ activities: list, syncStatus: bumpPending() });
  const updated = list.find((a) => a.id === id);
  if (updated) writeActivityDoc(updated);
}

/** Pause the live timer, banking the current running segment. */
export function pauseActivity(id: string, now: number = Date.now()): void {
  const a = state.activities.find((x) => x.id === id);
  if (!a || a.finishedAt !== null || !a.runningSince) return;
  patchActivity(id, {
    accumulatedMs: (a.accumulatedMs ?? 0) + Math.max(0, now - a.runningSince),
    runningSince: null,
  });
}

/** Resume a paused live timer. */
export function resumeActivity(id: string, now: number = Date.now()): void {
  const a = state.activities.find((x) => x.id === id);
  if (!a || a.finishedAt !== null || a.runningSince) return;
  patchActivity(id, { runningSince: now });
}

/** Edit live-activity fields (effort, distance, note). */
export function updateActivity(
  id: string,
  patch: Pick<Partial<Activity>, 'effort' | 'distanceKm' | 'note'>,
): void {
  patchActivity(id, patch);
}

/** Finish a live activity: freeze the clock, store duration & calories. */
export function finishActivity(
  id: string,
  input: { calories?: number | null } = {},
  now: number = Date.now(),
): Activity | null {
  const a = state.activities.find((x) => x.id === id);
  if (!a) return null;
  const elapsedMs =
    (a.accumulatedMs ?? 0) + (a.runningSince ? Math.max(0, now - a.runningSince) : 0);
  const patch: Partial<Activity> = {
    finishedAt: now,
    runningSince: null,
    accumulatedMs: elapsedMs,
    durationMin: Math.round((elapsedMs / 60000) * 10) / 10,
    calories: input.calories ?? a.calories ?? null,
  };
  patchActivity(id, patch);
  return state.activities.find((x) => x.id === id) ?? null;
}

/** Persist a finished (backfilled) activity in one shot. */
export function logActivity(input: {
  type: string;
  category: ActivityCategory;
  startedAt: number;
  finishedAt: number | null;
  durationMin: number;
  calories?: number | null;
  distanceKm?: number | null;
  effort?: ActivityEffort;
  note?: string | null;
}): Activity {
  const activity: Activity = {
    id: uuid(),
    type: input.type,
    category: input.category,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    durationMin: Math.round(input.durationMin * 10) / 10,
    calories: input.calories ?? null,
    distanceKm: input.distanceKm ?? null,
    effort: input.effort ?? 'moderate',
    note: input.note ?? null,
  };
  setState({
    activities: [activity, ...state.activities].sort((a, b) => b.startedAt - a.startedAt),
    syncStatus: bumpPending(),
  });
  writeActivityDoc(activity);
  return activity;
}

export function deleteActivity(id: string): void {
  setState({
    activities: state.activities.filter((a) => a.id !== id),
    syncStatus: bumpPending(),
  });
  deleteActivityDoc(id);
}

/** Discard a live activity (semantic alias of delete, used by the timer page). */
export function discardActivity(id: string): void {
  deleteActivity(id);
}

// --- Weight unit (Load-entry B) --------------------------------------------
/** The account-wide weight unit (kg unless the user picked lb in their profile). */
export function globalWeightUnit(): DisplayUnit {
  return state.weightUnit;
}
/** Set the account-wide weight unit. Per-exercise overrides equal to it are
 *  pruned so they don't linger as no-ops. */
export function setGlobalWeightUnit(unit: DisplayUnit): void {
  const next: Record<string, DisplayUnit> = {};
  for (const [k, v] of Object.entries(state.exerciseUnits)) if (v !== unit) next[k] = v;
  setState({ weightUnit: unit, exerciseUnits: next });
}
/** The display unit for a lift/machine: its override, else the account default. */
export function exerciseUnit(name: string): DisplayUnit {
  return (state.exerciseUnits ?? {})[name.trim().toLowerCase()] ?? state.weightUnit;
}
/** Set (or clear, when it matches the account default) the unit for a machine. */
export function setExerciseUnit(name: string, unit: DisplayUnit): void {
  const key = name.trim().toLowerCase();
  const next = { ...(state.exerciseUnits ?? {}) };
  if (unit === state.weightUnit) delete next[key];
  else next[key] = unit;
  setState({ exerciseUnits: next });
}

// --- Per-exercise load type (Load-entry C) ---------------------------------
/** How a lift is loaded: plain weight, an assisted machine (negative kg help),
 *  or a resistance band (colour → estimated kg). Derived from the exercise
 *  unless the user has pinned an override. */
export function loadTypeFor(ex: Pick<Exercise, 'name' | 'equipment'>): LoadType {
  const override = (state.exerciseLoadTypes ?? {})[ex.name.trim().toLowerCase()];
  if (override) return override;
  return deriveLoadType(ex.name, equipmentFor(ex));
}
/** Pin a load type for a lift; null restores the derived default. */
export function setExerciseLoadType(name: string, type: LoadType | null): void {
  const key = name.trim().toLowerCase();
  const next = { ...(state.exerciseLoadTypes ?? {}) };
  if (type === null) delete next[key];
  else next[key] = type;
  setState({ exerciseLoadTypes: next });
}
/** The band library for a gym, falling back to sensible defaults. */
export function bandLibraryFor(gym: Gym | null | undefined): readonly BandRung[] {
  return gym?.bandLibrary && gym.bandLibrary.length > 0 ? gym.bandLibrary : BAND_DEFAULTS;
}
/** Persist a gym's band library (colour → estimated kg). */
export function setGymBandLibrary(gymId: string, rungs: BandRung[]): void {
  const g = state.gyms.find((x) => x.id === gymId);
  if (!g) return;
  upsertGym({ ...g, bandLibrary: rungs });
}

/** Activities whose start falls on the given local day key. */
export function activitiesOnDay(day: number, list: Activity[] = state.activities): Activity[] {
  return list.filter((a) => dayKey(a.startedAt) === day);
}

/**
 * Consistency streak in days: the unbroken run of days back from today where
 * each day was trained OR counts as rest. Unlogged past days always count as
 * rest (an ordinary gap never resets the streak), as do explicit rest periods;
 * today with nothing logged yet doesn't break the chain.
 */
export function consistencyStreak(now: number = Date.now()): number {
  const finished = state.workouts.filter((w) => w.finishedAt !== null);
  if (finished.length === 0) return 0;
  const trained = new Set(finished.map((w) => dayKey(w.startedAt)));
  const rests = restDayKeys();
  const today = dayKey(now);
  const firstDay = Math.min(...finished.map((w) => dayKey(w.startedAt)));
  let streak = 0;
  for (let d = today; d >= firstDay; d--) {
    // A past day always counts (skipped days are rest); today counts only once
    // something is logged or it falls within a rest period.
    if (trained.has(d) || rests.has(d) || d < today) {
      streak += 1;
    } else if (d === today) {
      continue;
    } else {
      break;
    }
  }
  return streak;
}

/** Latest weigh-in (by time), or null. */
export function latestWeight(bm: BodyMetrics | null | undefined): WeightEntry | null {
  if (!bm?.weights?.length) return null;
  return bm.weights.reduce((a, b) => (b.at >= a.at ? b : a));
}

/** Body v1 §3.2: required-metric completeness — height + at least one weigh-in.
 *  Drives the blocking profile-completion gate for returning users. */
export function bodyMetricsComplete(bm: BodyMetrics): boolean {
  return !!bm.heightCm && bm.heightCm > 0 && bm.weights.length > 0;
}

/** BMI from height (cm) + weight (kg); null if height missing/invalid. */
export function bmiValue(heightCm?: number | null, weightKg?: number | null): number | null {
  if (!heightCm || heightCm <= 0 || !weightKg || weightKg <= 0) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
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
  // Off by default: no location pings unless the gym-presence flag is on, so
  // living next to a gym never fabricates a "log this visit" prompt.
  if (!isFlagOn('gymPresence')) return;
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
        clearStoredRest();
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
      collection(db, 'users', uid, 'restPeriods'),
      (snap) => {
        state = { ...state, restPeriods: snap.docs.map((d) => d.data() as RestPeriod) };
        persist();
        emit();
      },
      // Soft: if the restPeriods rule isn't deployed yet, don't block all sync.
      () => undefined,
    ),
  );
  unsubs.push(
    onSnapshot(
      collection(db, 'users', uid, 'activities'),
      (snap) => {
        state = {
          ...state,
          activities: snap.docs
            .map((d) => d.data() as Activity)
            .sort((a, b) => b.startedAt - a.startedAt),
        };
        persist();
        emit();
      },
      // Soft: if the activities rule isn't deployed yet, don't block all sync.
      () => undefined,
    ),
  );
  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid, 'meta', 'body'),
      (snap) => {
        const data = snap.exists() ? (snap.data() as BodyMetrics) : EMPTY_BODY;
        state = { ...state, bodyMetrics: { ...data, weights: data.weights ?? [] } };
        persist();
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
  // Optimistic register under the REAL id (upsert by id). The previous code
  // registered a `pending-<id>` twin and only added the real id after the server
  // confirmed — with no emit — so the list showed BOTH until a reload let the
  // server snapshot replace it. One entry under the real id: edit is live, no
  // duplicate; the snapshot reconciles it afterwards.
  registerCustomExercise({ id, ...meta });
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
  }).catch(onWriteError);
}

/** Edit a custom catalog exercise. Handles rename (id = lowercased name): if the
 *  name changed, the old doc is removed and a new one written. */
export function updateCatalogExercise(
  oldId: string,
  meta: {
    name: string;
    kind?: string;
    primaryMuscle: MuscleGroup | null;
    secondaryMuscles: MuscleGroup[];
    equipment: string[];
  },
): void {
  const role = getRole();
  if (role !== 'admin' && role !== 'trainer') return;
  const newId = meta.name.trim().toLowerCase();
  if (newId !== oldId) {
    registerCustomExercises(customExercises().filter((e) => e.id !== oldId));
    deleteDoc(doc(db, 'exerciseCatalog', oldId)).catch(onWriteError);
  }
  saveCatalogExercise(meta);
}

/** Delete a custom catalog exercise (optimistic local remove + Firestore). */
export function deleteCatalogExercise(id: string): void {
  const role = getRole();
  if (role !== 'admin' && role !== 'trainer') return;
  registerCustomExercises(customExercises().filter((e) => e.id !== id));
  emit();
  deleteDoc(doc(db, 'exerciseCatalog', id)).catch(onWriteError);
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
      // AC-DS-07: records consider the parent entry only — a drop (even a
      // heavier reverse-drop) can never set or break a record.
      for (const s of e.sets) {
        const parent = s.weight ?? 0;
        if (setTypeOf(s) !== 'warmup' && parent > max) max = parent;
      }
    }
  }
  return max;
}
export const E1RM_MAX_REPS = 10;

export function est1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps < 1 || reps > E1RM_MAX_REPS) return 0;
  return Math.round(weight * (1 + reps / 30));
}

export function estimatedOneRepMaxSet(sets: SetEntry[]): SetEntry | undefined {
  return [...sets]
    .filter((s) => setTypeOf(s) !== 'warmup' && est1rm(s.weight ?? 0, s.reps) > 0)
    .sort((a, b) => est1rm(b.weight ?? 0, b.reps) - est1rm(a.weight ?? 0, a.reps))[0];
}
export interface MyExercise {
  /** Catalogue id, or `logged-<name>` for a history-only user exercise. */
  id: string;
  name: string;
  primaryMuscle: MuscleGroup | null;
  secondaryMuscles: MuscleGroup[];
  equipment: string[];
  /** 'catalog' = saved to exerciseCatalog (editable + deletable);
   *  'logged'  = created ad-hoc in a session, not yet in the catalogue. */
  source: 'catalog' | 'logged';
}

/**
 * The user's own exercises: everything they created — both saved catalogue
 * entries AND names they logged ad-hoc that aren't built-in library lifts.
 * The latter is why manually-created exercises show up even if they were never
 * written to the shared catalogue.
 */
export function myExercises(): MyExercise[] {
  const out: MyExercise[] = customExercises().map((e) => ({
    id: e.id,
    name: e.name,
    primaryMuscle: e.primaryMuscle,
    secondaryMuscles: e.secondaryMuscles,
    equipment: e.equipment,
    source: 'catalog' as const,
  }));
  const seen = new Set(out.map((e) => e.name.trim().toLowerCase()));
  for (const w of state.workouts) {
    for (const e of w.exercises) {
      if (!isStrengthExercise(e)) continue;
      const key = e.name.trim().toLowerCase();
      if (!key || seen.has(key) || isBuiltInExercise(e.name)) continue;
      seen.add(key);
      const rm = resolveMuscles(e);
      out.push({
        id: `logged-${key}`,
        name: e.name.trim(),
        primaryMuscle: rm.primary,
        secondaryMuscles: rm.secondary,
        equipment: (e.equipment ?? []) as string[],
        source: 'logged',
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
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
  localStorage.removeItem(BODY_KEY);
  localStorage.removeItem(REST_KEY);
  localStorage.removeItem(ACTIVITIES_KEY);
  localStorage.removeItem(WEIGHT_UNIT_KEY);
  localStorage.removeItem(EX_UNIT_KEY);
  localStorage.removeItem(EX_LOAD_KEY);
  pings = [];
  dismissals = [];
  state = {
    workouts: [],
    gyms: [],
    reminders: [],
    restPeriods: [],
    activities: [],
    weightUnit: 'kg',
    exerciseUnits: {},
    exerciseLoadTypes: {},
    bodyMetrics: EMPTY_BODY,
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
