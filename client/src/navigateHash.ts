import { setHash } from './route';
/**
 * Hash navigation that leaves no browser-history entry on an iOS home-screen app (SPO-146).
 *
 * iOS WebKit draws its own left-edge "back" animation (a snapshot of the previous page) whenever the history has an
 * earlier entry, and `touchstart.preventDefault()` does not stop it. On top of our own edge swipe that shows the page
 * twice. The home-screen app has no browser back button, so there we replace the entry instead of pushing a new one:
 * with nothing to go back to the system gesture never starts, and our swipe is the only back.
 */
export function isIosStandalone(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const ios =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!ios) return false;
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true
  );
}

export function navigateHash(hash: string): void {
  // setHash pushes a history entry; the iOS home-screen app replaces it instead (see above).
  setHash(hash, isIosStandalone());
}
