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

/** What the person saved by hand (null: never touched, so the window may follow the Sleep add-on). */
let stored: QuietHours | null | undefined;
/** The window of the Sleep add-on (bedtime to wake time), set only while the add-on is installed and has a rhythm. */
let fallback: { from: number; to: number } | null = null;
let cache: QuietHours | null = null;
const subs = new Set<() => void>();

function readStored(): QuietHours | null {
  if (stored !== undefined) return stored;
  try {
    const raw = localStorage.getItem(KEY);
    stored = raw ? parseQuiet(JSON.parse(raw)) : null;
  } catch {
    stored = null;
  }
  return stored;
}

/** Saved by hand, else the Sleep add-on's bedtime to wake time (when it is installed), else 22:00 to 07:00. */
export function loadQuiet(): QuietHours {
  const s = readStored();
  const next = s ?? (fallback ? { ...DEFAULT_QUIET, ...fallback } : DEFAULT_QUIET);
  if (cache && cache.on === next.on && cache.from === next.from && cache.to === next.to)
    return cache;
  cache = next;
  return cache;
}

/** Has the person set the hours themselves? Then the Sleep add-on no longer moves them. */
export const quietIsManual = (): boolean => readStored() !== null;

/** The Sleep add-on's window, or null when it is not installed / has no rhythm. Ignored once the hours were set by hand. */
export function setQuietFallback(w: { from: number; to: number } | null): void {
  const same = fallback?.from === w?.from && fallback?.to === w?.to && !!fallback === !!w;
  if (same) return;
  fallback = w;
  if (readStored()) return;
  const q = loadQuiet();
  writePrefsIdb(q);
  subs.forEach((f) => f());
  void import('./push').then((m) => m.syncQuietToServer(q)).catch(() => undefined);
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
  const v = parseQuiet(q);
  stored = v;
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* private mode: kept for this session */
  }
  const out = loadQuiet();
  writePrefsIdb(out);
  subs.forEach((f) => f());
  void import('./push').then((m) => m.syncQuietToServer(out)).catch(() => undefined);
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
  stored = undefined;
  fallback = null;
}
