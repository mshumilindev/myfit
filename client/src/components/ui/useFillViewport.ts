import { useLayoutEffect, useState } from 'react';

/**
 * Publishes the room an element has below its top edge as `--chs-avail` (px): from the element's top to the lowest
 * edge it may use, which is the viewport bottom OR the bottom of the nearest ancestor that clips (the host app can sit
 * in a frame shorter than the window, on desktop). A page that has to FILL the rest of the screen (the chat card)
 * reads it instead of guessing the height of the bars above it or trusting `100dvh`. Kept current on resize and when
 * the frame or the page changes size.
 */
export function useFillViewport(): (el: HTMLElement | null) => void {
  // A callback ref kept in state: the page can mount AFTER the host (a skeleton shows first on a refresh), so the
  // element must be picked up whenever it appears, not once.
  const [el, setEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!el) return;
    const apply = () => {
      let bottom = window.visualViewport?.height ?? window.innerHeight;
      const wide = window.matchMedia?.('(min-width: 720px)').matches ?? false;
      // Bottom padding of the wrappers between the element and the frame (a page gutter such as `.chs-page`): the
      // element must stop above it, or the gutter would push the card past the frame.
      let below = 0;
      for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
        // a frame is whatever clips (overflow) or is a positioned layer (the host's screen stage)
        const cs = getComputedStyle(p);
        const isFrame =
          cs.overflowY !== 'visible' || (cs.position !== 'static' && p !== document.body);
        if (!isFrame) {
          if (wide)
            below += (parseFloat(cs.paddingBottom) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
          continue;
        }
        if (cs.overflowY !== 'visible' || (cs.position !== 'static' && p !== document.body)) {
          // From 720 px the frame stops at the frame's content edge, so the page's own bottom padding stays
          // clear under it, like under every other desktop page. A phone keeps the chat edge to edge.
          const inset = wide
            ? (parseFloat(cs.paddingBottom) || 0) + (parseFloat(cs.borderBottomWidth) || 0)
            : 0;
          bottom = Math.min(bottom, p.getBoundingClientRect().bottom - inset - below);
          below = 0;
        }
      }
      const top = el.getBoundingClientRect().top;
      el.style.setProperty('--chs-avail', `${Math.max(0, Math.round(bottom - top))}px`);
    };
    apply();
    const raf = requestAnimationFrame(apply); // after the host's layout settles (bars above, fonts)
    window.addEventListener('resize', apply);
    window.addEventListener('hashchange', apply); // the bars above come and go with the route (a thread opens)
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(apply));
    window.visualViewport?.addEventListener('resize', apply);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply);
    ro?.observe(document.body);
    if (el.parentElement) ro?.observe(el.parentElement);
    // Everything above the element moves its top when it resizes (a bar whose avatar photo loads, a banner): watch it.
    for (let p: Element | null = el; p && p !== document.body; p = p.parentElement)
      for (let sib = p.previousElementSibling; sib; sib = sib.previousElementSibling)
        ro?.observe(sib);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(raf2);
      window.removeEventListener('hashchange', apply);
      window.removeEventListener('resize', apply);
      window.visualViewport?.removeEventListener('resize', apply);
      ro?.disconnect();
    };
  }, [el]);
  return setEl;
}
