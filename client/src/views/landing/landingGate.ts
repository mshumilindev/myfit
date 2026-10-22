import { isNativeShell } from '../../pwaInstall';

/** An installed PWA only. A browser tab in fullscreen or minimal-ui mode (F11, macOS full screen) is still a browser. */
function isInstalledApp(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/** The installed app: an installed PWA or the desktop shell. It has no use for download buttons or "create a shortcut". */
export function isAppShell(): boolean {
  return isInstalledApp() || isNativeShell();
}

/**
 * The landing page is the signed-out front door everywhere: a browser tab, the installed PWA and the desktop shell
 * (inside the app it just leaves out what only makes sense in a browser, see `isAppShell`).
 */
export function shouldShowLanding(): boolean {
  return true;
}
