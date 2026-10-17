/**
 * The progression target shown under a picker suggestion ("Try 80 × 8"). Takes the
 * moment the suggestion is for as the clock, so a lift not trained for weeks shows
 * the lighter return target of SPO-149 rather than "last weight + a step".
 */
import { nextTarget, topHistory, type Target } from './progression';
import type { EquipmentId } from './data/equipment';
import type { MuscleGroup } from './data/exercises';
import type { Workout } from './types';

export function pickTarget(
  item: {
    name: string;
    timesDone: number;
    equipment: EquipmentId | null;
    primary: MuscleGroup | null;
    last: { weight: number | null } | null;
  },
  finished: Workout[],
  beforeTs: number,
): Target | null {
  if (item.timesDone === 0) return null;
  const hist = topHistory(finished, item.name, beforeTs);
  if (hist.length === 0) return null;
  return nextTarget(hist, {
    equipment: item.equipment ? [item.equipment] : [],
    primary: item.primary,
    bodyweight: item.last?.weight === null,
    now: beforeTs,
  });
}
