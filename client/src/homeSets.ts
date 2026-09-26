/**
 * Home set (design "Spotter — Home set"): short bodyweight sessions done at
 * home — a stomach vacuum, pull-ups on the doorway bar, push-ups. A home set is
 * a named template (a list of moves); starting one opens a normal live session
 * (Workout.kind = 'home', no gym) so the logger, rest, fatigue and history all
 * work as for a gym session. Moves come from Spotter's home catalog (real
 * exercises from the base, so they have details/photos) or are the athlete's own
 * (a name, how it's measured, a muscle and an icon — no details).
 *
 * Pure data + helpers; the store owns persistence and sync.
 */
import type { MuscleGroup } from './data/exercises';
import type { Exercise, Workout } from './types';

/** How a move is logged: reps (stepper) or a hold / time (stopwatch). */
export type HomeMeasure = 'reps' | 'hold' | 'time';

/** Icon keys for home moves (drawn by HomeMoveIcon). */
export const HOME_ICONS = [
  'hand',
  'bar',
  'pushup',
  'vacuum',
  'dip',
  'squat',
  'plank',
  'body',
  'door',
  'bolt',
  'timer',
  'spark',
] as const;
export type HomeIcon = (typeof HOME_ICONS)[number];

/** A move you can put into a home set. */
export interface HomeMove {
  /** Catalog moves: the exercise name in the base. Own moves: a uuid. */
  id: string;
  /** Exercise name used in the session (catalog: the base name). */
  name: string;
  measure: HomeMeasure;
  muscle: MuscleGroup;
  icon: HomeIcon;
  /** The athlete's own move (not in the exercise base → no details). */
  custom?: boolean;
  updatedAt?: number;
}

/** A named home set: an ordered list of move ids. */
export interface HomeSet {
  id: string;
  name: string;
  moves: string[];
  createdAt: number;
  updatedAt: number;
}

/** Synced as users/{uid}/meta/home (last-write-wins). */
export interface HomeState {
  sets: HomeSet[];
  /** Own moves only; catalog moves are code. */
  moves: HomeMove[];
  updatedAt?: number;
}

export const EMPTY_HOME: HomeState = { sets: [], moves: [] };

/** Idle limit: a live home set with no new set for this long finishes itself. */
export const HOME_IDLE_MS = 20 * 60 * 1000;
/** Default duration offered when a home set is logged in the past. */
export const HOME_BACKFILL_MIN = 10;

/**
 * Spotter's home moves — exercises from the base that need nothing but a floor,
 * a chair or a doorway bar. Names match the base so details, photos and muscle
 * maths come for free.
 */
export const HOME_CATALOG: HomeMove[] = [
  { id: 'Stomach Vacuum', name: 'Stomach Vacuum', measure: 'hold', muscle: 'core', icon: 'vacuum' },
  { id: 'Pullups', name: 'Pullups', measure: 'reps', muscle: 'lats', icon: 'bar' },
  { id: 'Pushups', name: 'Pushups', measure: 'reps', muscle: 'chest', icon: 'pushup' },
  { id: 'Bench Dips', name: 'Bench Dips', measure: 'reps', muscle: 'triceps', icon: 'dip' },
  {
    id: 'Bodyweight Squat',
    name: 'Bodyweight Squat',
    measure: 'reps',
    muscle: 'quads',
    icon: 'squat',
  },
  { id: 'Plank', name: 'Plank', measure: 'hold', muscle: 'core', icon: 'plank' },
  { id: 'Chin-Up', name: 'Chin-Up', measure: 'reps', muscle: 'lats', icon: 'bar' },
  {
    id: 'Butt Lift (Bridge)',
    name: 'Butt Lift (Bridge)',
    measure: 'reps',
    muscle: 'glutes',
    icon: 'body',
  },
  { id: 'Side Bridge', name: 'Side Bridge', measure: 'hold', muscle: 'core', icon: 'plank' },
  { id: 'Superman', name: 'Superman', measure: 'reps', muscle: 'lower_back', icon: 'body' },
  {
    id: 'Hanging Leg Raise',
    name: 'Hanging Leg Raise',
    measure: 'reps',
    muscle: 'core',
    icon: 'bar',
  },
  { id: 'Crunches', name: 'Crunches', measure: 'reps', muscle: 'core', icon: 'body' },
  { id: 'Russian Twist', name: 'Russian Twist', measure: 'reps', muscle: 'core', icon: 'body' },
];

const CATALOG_BY_ID = new Map(HOME_CATALOG.map((m) => [m.id, m]));

/** Muscles offered when creating your own move. */
export const HOME_MUSCLES: MuscleGroup[] = [
  'forearms',
  'lats',
  'core',
  'shoulders',
  'chest',
  'triceps',
  'biceps',
  'quads',
  'glutes',
  'hamstrings',
  'calves',
  'lower_back',
];

