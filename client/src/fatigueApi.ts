/**
 * The core side of the Fatigue & readiness add-on (SPO-558). The numbers that steer the app (the session builder, the exercise
 * picker, the rest timer, the RPE estimate, the set bars) read the history through these two functions: while the add-on is
 * installed they get the real history, so every value is exactly what it was before; without it they get none, and the same
 * functions return their value for an empty history (everything ready, nothing tired). Stored workouts are never touched.
 */
import type { Workout } from './types';
import { fatigueAvailable, readinessAvailable } from './addons/featureGates';

const NONE: Workout[] = [];

/** The history the fatigue numbers may read: all of it with Fatigue installed, none without. */
export function fatigueSource(finished: Workout[]): Workout[] {
  return fatigueAvailable() ? finished : NONE;
}

/** The history the readiness numbers may read: all of it with Readiness installed, none without. */
export function readinessSource(finished: Workout[]): Workout[] {
  return readinessAvailable() ? finished : NONE;
}
