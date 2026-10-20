/**
 * Ambient loops of the landing run only where they can be seen: a screen that is off-screen gets `.l-idle`
 * (every CSS animation paused, see landing.css) and its SVG (SMIL) animations paused; the visible ones always run —
 * nothing stops while the page scrolls (pausing on scroll looked bad).
 *
 * Only screens whose state actually changes are touched. Returns the cleanup function.
 */
export function holdOffscreenMotion(scroller: HTMLElement, sections: HTMLElement[]): () => void {
  if (typeof IntersectionObserver === 'undefined') return () => undefined;
  const applied = new Map<Element, boolean>(); // is the screen idle now

  const setIdle = (s: Element, idle: boolean) => {
    if (applied.get(s) === idle) return;
    applied.set(s, idle);
    s.classList.toggle('l-idle', idle);
    s.querySelectorAll('svg').forEach((v) => {
      const sv = v as SVGSVGElement;
      if (idle) sv.pauseAnimations?.();
      else sv.unpauseAnimations?.();
    });
  };

  sections.forEach((s) => setIdle(s, true));
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => setIdle(e.target, !(e.isIntersecting && e.intersectionRatio > 0))),
    { root: scroller, rootMargin: '0px', threshold: [0, 0.002, 0.01] },
  );
  sections.forEach((s) => io.observe(s));
  return () => io.disconnect();
}
