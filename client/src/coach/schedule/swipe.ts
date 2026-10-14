import { useRef, type TouchEvent } from 'react';

/** Minimum horizontal travel (px) of a swipe, and how much more horizontal than vertical it must be. */
export const SWIPE_MIN = 64;
export const SWIPE_RATIO = 2;

/** -1 = swiped right (go back), 1 = swiped left (go forward), 0 = not a swipe (too short, or mostly vertical). */
export function swipeDir(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return 0;
  return dx < 0 ? 1 : -1;
}

/**
 * Touch swipe for paging a calendar: spread the returned handlers on the view. Touch only (a mouse has the buttons), and a
 * swipe that starts inside a control that scrolls sideways by itself is left alone.
 */
export function useSwipe(onStep: (dir: -1 | 1) => void) {
  const from = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: TouchEvent<HTMLElement>) => {
      const t = e.touches[0];
      from.current = e.touches.length === 1 && t ? { x: t.clientX, y: t.clientY } : null;
    },
    onTouchEnd: (e: TouchEvent<HTMLElement>) => {
      const a = from.current;
      from.current = null;
      const t = e.changedTouches[0];
      if (!a || !t) return;
      const dir = swipeDir(t.clientX - a.x, t.clientY - a.y);
      if (dir) onStep(dir);
    },
    onTouchCancel: () => {
      from.current = null;
    },
  };
}
