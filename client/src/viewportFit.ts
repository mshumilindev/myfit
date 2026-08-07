/**
 * Make the app shell as tall as the window really is.
 *
 * An installed iOS app has no browser chrome, yet percentage and viewport
 * heights can still resolve against a viewport that reserves room for it —
 * which shows up as a dead band under the tab bar. Measuring the window and
 * writing the result into --app-h removes the guesswork.
 *
 * Only for standalone installs: in a browser tab the toolbars are real, and
 * stretching under them would hide the tab bar.
 */

import { isStandaloneDisplay } from './pwaInstall';

export interface ViewportSizes {
  innerHeight: number;
  visualHeight: number | null;
  clientHeight: number;
}

/** The tallest credible reading — a short one is what leaves the dead band. */
export function pickShellHeight(sizes: ViewportSizes): number {
  return Math.round(Math.max(sizes.innerHeight, sizes.visualHeight ?? 0, sizes.clientHeight));
}

export function measureViewport(): ViewportSizes {
  return {
    innerHeight: window.innerHeight,
    visualHeight: window.visualViewport?.height ?? null,
    clientHeight: document.documentElement.clientHeight,
  };
}

export function lockShellHeight(): void {
  if (!isStandaloneDisplay()) return;

  const apply = () => {
    const h = pickShellHeight(measureViewport());
    if (h > 0) document.documentElement.style.setProperty('--app-h', `${h}px`);
  };

  apply();
  // Rotation changes the real height; the on-screen keyboard must not, so we
  // deliberately ignore plain resize events.
  window.addEventListener('orientationchange', () => setTimeout(apply, 250));
  window.addEventListener('pageshow', apply);
}