/** Every move you can pick: your own first, then the catalog. */
export function allHomeMoves(home: HomeState): HomeMove[] {
  return [...home.moves, ...HOME_CATALOG];
}

/** Resolve a move id (catalog name or own-move uuid). */
export function homeMoveById(home: HomeState, id: string): HomeMove | null {
  return home.moves.find((m) => m.id === id) ?? CATALOG_BY_ID.get(id) ?? null;
}

/** The move behind a session exercise (by name — own-move names are unique). */
export function homeMoveForExercise(home: HomeState, ex: Pick<Exercise, 'name'>): HomeMove | null {
  const n = ex.name.trim().toLowerCase();
  return (
    home.moves.find((m) => m.name.trim().toLowerCase() === n) ??
    HOME_CATALOG.find((m) => m.name.toLowerCase() === n) ??
    null
  );
}

/** A move's set list resolved, dropping ids that no longer exist. */
export function homeSetMoves(home: HomeState, set: HomeSet): HomeMove[] {
  return set.moves.map((id) => homeMoveById(home, id)).filter((m): m is HomeMove => !!m);
}

/** Whether a workout is a home set session. */
export function isHomeWorkout(w: Pick<Workout, 'kind'> | null | undefined): boolean {
  return !!w && w.kind === 'home';
}

/** Is this exercise logged with a stopwatch (hold / time) instead of reps? */
export function isStopwatchExercise(ex: Pick<Exercise, 'measure'>): boolean {
  return ex.measure === 'hold' || ex.measure === 'time';
}

/** A valid own-move name: trimmed, 1–40 chars, not clashing with another move. */
export function ownMoveNameError(
  home: HomeState,
  name: string,
  selfId: string | null = null,
): 'empty' | 'taken' | null {
  const n = name.trim();
  if (!n) return 'empty';
  const low = n.toLowerCase();
  const clash =
    home.moves.some((m) => m.id !== selfId && m.name.trim().toLowerCase() === low) ||
    HOME_CATALOG.some((m) => m.name.toLowerCase() === low);
  return clash ? 'taken' : null;
}

/** When a home set was last done (finished home workouts with its id). */
export function lastRunOf(
  workouts: Workout[],
  setId: string,
): { at: number; durationMin: number } | null {
  let best: Workout | null = null;
  for (const w of workouts) {
    if (w.kind !== 'home' || w.homeSetId !== setId || w.finishedAt === null) continue;
    if (!best || w.startedAt > best.startedAt) best = w;
  }
  if (!best || best.finishedAt === null) return null;
  return {
    at: best.startedAt,
    durationMin: Math.max(1, Math.round((best.finishedAt - best.startedAt) / 60000)),
  };
}

/** Last time a move was done in any session: "3 × 25 s" / "5 · 6 · 5". */
export function lastSetsOf(
  workouts: Workout[],
  name: string,
): { at: number; values: number[]; hold: boolean } | null {
  const low = name.toLowerCase();
  let best: { at: number; ex: Exercise } | null = null;
  for (const w of workouts) {
    if (w.finishedAt === null) continue;
    for (const ex of w.exercises) {
      if (ex.name.toLowerCase() !== low || ex.sets.length === 0) continue;
      if (!best || w.startedAt > best.at) best = { at: w.startedAt, ex };
    }
  }
  if (!best) return null;
  const hold =
    isStopwatchExercise(best.ex) || best.ex.sets.every((s) => s.type === 'static-dynamic');
  const values = best.ex.sets.map((s) => (hold ? Math.round((s.durationMin ?? 0) * 60) : s.reps));
  return { at: best.at, values, hold };
}

/**
 * When a live home set should finish itself: HOME_IDLE_MS after the last set
 * (or after the start when nothing was logged). Null for other workouts.
 */
export function homeIdleDeadline(w: Workout): number | null {
  if (w.kind !== 'home' || w.finishedAt !== null) return null;
  let last = w.startedAt;
  for (const ex of w.exercises)
    for (const s of ex.sets) if (s.loggedAt && s.loggedAt > last) last = s.loggedAt;
  return last + HOME_IDLE_MS;
}

/** The time a home set that went idle is closed at: its last set (or start). */
export function homeIdleFinishAt(w: Workout): number {
  let last = w.startedAt;
  for (const ex of w.exercises)
    for (const s of ex.sets) if (s.loggedAt && s.loggedAt > last) last = s.loggedAt;
  return last;
}

/** Totals for a home workout: sets, reps (reps moves) and hold seconds. */
export function homeTotals(w: Workout): { sets: number; reps: number; holdSec: number } {
  let sets = 0;
  let reps = 0;
  let holdSec = 0;
  for (const ex of w.exercises)
    for (const s of ex.sets) {
      sets++;
      if (isStopwatchExercise(ex) || s.type === 'static-dynamic')
        holdSec += Math.round((s.durationMin ?? 0) * 60);
      else reps += s.reps;
    }
  return { sets, reps, holdSec };
}
