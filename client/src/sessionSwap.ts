/**
 * The planned exercise for a swap in the session builder: the candidate lift
 * in the slot of the one it replaces, with its own progression target. After a
 * break (SPO-149) the target is the lighter 'return' one and the warm-up ramp
 * gets its extra rung, exactly as `buildDay` does for the exercises it picks.
 */
import { nextTarget, topHistory } from './progression';
import { muscleGapDays } from './recovery';
import { deriveLoadType } from './loads';
import { warmupRamp } from './sessionDose';
import type { Candidate, PlannedExercise } from './sessionBuilder';
import type { Workout } from './types';

export function swapExercise(
  cand: Candidate,
  slot: PlannedExercise,
  finished: Workout[],
  now: number,
  bodyKg: number | null,
): PlannedExercise {
  const equipment = cand.equipment ? [cand.equipment] : [];
  const loadType = deriveLoadType(cand.name, equipment);
  const target = nextTarget(topHistory(finished, cand.name, now), {
    plannedReps: slot.repHigh,
    equipment,
    primary: cand.primary ?? undefined,
    loadType,
    now,
    bodyKg,
  });
  const gapDays = cand.primary ? muscleGapDays(finished, cand.primary, now) : null;
  return {
    name: cand.name,
    kind: 'strength',
    primary: cand.primary,
    secondary: cand.secondary,
    equipment,
    loadType,
    sets: slot.sets,
    repLow: slot.repLow,
    repHigh: slot.repHigh,
    targetWeight: target.weight,
    deltaKg: target.deltaKg,
    progState: target.state,
    warmup: warmupRamp(target.weight, { loadType, compound: cand.compound, gapDays }),
    whyKey: slot.whyKey,
    priority: slot.priority,
  };
}
