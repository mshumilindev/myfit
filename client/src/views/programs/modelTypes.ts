/** The pure shapes of a program's rows and cycle (types only), so seams can name them without importing the model's code. */
import type { ExerciseKind } from '../../types';
import type { EquipmentId } from '../../data/equipment';
import type { MuscleGroup } from '../../data/exercises';

/**
 * An exercise of a program day's warm-up: a reference to an exercise the app
 * already has (its canonical catalog name + id) with an optional target — reps
 * OR seconds. No free text: program items are stored like the lifts already are
 * (catalog names), nothing new that a person types.
 */
export interface ProgramWarmupItem {
  id: string;
  name: string;
  exerciseId?: string;
  reps?: number;
  durationSec?: number;
  /** Target load in kg (weighted moves only; optional, old data has none). */
  weight?: number;
}

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
  /** Warm-up marker only: the exercises it holds (absent = a generic warm-up). */
  warmupItems?: ProgramWarmupItem[];
  /**
   * Trainer layer (Coach editor). "Just the exercise": no sets, reps or targets; stored as sets 0 / reps 0.
   * A bare row is valid to save, assign and send; the client picks the numbers in the session.
   */
  bare?: boolean;
  /** Optional targets shown to the client above the set (absent = no target). */
  targetWeight?: number;
  targetRpe?: number;
  /** Rest between sets, seconds. */
  restSec?: number;
  /** A cue shown above the set. */
  note?: string;
  /** Load as a percent of the person's max for this exercise (Advanced training › Periodization). Wins over `targetWeight` when a max is known. */
  targetPct?: number;
  /** Lower end of a rep range; `reps` is the upper end (absent = one number). */
  repsMin?: number;
}

/** What kind of week a cycle week is (the hint every week shows). Absent = a base week. */
export type CycleLabel = 'deload' | 'test' | 'peak';

/** The days of one cycle week. Planned activities are the same every week, so they are not part of it. */
export interface WeekPlan {
  label?: CycleLabel;
  dayNames: Record<string, string>;
  targetMuscles: Record<string, MuscleGroup[]>;
  items: ProgramItem[];
}

/**
 * Optional weekly cycle (Advanced training › Periodization). Cycle week 1 is the program's own days (`items`, `dayNames`,
 * `targetMuscles`); `weeks` holds cycle weeks 2..`length`, so `weeks.length === length - 1`. Week n of the program uses
 * cycle week ((n - 1) mod length) + 1.
 */
export interface ProgramCycle {
  length: number;
  /** The hint of cycle week 1. */
  baseLabel?: CycleLabel;
  weeks: WeekPlan[];
}
