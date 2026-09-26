/**
 * The signed-in member's assigned program, shared by Today, the Start sheet and
 * the Overview tab. The assignment is cached in localStorage so every surface
 * paints instantly and only revalidates in the background (no cold fetch on
 * every visit); a draft program (status ≠ active) is hidden until activated.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { callFn } from '../api';
import { addExercise, startWorkout } from '../store';
import type { ExerciseKind } from '../types';
import type { EquipmentId } from './equipment';
import { muscleInfoByName, type MuscleGroup } from './exercises';
import { exerciseDay, type TrainingDay } from './daySuggest';
import type { Play } from '../playbook';

export interface ProgramItem {
  id: string;
  day: number;
  position: number;
  name: string;
  kind: ExerciseKind;
  sets: number;
  reps: number;
  durationMin: number | null;
  equipment: EquipmentId[];
  groupId?: string | null;
  groupOrder?: number | null;
  dropLast?: boolean;
}

export interface ProgramAssignment {
  program: {
    id: string;
    authorId?: string;
    name: string;
    weeks: number;
    daysPerWeek: number;
    dayNames?: Record<string, string>;
    /** Per-day target muscle groups (muscle-only or mixed days). */
    targetMuscles?: Record<string, MuscleGroup[]>;
    items: ProgramItem[];
  };
  assignedBy: string | null;
  week: number;
  done: number;
  total: number;
  expectedSoFar: number;
  adherence: number | null;
}

const PROGRAM_CACHE_KEY = 'spotter.programMine';

export function readProgramCache(): ProgramAssignment | null {
  try {
    const raw = localStorage.getItem(PROGRAM_CACHE_KEY);
    return raw ? (JSON.parse(raw) as ProgramAssignment) : null;
  } catch {
    return null;
  }
}

function writeProgramCache(a: ProgramAssignment | null): void {
  try {
    if (a) localStorage.setItem(PROGRAM_CACHE_KEY, JSON.stringify(a));
    else localStorage.removeItem(PROGRAM_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

interface ProgramMineState {
  assignment: ProgramAssignment | null;
  /** False only when the program doc is readable and not `active`. */
  active: boolean;
}

let snapshot: ProgramMineState = { assignment: readProgramCache(), active: true };
const listeners = new Set<() => void>();
let statusFor: string | null = null;

function emit(next: ProgramMineState): void {
  snapshot = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function checkStatus(a: ProgramAssignment | null): void {
  if (!a) {
    statusFor = null;
    if (!snapshot.active) emit({ ...snapshot, active: true });
    return;
  }
  if (statusFor === a.program.id) return;
  statusFor = a.program.id;
  getDoc(doc(db, 'programs', a.program.id))
    .then((snap) => {
      if (snapshot.assignment?.program.id !== a.program.id) return;
      const status = snap.exists() ? (snap.data() as { status?: string }).status : undefined;
      // Unknown/unreadable → keep showing; only a readable non-active hides it.
      emit({ ...snapshot, active: status === undefined ? true : status === 'active' });
    })
    .catch(() => {
      if (snapshot.assignment?.program.id === a.program.id) emit({ ...snapshot, active: true });
    });
}

/** Re-fetch the assignment (keeps the cached one on a transient error). */
export function refreshProgramMine(): void {
  callFn<{ assignment: ProgramAssignment | null }>('programMine')
    .then((data) => {
      writeProgramCache(data.assignment);
      if (data.assignment?.program.id !== snapshot.assignment?.program.id) statusFor = null;
      emit({ ...snapshot, assignment: data.assignment });
      checkStatus(data.assignment);
    })
    .catch(() => {
      /* keep whatever was cached — don't blank the card on a transient error */
    });
}

/** The assigned program (cached, revalidated once per mount of the caller). */
export function useProgramMine(): ProgramMineState {
  const state = useSyncExternalStore(subscribe, () => snapshot);
  useEffect(() => {
    checkStatus(snapshot.assignment);
    refreshProgramMine();
  }, []);
  return state;
}

// --- Program-day helpers ---------------------------------------------------

export function programDayItems(a: ProgramAssignment, day: number): ProgramItem[] {
  return a.program.items.filter((i) => i.day === day).sort((x, y) => x.position - y.position);
}

export function programDayMuscles(a: ProgramAssignment, day: number): MuscleGroup[] {
  return a.program.targetMuscles?.[String(day)] ?? [];
}

/** A real training day prescribes lifts OR names target muscles. */
export function programDayHasPlan(a: ProgramAssignment, day: number): boolean {
  return programDayItems(a, day).length > 0 || programDayMuscles(a, day).length > 0;
}

export function programDayName(
  a: ProgramAssignment,
  day: number,
  fallback: (day: number) => string,
): string {
  return a.program.dayNames?.[String(day)] || fallback(day);
}

/** Push / pull / legs / core / full for a program day, from its lifts' primary
 *  muscles (by prescribed sets), else its target muscles. */
export function programDayType(a: ProgramAssignment, day: number): TrainingDay | null {
  const tally = new Map<TrainingDay, number>();
  for (const it of programDayItems(a, day)) {
    if (it.kind !== 'strength') continue;
    const d = exerciseDay(muscleInfoByName(it.name)?.primary ?? null);
    if (d) tally.set(d, (tally.get(d) ?? 0) + Math.max(1, it.sets));
  }
  if (tally.size === 0) {
    for (const m of programDayMuscles(a, day)) {
      const d = exerciseDay(m);
      if (d) tally.set(d, (tally.get(d) ?? 0) + 1);
    }
  }
  let best: TrainingDay | null = null;
  let n = 0;
  for (const [d, c] of tally) {
    if (c > n) {
      n = c;
      best = d;
    }
  }
  return best;
}

/** Start a live session pre-filled with a program day's prescription. Returns
 *  the new workout id, or null when another live mode blocks it. */
export function startProgramDaySession(
  a: ProgramAssignment,
  day: number,
  dayName: string,
): string | null {
  const items = programDayItems(a, day);
  const w = startWorkout(null, { dayName, targetMuscles: programDayMuscles(a, day) });
  if (!w) return null;
  for (const item of items) {
    addExercise(w.id, item.name, item.kind, {
      plannedSets: item.kind === 'strength' ? item.sets : 1,
      plannedReps: item.kind === 'strength' ? item.reps : null,
      plannedDurationMin: item.kind === 'strength' ? null : (item.durationMin ?? 10),
      equipment: item.equipment,
      // A prescribed superset arrives grouped (EQ-2 → SS-1).
      groupId: item.groupId ?? null,
      groupOrder: item.groupOrder ?? null,
    });
  }
  return w.id;
}

/** Start a live session from a learned Playbook play (same prescription the
 *  Playbook "Start" button builds). Returns the workout id or null. */
export function startPlaySession(p: Play, warmupName: string): string | null {
  const w = startWorkout(null, {
    dayName: p.name ?? undefined,
    targetMuscles: p.coverage.filter((c) => c.primary).map((c) => c.muscle),
  });
  if (!w) return null;
  if (p.opensWithWarmup) addExercise(w.id, warmupName, 'warmup');
  for (const ex of p.exercises) {
    addExercise(w.id, ex.name, 'strength', {
      plannedSets: ex.sets,
      plannedReps: ex.repHigh || ex.repLow || null,
      primaryMuscle: ex.primary ?? undefined,
      secondaryMuscles: ex.secondary,
    });
  }
  return w.id;
}
