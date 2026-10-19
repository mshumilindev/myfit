import { contextBridge, ipcRenderer } from 'electron';
import { BRIDGE_VERSION, CHANNEL } from './shared';

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
