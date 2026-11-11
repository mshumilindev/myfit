/** What the shell remembers about itself (SPO-552 I8). Pure parsing and merging; the file read/write stays in main.ts. */
export interface ShellPrefs {
  /** The tray icon (Windows) / menu bar icon (macOS). While it shows, closing the window keeps the app running. */
  trayIcon: boolean;
  /** Start with the computer. Off until the person turns it on. */
  openAtLogin: boolean;
  /** The one-time "add Spotter to your login items" message was shown (never repeats on its own). */
  autostartHintShown: boolean;
}

export const DEFAULT_PREFS: ShellPrefs = {
  trayIcon: true,
  openAtLogin: false,
  autostartHintShown: false,
};

export function parsePrefs(raw: unknown): ShellPrefs {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const bool = (k: keyof ShellPrefs): boolean =>
    typeof o[k] === 'boolean' ? (o[k] as boolean) : DEFAULT_PREFS[k];
  return {
    trayIcon: bool('trayIcon'),
    openAtLogin: bool('openAtLogin'),
    autostartHintShown: bool('autostartHintShown'),
  };
}

/** Applies a patch from the page: unknown keys and wrong types are ignored. */
export function patchPrefs(cur: ShellPrefs, patch: unknown): ShellPrefs {
  const p = patch && typeof patch === 'object' ? (patch as Record<string, unknown>) : {};
  const next = { ...cur };
  for (const k of Object.keys(DEFAULT_PREFS) as (keyof ShellPrefs)[]) {
    if (typeof p[k] === 'boolean') next[k] = p[k] as boolean;
  }
  return next;
}
