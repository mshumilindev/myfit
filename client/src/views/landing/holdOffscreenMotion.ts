/**
 * Ambient loops of the landing run only where they can be seen, and never while the page scrolls:
 * a screen that is off-screen — or any screen during a scroll — gets `.l-idle` (CSS animations paused, see landing.css)
 * and its SVG (SMIL) animations paused. Scroll frames then carry no animation work; the loops resume `SCROLL_IDLE_MS`
 * after the last scroll event.
 *
 * Only screens whose state actually changes are touched, so the style recalculation stays on the visible subtrees
 * (a class on the page root re-styled the whole landing: measured +1.2 s of UpdateLayoutTree per 40-wheel scroll).
 * Returns the cleanup function.
 */
export const SCROLL_IDLE_MS = 160;

export function holdOffscreenMotion(scroller: HTMLElement, sections: HTMLElement[]): () => void {
  if (typeof IntersectionObserver === 'undefined') return () => undefined;
  const offscreen = new Map<Element, boolean>(); // from the IntersectionObserver
  const applied = new Map<Element, boolean>(); // what the DOM shows now
  let scrolling = false;

  const apply = (s: Element) => {
    const idle = scrolling || offscreen.get(s) === true;
    if (applied.get(s) === idle) return;
    applied.set(s, idle);
    s.classList.toggle('l-idle', idle);
    s.querySelectorAll('svg').forEach((v) => {
      const sv = v as SVGSVGElement;
      if (idle) sv.pauseAnimations?.();
      else sv.unpauseAnimations?.();
    });
  };
  const setOffscreen = (s: Element, idle: boolean) => {
    offscreen.set(s, idle);
    apply(s);
  };

  sections.forEach((s) => setOffscreen(s, true));
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) =>
        setOffscreen(e.target, !(e.isIntersecting && e.intersectionRatio > 0)),
      ),
    { root: scroller, rootMargin: '0px', threshold: [0, 0.002, 0.01] },
  );
  sections.forEach((s) => io.observe(s));

  let timer = 0;
  const setScrolling = (on: boolean) => {
    scrolling = on;
    sections.forEach(apply);
  };
  const onScroll = () => {
    if (!scrolling) setScrolling(true);
    window.clearTimeout(timer);
    timer = window.setTimeout(() => setScrolling(false), SCROLL_IDLE_MS);
  };
  scroller.addEventListener('scroll', onScroll, { passive: true });

  return () => {
    io.disconnect();
    scroller.removeEventListener('scroll', onScroll);
    window.clearTimeout(timer);
  };
}
