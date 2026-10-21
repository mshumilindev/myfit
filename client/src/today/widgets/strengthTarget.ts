/**
 * The progression target of a lift for the strength widgets' plan preview. `now` makes a
 * lift not trained for weeks a 'return' target (SPO-149); `bodyKg` sizes the extra help
 * of an assisted machine after a break.
 */
import { loadTypeFor } from '../../store';
import { nextTarget, topHistory, type Target } from '../../progression';
import { muscleInfoByName } from '../../data/exercises';
import type { Workout } from '../../types';

export function targetFor(
  fin: Workout[],
  name: string,
  plannedReps: number | null,
  equipment: string[],
  now: number,
  bodyKg: number | null,
): Target {
  return nextTarget(topHistory(fin, name), {
    plannedReps,
    equipment,
    primary: muscleInfoByName(name)?.primary ?? null,
    loadType: loadTypeFor({ name, equipment }),
    now,
    bodyKg,
  });
}
