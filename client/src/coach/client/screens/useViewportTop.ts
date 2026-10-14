import { useLayoutEffect, useState } from 'react';

/**
 * Publishes the room an element has below its top edge as `--cc-avail` (px): from the element's top to the lowest
 * edge it may use, which is the viewport bottom OR the bottom of the nearest ancestor that clips (the host app can sit
 * in a frame shorter than the window, on desktop). A page that has to FILL the rest of the screen (the chat card)
 * reads it instead of guessing the height of the bars above it or trusting `100dvh`. Kept current on resize and when
 * the frame or the page changes size.
 */
export function useViewportTop(): (el: HTMLElement | null) => void {
  // A callback ref kept in state: the page can mount AFTER the host (a skeleton shows first on a refresh), so the
  // element must be picked up whenever it appears, not once.
  const [el, setEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!el) return;
    const apply = () => {
      let bottom = window.visualViewport?.height ?? window.innerHeight;
      for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
        const o = getComputedStyle(p).overflowY;
        if (o !== 'visible') bottom = Math.min(bottom, p.getBoundingClientRect().bottom);
      }
      const top = el.getBoundingClientRect().top;
      el.style.setProperty('--cc-avail', `${Math.max(0, Math.round(bottom - top))}px`);
    };
    apply();
    const raf = requestAnimationFrame(apply); // after the host's layout settles (bars above, fonts)
    window.addEventListener('resize', apply);
    window.visualViewport?.addEventListener('resize', apply);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply);
    ro?.observe(document.body);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', apply);
      window.visualViewport?.removeEventListener('resize', apply);
      ro?.disconnect();
    };
  }, [el]);
  return setEl;
}
