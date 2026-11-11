/** Contract between the Electron shell and the web app (window.spotterNative). Keep it tiny and additive. */

export const CHANNEL = {
  version: 'spotter:version',
  notify: 'spotter:notify',
  badge: 'spotter:badge',
  openExternal: 'spotter:open-external',
  scheduleAlarms: 'spotter:schedule-alarms',
  cancelAlarms: 'spotter:cancel-alarms',
  alarmDue: 'spotter:alarm-due',
  setTray: 'spotter:set-tray',
  getPrefs: 'spotter:get-prefs',
  setPrefs: 'spotter:set-prefs',
  showAlarm: 'spotter:show-alarm',
} as const;

/** Bumped only when the bridge gains a *breaking* change; the web app feature-detects individual methods. */
export const BRIDGE_VERSION = 2;

export const DEFAULT_APP_URL = 'https://spotter-64c3b.web.app';
