/**
 * Card limits for Today (R-BE-DEC-8). No readiness score, no ranking between people, no gamification.
 *  roster < 8: no queue (Week view with briefs); 8-20: up to 5 cards a day;
 *  > 20: ~25% of the roster, max 10; the rest goes to "N more in the digest".
 * Order: needs a decision (urgent) first; the same client never twice (merged with a count).
 */
import {
  QUEUE_LARGE_MAX_CARDS,
  QUEUE_LARGE_SHARE,
  QUEUE_MIN_ROSTER,
  QUEUE_SMALL_MAX_CARDS,
  QUEUE_SMALL_MAX_ROSTER,
} from './signalConfig';
import { rankSignals } from './signals';
import type { Signal } from './types';

export interface Card {
  clientId: string;
  primary: Signal;
  /** all signals of this client merged into the card (primary first) */
  signals: Signal[];
  count: number;
  /** needs a decision (urgent) vs keep an eye on */
  bucket: 'decide' | 'watch';
}
export interface Picked {
  mode: 'queue' | 'week-briefs';
  cards: Card[];
  /** signals (not cards) that did not fit; shown as "N more in the digest" */
  digest: number;
}

export function cardLimit(rosterSize: number): number {
  if (rosterSize < QUEUE_MIN_ROSTER) return 0;
  if (rosterSize <= QUEUE_SMALL_MAX_ROSTER) return QUEUE_SMALL_MAX_CARDS;
  return Math.min(QUEUE_LARGE_MAX_CARDS, Math.ceil(rosterSize * QUEUE_LARGE_SHARE));
}

export function pickCards(signals: readonly Signal[], rosterSize: number): Picked {
  const ranked = rankSignals(signals);
  const limit = cardLimit(rosterSize);
  if (limit === 0) return { mode: 'week-briefs', cards: [], digest: ranked.length };
  const byClient = new Map<string, Signal[]>();
  for (const s of ranked) byClient.set(s.clientId, [...(byClient.get(s.clientId) ?? []), s]);
  const all: Card[] = [...byClient.entries()].map(([clientId, ss]) => ({
    clientId,
    primary: ss[0],
    signals: ss,
    count: ss.length,
    bucket: ss[0].severity === 'urgent' ? 'decide' : 'watch',
  }));
  // already ordered by the best signal of each client because `ranked` was
  const cards = all.slice(0, limit);
  const shown = cards.reduce((a, c) => a + c.count, 0);
  return { mode: 'queue', cards, digest: ranked.length - shown };
}
