import { contextBridge, ipcRenderer } from 'electron';

// NOT imported from ./shared: a sandboxed preload can only require 'electron' (a relative require fails with
// "module not found" and the bridge silently never appears). tests/desktop-preload.guard.test.ts keeps these equal to
// shared.ts.
const BRIDGE_VERSION = 1;
const CHANNEL = {
  version: 'spotter:version',
  notify: 'spotter:notify',
  badge: 'spotter:badge',
  openExternal: 'spotter:open-external',
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
});
