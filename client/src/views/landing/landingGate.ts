import { isNativeShell } from '../../pwaInstall';

/** An installed PWA only. A browser tab in fullscreen or minimal-ui mode (F11, macOS full screen) is still a browser. */
function isInstalledApp(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/**
 * The landing page is for people who open the site in a normal browser tab. The installed PWA and the desktop shell
 * go straight to the sign-in form (SPO-169).
 */
export function shouldShowLanding(): boolean {
  return !isInstalledApp() && !isNativeShell();
}
