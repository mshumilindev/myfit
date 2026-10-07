/**
 * Exercise profiles — the one place that knows HOW a catalog move is logged.
 *
 *   measure  what a set is counted in: reps · a timed hold · cardio time · distance
 *   load     what the weight cell means: weight (kg) · bodyweight · bw_plus
 *            (bodyweight + optional added kg) · assist · band · none
 *
 * The table (`exerciseProfiles.json`, keyed by catalog id) is hand-curated data:
 * edit it directly. Custom / unknown moves fall back to a small name rule.
 *
 * Legacy-safe by design: a profile only decides the DEFAULT for an exercise that is
 * being added now. Anything already logged keeps what it was saved with —
 * `Exercise.measure` stays the stored truth, so old planks logged as reps/kg are never
 * reinterpreted.
 */
import PROFILES_RAW from './exerciseProfiles.json';
import { richExerciseByName } from './exercises';

export type ExerciseMeasure = 'reps' | 'hold' | 'time' | 'distance';
export type ExerciseLoad = 'weight' | 'bodyweight' | 'bw_plus' | 'assist' | 'band' | 'none';

export interface ExerciseProfile {
  m: ExerciseMeasure;
  l: ExerciseLoad;
}

const PROFILES = PROFILES_RAW as Record<string, ExerciseProfile>;

const REPS_WEIGHT: ExerciseProfile = { m: 'reps', l: 'weight' };

/** Name rule for moves the table does not know (own moves, other languages' free text). */
const HOLD_NAME =
  /\bplank\b|side bridge|wall sit|isometric|dead hang|hollow hold|l-sit|vacuum|планк|утримання/i;
const NOT_HOLD_NAME = /plank (jack|walk)|to side plank|hang (clean|snatch)|hanging|wipers/i;

/** Profile of a move by (any-locale) name; custom moves are derived from the name. */
export function exerciseProfile(name: string | null | undefined): ExerciseProfile {
  if (!name) return REPS_WEIGHT;
  const rich = richExerciseByName(name);
  const row = rich ? PROFILES[rich.id] : undefined;
  if (row) return row;
  if (HOLD_NAME.test(name) && !NOT_HOLD_NAME.test(name)) return { m: 'hold', l: 'none' };
  if (/assist/i.test(name)) return { m: 'reps', l: 'assist' };
  return REPS_WEIGHT;
}

/**
 * The measure a freshly added strength exercise starts with. Only the stopwatch hold
 * is wired in the session today; time / distance moves still log as reps until their
 * own entry exists, so this never returns them.
 */
export function defaultMeasure(name: string | null | undefined): 'reps' | 'hold' {
  return exerciseProfile(name).m === 'hold' ? 'hold' : 'reps';
}

/** Every catalog id with its profile (for audits and tests). */
export const EXERCISE_PROFILES: Readonly<Record<string, ExerciseProfile>> = PROFILES;
