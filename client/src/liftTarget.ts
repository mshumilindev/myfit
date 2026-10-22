/**
 * The progression target of a lift from finished history only (no live workout):
 * the start screen, the hero line, the atlas answers. One place fills in what the
 * lift is (equipment, muscle, load type), so an assisted machine or a band never
 * falls back to plain-weight rules after a break (SPO-149).
 */
import { equipmentFor, latestWeight, loadTypeFor, type StoreState } from './store';
import { nextTarget, topHistory, type ProgOpts, type Target } from './progression';
import { muscleInfoByName } from './data/exercises';
import type { Workout } from './types';

export function finishedLiftTarget(
  finished: Workout[],
  name: string,
  now: number,
  bodyMetrics: StoreState['bodyMetrics'],
  opts: Omit<ProgOpts, 'now' | 'bodyKg'> = {},
): Target {
  const equipment = opts.equipment ?? equipmentFor({ name });
  return nextTarget(topHistory(finished, name, now), {
    ...opts,
    equipment,
    primary: opts.primary ?? muscleInfoByName(name)?.primary ?? null,
    loadType: opts.loadType ?? loadTypeFor({ name, equipment }),
    now,
    bodyKg: latestWeight(bodyMetrics)?.weight ?? null,
  });
}
