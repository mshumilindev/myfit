/**
 * Quiet hours (Q-17): no sound or push for the trainer chat between `from` and `to` on the device's clock; the
 * messages still count as unread. Default 22:00 to 07:00, on. There was no notification preference before, so this is
 * the first one; it lives in `localStorage` (this device), is copied into the push device doc (`quiet`, with the
 * existing `tz`) for the server, and into IndexedDB `spotter.prefs` for the service worker, which shows a chat push
 * silently while the window is on (iOS needs every push to show something, so the worker never drops one).
 */
import { useSyncExternalStore } from 'react';

export interface QuietHours {
  on: boolean;
  /** minutes after local midnight */
  from: number;
  to: number;
}
export const DEFAULT_QUIET: QuietHours = { on: true, from: 22 * 60, to: 7 * 60 };
/** The tag prefix of Coach chat pushes (the worker and the server agree on it). */
export const CHAT_PUSH_TAG = 'coach-chat';
const KEY = 'spotter.quietHours';

const clampMin = (n: unknown, d: number): number =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(1439, Math.max(0, Math.round(n))) : d;

export function parseQuiet(v: unknown): QuietHours {
  if (!v || typeof v !== 'object') return DEFAULT_QUIET;
  const o = v as Record<string, unknown>;
  return {
    on: typeof o.on === 'boolean' ? o.on : DEFAULT_QUIET.on,
    from: clampMin(o.from, DEFAULT_QUIET.from),
    to: clampMin(o.to, DEFAULT_QUIET.to),
  };
}

/** Is `date` (local time) inside the window? The window may wrap midnight; from === to means never. */
export function isQuietAt(q: QuietHours, date: Date): boolean {
  if (!q.on || q.from === q.to) return false;
  const m = date.getHours() * 60 + date.getMinutes();
  return q.from < q.to ? m >= q.from && m < q.to : m >= q.from || m < q.to;
}

export const fmtMinutes = (m: number): string =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

let cache: QuietHours | null = null;
const subs = new Set<() => void>();

export function loadQuiet(): QuietHours {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? parseQuiet(JSON.parse(raw)) : DEFAULT_QUIET;
  } catch {
    cache = DEFAULT_QUIET;
  }
  return cache;
}

function writePrefsIdb(q: QuietHours): void {
  if (typeof indexedDB === 'undefined') return;
  try {
    const r = indexedDB.open('spotter.prefs', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => {
      try {
        r.result.transaction('kv', 'readwrite').objectStore('kv').put(q, 'quiet');
      } catch {
        /* the worker then uses the default */
      }
    };
  } catch {
    /* no IndexedDB */
  }
}

export function saveQuiet(q: QuietHours): void {
  cache = parseQuiet(q);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* private mode: kept for this session */
  }
  writePrefsIdb(cache);
  subs.forEach((f) => f());
  void import('./push')
    .then((m) => m.syncQuietToServer(cache as QuietHours))
    .catch(() => undefined);
}

export function useQuietHours(): QuietHours {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => void subs.delete(f);
    },
    loadQuiet,
    () => DEFAULT_QUIET,
  );
}

/** Test seam. */
export function resetQuietForTests(): void {
  cache = null;
}
