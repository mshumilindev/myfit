import { useEffect } from 'react';

/** How long the record card stays up before it folds into the rest timer (SPO-12). */
export const PR_CARD_MS = 15000;

/** Is the record card still due at `now`? A card without a timestamp or past its time is gone for good. */
export const prCardDue = (m: { at: number } | null, now: number, ttl = PR_CARD_MS): boolean =>
  !!m && now - m.at < ttl;

/**
 * The record card is cleared by its own timer, not only hidden by the ticking clock: the moment is dropped from state,
 * so it can never come back (a throttled tick in a background tab, a re-render). A newer record replaces the moment
 * and restarts the timer; opening the screen with a stale moment clears it at once.
 */
export function usePrMomentExpiry(
  m: { at: number } | null,
  clear: () => void,
  now: () => number = Date.now,
  ttl = PR_CARD_MS,
): void {
  useEffect(() => {
    if (!m) return;
    const left = Math.max(0, m.at + ttl - now());
    const id = setTimeout(clear, left);
    return () => clearTimeout(id);
  }, [m, clear, now, ttl]);
}
