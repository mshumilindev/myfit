import { contextBridge, ipcRenderer } from 'electron';

// NOT imported from ./shared: a sandboxed preload can only require 'electron' (a relative require fails with
// "module not found" and the bridge silently never appears). tests/desktop-preload.guard.test.ts keeps these equal to
// shared.ts.
const BRIDGE_VERSION = 2;
const CHANNEL = {
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

/**
 * The only surface the web app gets from the shell. No product logic lives here: the web app must feature-detect
 * `window.spotterNative` (and each method) and keep working in a plain browser / PWA without it.
 */
contextBridge.exposeInMainWorld('spotterNative', {
  bridgeVersion: BRIDGE_VERSION,
  platform: process.platform,
  getAppVersion: (): Promise<string> => ipcRenderer.invoke(CHANNEL.version),
  notify: (title: string, body?: string): Promise<void> =>
    ipcRenderer.invoke(CHANNEL.notify, { title, body }),
  setBadge: (count: number): Promise<void> => ipcRenderer.invoke(CHANNEL.badge, count),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke(CHANNEL.openExternal, url),
  // v2 (SPO-552): Planner reminders. Only ids, moments and modes go to the main process; text stays in the page.
  scheduleAlarms: (list: { id: string; at: number; mode: 'quiet' | 'ring' }[]): Promise<void> =>
    ipcRenderer.invoke(CHANNEL.scheduleAlarms, list),
  cancelAlarms: (ids: string[]): Promise<void> => ipcRenderer.invoke(CHANNEL.cancelAlarms, ids),
  onAlarmDue: (
    cb: (alarm: { id: string; at: number; mode: 'quiet' | 'ring' }) => void,
  ): (() => void) => {
    const h = (_e: unknown, alarm: { id: string; at: number; mode: 'quiet' | 'ring' }) => cb(alarm);
    ipcRenderer.on(CHANNEL.alarmDue, h);
    return () => ipcRenderer.removeListener(CHANNEL.alarmDue, h);
  },
  showAlarm: (p: {
    id: string;
    title: string;
    body?: string;
    mode: 'quiet' | 'ring';
  }): Promise<void> => ipcRenderer.invoke(CHANNEL.showAlarm, p),
  setTray: (state: { next: { label: string } | null }): Promise<void> =>
    ipcRenderer.invoke(CHANNEL.setTray, state),
  getPrefs: (): Promise<{ trayIcon: boolean; openAtLogin: boolean; autostartHintShown: boolean }> =>
    ipcRenderer.invoke(CHANNEL.getPrefs),
  setPrefs: (
    patch: Partial<{ trayIcon: boolean; openAtLogin: boolean; autostartHintShown: boolean }>,
  ): Promise<{ trayIcon: boolean; openAtLogin: boolean; autostartHintShown: boolean }> =>
    ipcRenderer.invoke(CHANNEL.setPrefs, patch),
});
