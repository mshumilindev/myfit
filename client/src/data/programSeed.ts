/**
 * One-shot hand-off for the "Suggest a program" banner (Today → Programs).
 * Today builds a draft from the user's real history and stashes it here; the
 * Programs view picks it up on mount and opens the editor prefilled. Kept as a
 * module-level value (not the synced store) because it's a transient, local
 * navigation payload — taken exactly once.
 */
import type { Exercise, Workout, ExerciseKind } from '../types';
import { muscleInfoByName, type MuscleGroup } from './exercises';

export interface ProgramSeedItem {
  id: string;
  day: number;
  position: number;
  name: string;
  kind: ExerciseKind;
  sets: number;
  reps: number;
  durationMin: number | null;
  equipment: string[];
}

export interface ProgramSeed {
  name: string;
  weeks: number;
  daysPerWeek: number;
  dayNames: Record<string, string>;
  targetMuscles: Record<string, MuscleGroup[]>;
  items: ProgramSeedItem[];
}

export interface ProgramSuggestionReadiness {
  ready: boolean;
  finishedCount: number;
  trainedDays: number;
  liftSessions: number;
}

let pending: ProgramSeed | null = null;

export function setProgramSeed(seed: ProgramSeed): void {
  pending = seed;
}

/** Return and clear the pending seed (consumed once). */
export function takeProgramSeed(): ProgramSeed | null {
  const s = pending;
  pending = null;
  return s;
}

/** Read without clearing; safe for React Strict Mode's duplicate dev renders. */
export function peekProgramSeed(): ProgramSeed | null {
  return pending;
}

/** Clear only after the Programs view has committed its initial draft. */
export function clearProgramSeed(seed: ProgramSeed | null): void {
  if (seed && pending === seed) pending = null;
}

/** Mon=1 … Sun=7 from a ms timestamp. */
function weekday(ms: number): number {
  const d = new Date(ms).getDay();
  return d === 0 ? 7 : d;
}

function hasPlanworthyLift(w: Workout): boolean {
  return w.exercises.some((ex) => {
    if (ex.kind && ex.kind !== 'strength' && ex.kind !== 'warmup' && ex.kind !== 'cooldown') {
      return false;
    }
    return ex.name.trim().length > 0 && (ex.sets.length > 0 || (ex.plannedSets ?? 0) > 0);
  });
}

function primaryMuscleOf(ex: Exercise): MuscleGroup | null {
  const primary = ex.primaryMuscle ?? muscleInfoByName(ex.name)?.primary ?? null;
  return primary && primary !== 'cardio' ? (primary as MuscleGroup) : null;
}

function targetMusclesForWorkout(w: Workout): MuscleGroup[] {
  const order: MuscleGroup[] = [];
  const counts = new Map<MuscleGroup, number>();
  for (const ex of [...w.exercises].sort((a, b) => a.position - b.position)) {
    const primary = primaryMuscleOf(ex);
    if (!primary) continue;
    if (!counts.has(primary)) order.push(primary);
    counts.set(primary, (counts.get(primary) ?? 0) + Math.max(1, ex.sets.length));
  }
  return order.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)).slice(0, 4);
}

/**
 * The suggestion banner should appear when we can infer a usable weekly shape,
 * not only after an arbitrary number of sessions. Three lift sessions across at
 * least two weekdays is enough to draft a program the user can edit.
 */
export function programSuggestionReadiness(finished: Workout[]): ProgramSuggestionReadiness {
  const recent = [...finished]
    .filter((w) => w.finishedAt !== null)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 14);
  const liftSessions = recent.filter(hasPlanworthyLift);
  const trainedDays = new Set(liftSessions.map((w) => weekday(w.startedAt))).size;
  return {
    ready: liftSessions.length >= 3 && trainedDays >= 2,
    finishedCount: recent.length,
    trainedDays,
    liftSessions: liftSessions.length,
  };
}

/**
 * Build a program draft from finished workouts.
 * - The training days are the weekdays the user actually trained on recently.
 * - `withLifts` also prefills each day with the exercises from the most recent
 *   session on that weekday (the "last week's lifts" option).
 * Weight is never carried — a program prescribes work, not load.
 */
export function buildProgramSeed(
  finished: Workout[],
  withLifts: boolean,
  name: string,
): ProgramSeed {
  // Newest first, cap to ~3 recent weeks of history.
  const recent = [...finished].sort((a, b) => b.startedAt - a.startedAt).slice(0, 14);

  const dayNames: Record<string, string> = {};
  const targetMuscles: Record<string, MuscleGroup[]> = {};
  const trainedDays = new Set<number>();
  const latestByDay = new Map<number, Workout>();
  for (const w of recent) {
    const day = weekday(w.startedAt);
    trainedDays.add(day);
    if (!latestByDay.has(day)) latestByDay.set(day, w);
    if (w.dayName && !dayNames[String(day)]) dayNames[String(day)] = w.dayName;
  }

  const items: ProgramSeedItem[] = [];
  for (const [day, w] of latestByDay) {
    const muscles = targetMusclesForWorkout(w);
    if (muscles.length) targetMuscles[String(day)] = muscles;
  }
  if (withLifts) {
    for (const [day, w] of latestByDay) {
      let position = 0;
      for (const ex of w.exercises) {
        if (ex.kind && ex.kind !== 'strength' && ex.kind !== 'warmup' && ex.kind !== 'cooldown') {
          // skip pure cardio entries from the plan's lift list
          continue;
        }
        const working = ex.sets.filter((s) => !s.isWarmup);
        const setCount = working.length || ex.sets.length || ex.plannedSets || 3;
        const reps =
          ex.plannedReps ?? working.find((s) => s.reps > 0)?.reps ?? ex.sets[0]?.reps ?? 10;
        items.push({
          id: crypto.randomUUID(),
          day,
          position: position++,
          name: ex.name,
          kind: (ex.kind as ExerciseKind) ?? 'strength',
          sets: Math.max(1, setCount),
          reps: Math.max(1, reps),
          durationMin: null,
          equipment: [...(ex.equipment ?? [])],
        });
      }
    }
  }

  const daysPerWeek = Math.max(1, Math.min(7, trainedDays.size));
  return { name, weeks: 8, daysPerWeek, dayNames, targetMuscles, items };
}
