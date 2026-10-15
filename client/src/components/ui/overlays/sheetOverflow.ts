import { useEffect, type RefObject } from 'react';

/**
 * Kit rule: a drawer never scrolls sideways. The layout (Overlays.css: min-width 0 on containers, wrapping long words,
 * media capped at 100%) keeps content inside; this guard is the net under it. It does NOT clip anything (no
 * `overflow-x: hidden`, which would only hide the bug). It reports it: `data-hscroll` on the sheet (read by e2e) and,
 * in dev, a console warning naming the elements that stick out.
 */

/** Descendants of `root` whose box ends right of the sheet's content box (what makes the sheet scroll sideways). */
export function findHorizontalOverflow(root: HTMLElement, tolerance = 1): HTMLElement[] {
  if (root.scrollWidth <= root.clientWidth + tolerance) return [];
  const edge = root.getBoundingClientRect().right;
  const out: HTMLElement[] = [];
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
    // Own scroll containers (chip rows, tabs) are the sanctioned way to scroll sideways; do not descend into them.
    if (el.closest('[data-hscroll-ok]') && !el.hasAttribute('data-hscroll-ok')) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > edge + tolerance) out.push(el);
  }
  return out;
}

export function useSheetOverflowGuard(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const check = () => {
      raf = 0;
      const bad = findHorizontalOverflow(el);
      if (bad.length) {
        el.setAttribute('data-hscroll', 'true');
        if (import.meta.env.DEV) {
          console.warn(
            '[Sheet] horizontal overflow: fix the layout of these elements (do not hide the overflow)',
            bad.slice(0, 5),
          );
        }
      } else {
        el.removeAttribute('data-hscroll');
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    schedule();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    ro?.observe(el);
    const mo = new MutationObserver(schedule);
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      mo.disconnect();
    };
  }, [ref]);
}
