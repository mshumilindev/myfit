import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * How many equal-width items fit in a row (pure; unit-tested). `total` items of `item` px with `gap` px between them
 * in `width` px. All fit -> `total` and no overflow chip. Otherwise the overflow chip takes the last slot of the same
 * row, so the clients shown are `slots - 1` (at least one). `width <= 0` = not measured: everything shows.
 */
export function fitItems(
  width: number,
  item: number,
  gap: number,
  total: number,
): { shown: number; overflow: number } {
  if (total <= 0 || width <= 0 || item <= 0) return { shown: total, overflow: 0 };
  const slots = Math.max(1, Math.floor((width + gap) / (item + gap)));
  if (total <= slots) return { shown: total, overflow: 0 };
  const shown = Math.max(1, slots - 1);
  return { shown, overflow: total - shown };
}

/**
 * Measures a row (ResizeObserver, no breakpoints) and returns how many of `total` items fit with a trailing "+N" chip
 * in the same row. Item width and gap are read from the DOM (widest child, computed column-gap), so a re-themed size
 * needs no constant here. Until measured (first paint, jsdom without sizes) all items show.
 */
export function useFitCount(
  ref: RefObject<HTMLElement | null>,
  total: number,
): { shown: number; overflow: number } {
  const [fit, setFit] = useState<{ shown: number; overflow: number }>({
    shown: total,
    overflow: 0,
  });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      let item = 0;
      for (const c of Array.from(el.children)) {
        const w =
          (c as HTMLElement).getBoundingClientRect().width || (c as HTMLElement).offsetWidth || 0;
        if (w > item) item = w;
      }
      const cs = getComputedStyle(el);
      const gap = parseFloat(cs.columnGap || cs.gap || '0') || 0;
      const next = fitItems(el.clientWidth, item, gap, total);
      setFit((p) => (p.shown === next.shown && p.overflow === next.overflow ? p : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, total]);
  return fit;
}
