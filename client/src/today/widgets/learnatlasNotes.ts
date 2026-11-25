import { type AtlasNote } from '../../atlas/notes';
import { type CoachFact } from '../../atlas/types';

/** Most useful first — what the "insight" widget surfaces. */
export const INSIGHT_RANK: Partial<Record<CoachFact['kind'], number>> = {
  imbalance: 0,
  stall: 1,
  restShort: 2,
  setDrop: 3,
  shortSleep: 4,
  comeback: 5,
  pr: 6,
  bodyweight: 7,
  skipped: 8,
  week: 9,
  streak: 10,
};

/** The one note worth leading with (Atlas insight widget, Today's note of the
 *  day): the most important kind, the latest of those. Plain session recaps
 *  and the intro never lead. */
export function topNote(notes: AtlasNote[]): AtlasNote | null {
  let best: AtlasNote | null = null;
  for (const n of notes) {
    const r = INSIGHT_RANK[n.kind];
    if (r === undefined) continue;
    const br = best ? (INSIGHT_RANK[best.kind] ?? 99) : 99;
    if (!best || r < br || (r === br && n.at > best.at)) best = n;
  }
  return best;
}
