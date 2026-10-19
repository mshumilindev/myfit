/** Contract between the Electron shell and the web app (window.spotterNative). Keep it tiny and additive. */

export const CHANNEL = {
  version: 'spotter:version',
  notify: 'spotter:notify',
  badge: 'spotter:badge',
  openExternal: 'spotter:open-external',
} as const;

/** Bumped only when the bridge gains a *breaking* change; the web app feature-detects individual methods. */
export const BRIDGE_VERSION = 1;

export const DEFAULT_APP_URL = 'https://spotter-64c3b.web.app';
