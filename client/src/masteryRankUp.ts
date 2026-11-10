import { computeMastery, rankIndexForRating, type MasteryResult } from './mastery';
import type { useStore } from './store';

/**
 * Rank-up moment (lazy chunk, Mastery only): returns the new result once per rating crossing, compared against the
 * last surfaced rating; records the surfaced rating through `setSeen`.
 */
export function checkRankUp(
  store: ReturnType<typeof useStore>,
  setSeen: (rating: number) => void,
): MasteryResult | null {
  const m = computeMastery(store, Date.now(), {
    trainingSinceYear: store.mastery.sinceYear,
    trainingPattern: store.mastery.pattern,
  });
  if (m.calibrating) return null;
  const seen = store.mastery.seenRating;
  if (seen == null) {
    setSeen(m.rating);
    return null;
  }
  const crossed = m.rankIndex > rankIndexForRating(seen);
  if (m.rating !== seen) setSeen(m.rating);
  return crossed ? m : null;
}
