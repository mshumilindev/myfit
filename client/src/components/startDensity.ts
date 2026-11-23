import { useLayoutEffect } from 'react';

/** 0 = the full look; every next level removes one more layer of air/detail (CSS: `.start-sheet[data-fit]`). */
export const MAX_DENSITY = 4;

/** The drawer scrolls: its content is taller than the room it was given. */
export function overflowsVertically(el: HTMLElement): boolean {
  return el.scrollHeight - el.clientHeight > 1;
}

/**
 * Settles the lowest density at which the content fits: starts from the full look and tightens one level at a time
 * only while it still overflows. Sets `data-fit` on `el` (read by CSS only) and returns the level.
 */
export function fitDensity(
  el: HTMLElement,
  measure: (el: HTMLElement) => boolean = overflowsVertically,
): number {
  let level = 0;
  el.dataset.fit = '0';
  while (level < MAX_DENSITY && measure(el)) {
    level += 1;
    el.dataset.fit = String(level);
  }
  return level;
}

/**
 * Start Drawer density (SPO-561): the drawer keeps the full look whenever everything fits, and tightens step by step
 * only when it does not (few tiles on a tall phone: nothing changes; many add-on tiles on a short one: levels 1…4).
 * No breakpoints: the content is measured, so the tile count, locale, notices and font size are all accounted for.
 * Re-measured from the full look when the window, the visual viewport, the drawer height or the content changes.
 * `anchor` is any element inside the drawer (held in state, so a drawer that remounts is picked up again); the
 * drawer is its closest `.sheet`. Off (`enabled=false`) leaves the markup untouched (the desktop side panel).
 */
export function useDensityFit(anchor: HTMLElement | null, enabled: boolean): void {
  useLayoutEffect(() => {
    const sheet = enabled ? anchor?.closest<HTMLElement>('.sheet') : null;
    if (!sheet) return;
    let lastHeight = -1;
    let raf = 0;
    const run = () => {
      raf = 0;
      fitDensity(sheet);
      lastHeight = sheet.clientHeight;
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(run);
    };
    run();
    // The drawer's own height changes when the level changes: only a height we did not settle on re-measures.
    const ro =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            if (sheet.clientHeight !== lastHeight) schedule();
          });
    ro?.observe(sheet);
    const mo = new MutationObserver(schedule);
    mo.observe(sheet, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    void document.fonts?.ready.then(schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      delete sheet.dataset.fit;
    };
  }, [anchor, enabled]);
}
