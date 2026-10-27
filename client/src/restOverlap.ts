import { cutOut, mergeRanges, overlappingPeriods, type DayRange } from './health';
import type { RestMode, RestPeriod } from './types';

export type RestOverlapChoice = 'merge' | 'replace';

export type ResolvedOverlap = {
  list: RestPeriod[];
  range: DayRange;
  changed: RestPeriod[];
  removed: string[];
};

/** Apply the overlap choice to the other periods; returns the final range and
 *  the list without the merged-away / replaced periods. */
export function resolveRestOverlap(
  list: RestPeriod[],
  range: DayRange,
  mode: RestMode,
  selfId: string | null,
  choice: RestOverlapChoice | undefined,
  today: number,
): ResolvedOverlap | 'overlap' | 'merge-mode' {
  const others = overlappingPeriods(range, list, selfId, { mode, today });
  if (others.length === 0) return { list, range, changed: [], removed: [] };
  if (!choice) return 'overlap';
  if (choice === 'merge') {
    if (others.some((o) => o.mode !== mode)) return 'merge-mode';
    const ids = new Set(others.map((o) => o.id));
    return {
      list: list.filter((p) => !ids.has(p.id)),
      range: mergeRanges(range, others),
      changed: [],
      removed: [...ids],
    };
  }
  const changed: RestPeriod[] = [];
  const removed: string[] = [];
  let next = list;
  for (const o of others) {
    const pieces = cutOut(o, range);
    next = next.filter((p) => p.id !== o.id);
    if (pieces.length === 0) {
      removed.push(o.id);
      continue;
    }
    pieces.forEach((pc, i) => {
      const piece: RestPeriod = {
        ...o,
        id: i === 0 ? o.id : crypto.randomUUID(),
        startDay: pc.startDay,
        endDay: pc.endDay,
        open: pc.open === true,
      };
      changed.push(piece);
      next = [piece, ...next];
    });
  }
  return { list: next, range, changed, removed };
}
