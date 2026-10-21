import type { MuscleGroup } from './data/exercises';

/** `back` plus the finer groups the catalog emits instead of it. */
const BACK_FAMILY: MuscleGroup[] = ['back', 'lats', 'traps', 'lower_back'];

/**
 * Weekly sets per muscle over `weeks` with the major group `back` = back + lats + traps + lower_back. The catalog splits
 * the back (a legacy or custom log still says `back`), so without this the major group `back` is never trained and is
 * always "skipped" (SPO-152).
 */
export function foldedWeekly(
  sets: Map<MuscleGroup, number>,
  weeks: number,
): (m: MuscleGroup) => number {
  const back = BACK_FAMILY.reduce((n, m) => n + (sets.get(m) ?? 0), 0);
  return (m) => (m === 'back' ? back : (sets.get(m) ?? 0)) / weeks;
}
