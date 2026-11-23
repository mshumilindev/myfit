import { useLayoutEffect } from 'react';

/** Stages 0…MAX_STAGE; inside a stage the squeeze runs continuously 0…1 (`--ss-k`). CSS: `.start-sheet[data-fit]`. */
export const MAX_STAGE = 3;
const STEPS = 6;

export interface Fit {
  stage: number;
  k: number;
}

/** The drawer scrolls: its content is taller than the room it was given. */
export function overflowsVertically(el: HTMLElement): boolean {
  return el.scrollHeight - el.clientHeight > 0;
}

/**
 * Does the content overflow the biggest room the drawer can have (its full-height state)? Measured with the full
 * class lifted on, so a drawer that is compact right now is not judged by its own small height.
 */
export function overflowsFullRoom(el: HTMLElement): boolean {
  const had = el.classList.contains('sheet-full');
  el.classList.add('sheet-full');
  const over = overflowsVertically(el);
  if (!had) el.classList.remove('sheet-full');
  return over;
}

function apply(el: HTMLElement, f: Fit): void {
  el.dataset.fit = String(f.stage);
  el.style.setProperty('--ss-k', f.k.toFixed(3));
}

/**
 * Settles the gentlest squeeze that fits: the full look first; then stage by stage (tile spacing → no captions →
 * row tiles → compact hero, so the main tile is touched last), and inside the stage that needs it the smallest k
 * found by bisection. Writes `data-fit` / `--ss-k` on `el` (read by CSS only).
 */
export function fitDensity(
  el: HTMLElement,
  overflows: (el: HTMLElement) => boolean = overflowsFullRoom,
): Fit {
  const cur: Fit = { stage: 0, k: 0 };
  apply(el, cur);
  if (!overflows(el)) return cur;
  for (let stage = 0; stage <= MAX_STAGE; stage += 1) {
    apply(el, { stage, k: 1 });
    if (overflows(el)) continue;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < STEPS; i += 1) {
      const mid = (lo + hi) / 2;
      apply(el, { stage, k: mid });
      if (overflows(el)) lo = mid;
      else hi = mid;
    }
    const fit = { stage, k: hi };
    apply(el, fit);
    return fit;
  }
  const last = { stage: MAX_STAGE, k: 1 };
  apply(el, last);
  return last;
}

/**
 * Start Drawer density (SPO-561): the drawer keeps the full look whenever everything fits and squeezes smoothly,
 * only as much as needed, when it does not (the main tile last). No breakpoints: the content is measured, so the
 * tile count, locale, notices and font size are all accounted for. Re-measured when the window, the visual viewport
 * or the content changes. `anchor` is any element inside the drawer (held in state, so a remounted drawer is picked
 * up); the drawer is its closest `.sheet`. `onSettle` fires when the squeeze changed, so the owner can re-render the
 * kit sheet and let it return to the compact height. `enabled=false` leaves the markup untouched (desktop panel).
 */
export function useDensityFit(
  anchor: HTMLElement | null,
  enabled: boolean,
  onSettle?: () => void,
): void {
  useLayoutEffect(() => {
    const sheet = enabled ? anchor?.closest<HTMLElement>('.sheet') : null;
    if (!sheet) return;
    let lastHeight = -1;
    let lastScroll = -1;
    let lastEnd = -1;
    let raf = 0;
    let ro: ResizeObserver | null = null;
    // Observing an element twice is a no-op, so blocks added later are picked up on the next run.
    const watch = () => {
      ro?.observe(sheet);
      for (const child of Array.from(sheet.children)) ro?.observe(child);
    };
    // Where the content ends. scrollHeight never drops below clientHeight, so content that got shorter inside a
    // drawer that did not scroll is only seen here.
    const contentEnd = () => {
      const last = sheet.lastElementChild;
      return last
        ? Math.round(last.getBoundingClientRect().bottom - sheet.getBoundingClientRect().top)
        : 0;
    };
    const run = () => {
      raf = 0;
      fitDensity(sheet);
      lastHeight = sheet.clientHeight;
      lastScroll = sheet.scrollHeight;
      lastEnd = contentEnd();
      watch();
      // every pass: the kit sheet decides full / compact when it renders, and may have measured a stale content
      onSettle?.();
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(run);
    };
    // The drawer's own height changes with the squeeze: only a size we did not settle on re-measures. The content is
    // watched too: a capped drawer keeps its height while its content grows (a font swap, a wrapped label).
    if (typeof ResizeObserver !== 'undefined')
      ro = new ResizeObserver(() => {
        if (
          sheet.clientHeight !== lastHeight ||
          sheet.scrollHeight !== lastScroll ||
          contentEnd() !== lastEnd
        )
          schedule();
      });
    run();
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
      sheet.style.removeProperty('--ss-k');
    };
    // onSettle is read through the closure of the first run on purpose: it only bumps a counter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, enabled]);
}
