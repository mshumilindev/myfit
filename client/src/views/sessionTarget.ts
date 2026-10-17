/**
 * The progression target of one exercise of a live session, from that lift's own
 * finished history before the session started. The session's start is the clock
 * for break detection (SPO-149), so the target does not change mid-session or at
 * midnight, and `bodyKg` sizes the extra help of an assisted machine after a break.
 */
import { latestWeight, liftVariant, type StoreState } from '../store';
import { nextTarget, topHistory, type ProgOpts, type Target } from '../progression';
import type { Exercise, Workout } from '../types';

export function sessionLiftTarget(
  store: Pick<StoreState, 'workouts' | 'bodyMetrics'>,
  workout: Workout,
  ex: Exercise,
  opts: Omit<ProgOpts, 'now' | 'bodyKg'>,
): Target {
  const finished = store.workouts.filter((w) => w.finishedAt !== null);
  return nextTarget(topHistory(finished, ex.name, workout.startedAt, liftVariant(workout, ex)), {
    ...opts,
    now: workout.startedAt,
    bodyKg: latestWeight(store.bodyMetrics)?.weight ?? null,
  });
}
