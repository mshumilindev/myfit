/**
 * Notification switches of the coaching pushes (SPO-237, boards C6 / U1-U3): Requests, Reminders, Team. They live on
 * this device (`localStorage`) and are copied into the device's push doc (`prefs`, next to `quiet`) for the server.
 * A switched-off kind sends no push; its entry in Spotter stays. Chat has no switch here: its setting is quiet hours.
 * Default: everything on.
 */
import { useSyncExternalStore } from 'react';

export interface PushPrefs {
  requests: boolean;
  reminders: boolean;
  team: boolean;
}
export const DEFAULT_PREFS: PushPrefs = { requests: true, reminders: true, team: true };
const KEY = 'spotter.pushPrefs';

/** Untrusted stored value to a safe shape: only a literal `false` switches a kind off. */
export function parsePrefs(v: unknown): PushPrefs {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  return {
    requests: o.requests !== false,
    reminders: o.reminders !== false,
    team: o.team !== false,
  };
}

let cache: PushPrefs | null = null;
const subs = new Set<() => void>();

export function loadPrefs(): PushPrefs {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? parsePrefs(JSON.parse(raw)) : DEFAULT_PREFS;
  } catch {
    cache = DEFAULT_PREFS;
  }
  return cache;
}

export function savePrefs(p: PushPrefs): void {
  cache = parsePrefs(p);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* private mode: kept for this session */
  }
  subs.forEach((f) => f());
  void import('./push').then((m) => m.syncPrefsToServer(cache as PushPrefs)).catch(() => undefined);
}

export function usePushPrefs(): PushPrefs {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => void subs.delete(f);
    },
    loadPrefs,
    () => DEFAULT_PREFS,
  );
}

/** Test seam. */
export function resetPrefsForTests(): void {
  cache = null;
}
