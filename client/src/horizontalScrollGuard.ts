/**
 * Keep the page from being left scrolled sideways.
 *
 * <html> is overflow:hidden and every screen scrolls inside its own container, so the document itself must never
 * have a horizontal offset. On iOS a back-swipe that the system takes over mid-gesture (touchcancel) can leave the
 * document panned to the left, which shows as a page whose left half is off-screen (SPO-146). Any horizontal
 * scroll of the document is undone right away; vertical position is left alone.
 */
export function installHorizontalScrollGuard(win: Window = window): () => void {
  const fix = () => {
    const el = win.document.scrollingElement;
    if (win.scrollX !== 0 || (el && el.scrollLeft !== 0)) win.scrollTo(0, win.scrollY);
    if (win.document.body.scrollLeft !== 0) win.document.body.scrollLeft = 0;
  };
  const events = ['scroll', 'touchend', 'touchcancel', 'pageshow', 'orientationchange'] as const;
  for (const name of events) win.addEventListener(name, fix, { passive: true });
  return () => {
    for (const name of events) win.removeEventListener(name, fix);
  };
}
