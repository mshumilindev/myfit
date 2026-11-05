import { useCallback, useLayoutEffect, useState, useSyncExternalStore } from 'react';

/**
 * The stack of open overlays (drawers and dialogs), oldest first (SPO-466). Every Sheet / Dialog registers while it is
 * mounted, so each one knows its place:
 *  - `level` (1 = the lowest) lifts a drawer opened over another one above it (see `.scrim[data-level]` in Overlays.css);
 *  - only the TOP overlay draws a scrim and only the top one closes on Escape: one overlay on the page at a time, and
 *    the drawer(s) under it are dimmed by that same scrim instead of adding their own.
 * Registration is a layout effect, so the level is right before the first paint.
 */
const stack: symbol[] = [];
let version = 0;
const subs = new Set<() => void>();
function bump(): void {
  version += 1;
  subs.forEach((f) => f());
}
function subscribe(f: () => void): () => void {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

export interface OverlaySlot {
  /** 1-based place in the stack; 0 before the overlay has registered. */
  level: number;
  /** The newest open overlay: the one that owns the scrim and Escape. */
  top: boolean;
  /** Same as `top`, readable from an event handler (always current). */
  isTop: () => boolean;
}

export function useOverlay(): OverlaySlot {
  const [key] = useState(() => Symbol('overlay'));
  useLayoutEffect(() => {
    stack.push(key);
    bump();
    return () => {
      const i = stack.indexOf(key);
      if (i >= 0) stack.splice(i, 1);
      bump();
    };
  }, [key]);
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
  const isTop = useCallback(() => stack.length > 0 && stack[stack.length - 1] === key, [key]);
  const i = stack.indexOf(key);
  return { level: i + 1, top: i >= 0 && i === stack.length - 1, isTop };
}

/** How many overlays are open now (tests, and the Start button that must step back when anything opens over it). */
export function openOverlayCount(): number {
  return stack.length;
}
