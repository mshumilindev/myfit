import { useEffect, useRef } from 'react';

/**
 * The Back button / back swipe (Android, an installed PWA, the browser) closes the TOP drawer instead of leaving the
 * screen (SPO-466). Each open drawer pushes one history entry:
 *  - Back pops it and closes the newest drawer that is not already closing (one press = one drawer);
 *  - a drawer closed any other way (scrim, ×, swipe, Escape, the Start button) takes its own entry off again, and the
 *    popstate that causes is swallowed, so the page never moves.
 * ONE listener serves all drawers: with a listener per drawer, the swallowed popstate of a closing drawer would
 * be read by the drawer under it as a real Back press.
 */
interface Entry {
  marker: number;
  close: () => void;
  done: boolean;
}
const entries: Entry[] = [];
let swallow = 0;
let seq = 0;
let listening = false;
/** Deferred give-backs that have not run yet (see the cleanup below). */
const timers = new Set<ReturnType<typeof setTimeout>>();

function onPop(): void {
  if (swallow > 0) {
    swallow -= 1;
    return;
  }
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    if (entries[i].done) continue;
    entries[i].done = true;
    entries[i].close();
    return;
  }
}

export function useOverlayBack(close: () => void, enabled: boolean): void {
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    seq += 1;
    const entry: Entry = { marker: seq, close: () => closeRef.current(), done: false };
    // never removed: the popstate caused by a closing drawer's own history.back() arrives after it is gone
    if (!listening) {
      listening = true;
      window.addEventListener('popstate', onPop);
    }
    entries.push(entry);
    window.history.pushState({ ...(window.history.state ?? {}), spotterOverlay: entry.marker }, '');
    const href = window.location.href;
    return () => {
      const i = entries.indexOf(entry);
      if (i >= 0) entries.splice(i, 1);
      if (entry.done) return;
      // Closed by something other than Back: give its history entry back. NOT in the same tick: a drawer that closes
      // because the app is navigating (Start -> the session screen) would otherwise have its history.back() land after
      // the navigation and throw the person back to the previous screen. Next task: give it back only if the page is
      // still on this very entry; if the app has moved on, the entry stays (one harmless extra Back press).
      const timer = setTimeout(() => {
        timers.delete(timer);
        const st = window.history.state as { spotterOverlay?: number } | null;
        if (window.location.href === href && st?.spotterOverlay === entry.marker) {
          swallow += 1;
          window.history.back();
        }
      }, 0);
      timers.add(timer);
    };
  }, [enabled]);
}

/** Tests only: a drawer gave its history entry back and the popstate has not arrived yet. */
export function overlayBackPendingForTest(): boolean {
  return swallow > 0 || timers.size > 0;
}

/** Tests only: a popstate that a faked timer never delivered must not stay counted as "swallow". */
export function resetOverlayBackForTest(): void {
  swallow = 0;
  entries.length = 0;
  timers.forEach(clearTimeout);
  timers.clear();
}
