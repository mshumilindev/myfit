/**
 * Which themes the user has already been shown (SPO-355). `themesSeen` is a list of theme ids kept on
 * `users/{uid}/meta/prefs` next to `theme` (same sensitivity, nothing new collected) and cached in
 * localStorage (`gym.themesSeen`) for the first paint and offline.
 *
 * A theme is NEW for a user when it is pickable by hand (holiday themes are not), is not in the list and
 * is not the one they already wear. The list is only ever merged (union), never shrunk, so two devices
 * converge: each snapshot unions the account's list with the local one and writes back when the local one
 * adds something. No account value yet = nothing seen = every pickable theme is new once.
 * Pure of Firebase: store.ts owns the listener and the write (like themeSync.ts).
 */
import { useSyncExternalStore } from 'react';
import { PICKABLE_THEMES, getCommittedTheme, onThemeCommitted, type ThemeDef } from './registry';

export const THEMES_SEEN_FIELD = 'themesSeen';
const KEY = 'gym.themesSeen';

type PrefsWriter = (fields: Record<string, unknown>) => void;

let seen: string[] = readCache();
/** True once the account's prefs doc (or its cache) has been read: before that we don't know what was seen. */
let ready = false;
const listeners = new Set<() => void>();
let snapshotCache: { seen: readonly string[]; ready: boolean } = { seen, ready };

function readCache(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(seen));
  } catch {
    /* storage unavailable — kept for this session */
  }
}

function emit(): void {
  snapshotCache = { seen, ready };
  listeners.forEach((fn) => fn());
}

const union = (a: readonly string[], b: readonly string[]): string[] => [...new Set([...a, ...b])];

/** Pure: the pickable themes the user has not been shown and is not wearing. */
export function unseenThemes(
  seenIds: readonly string[],
  current: string,
  list: readonly ThemeDef[] = PICKABLE_THEMES,
): ThemeDef[] {
  return list.filter((t) => t.pickable !== false && t.id !== current && !seenIds.includes(t.id));
}

export function getUnseenThemes(): ThemeDef[] {
  return unseenThemes(seen, getCommittedTheme());
}

export function isSeenReady(): boolean {
  return ready;
}

/** The user has been shown these themes (announcement answered, Themes opened, a theme applied). */
export function markThemesSeen(ids: readonly string[], write?: PrefsWriter): void {
  const next = union(seen, ids);
  if (next.length === seen.length) return;
  seen = next;
  persist();
  emit();
  (write ?? seenWriter)?.({ [THEMES_SEEN_FIELD]: seen });
}

/** Everything pickable counts as seen (announcement closed either way). */
export function markAllThemesSeen(): void {
  markThemesSeen(PICKABLE_THEMES.map((t) => t.id));
}

let seenWriter: PrefsWriter | null = null;

// A theme the person already wears needs no announcement: it counts as seen the moment it is the saved one.
let implicitWorn: string | null = null;
onThemeCommitted((id) => {
  const ids = [implicitWorn, id].filter(
    (x): x is string => x !== null && PICKABLE_THEMES.some((t) => t.id === x),
  );
  implicitWorn = null;
  if (ids.length) markThemesSeen(ids);
});
/** store.ts hands over the prefs writer once. */
export function bindSeenWriter(write: PrefsWriter): void {
  seenWriter = write;
}

/** Handle a prefs-doc snapshot: merge the account's list into the local one, push back what only we know. */
export function syncSeenFromDoc(data: Record<string, unknown>, write: PrefsWriter): void {
  const raw = data[THEMES_SEEN_FIELD];
  const remote = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  const merged = union(remote, seen);
  const changed = merged.length !== seen.length;
  seen = merged;
  if (changed) persist();
  // the theme worn right now counts as seen without a write; it is recorded when the person moves off it
  const worn = getCommittedTheme();
  implicitWorn = PICKABLE_THEMES.some((t) => t.id === worn) && !seen.includes(worn) ? worn : null;
  ready = true;
  emit();
  if (merged.length !== remote.length) write({ [THEMES_SEEN_FIELD]: merged });
}

export function useUnseenThemes(): ThemeDef[] {
  const snap = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => snapshotCache,
    () => snapshotCache,
  );
  // the list is derived (cheap, tiny); a snapshot change re-renders and the current theme is read live
  return snap.ready ? unseenThemes(snap.seen, getCommittedTheme()) : [];
}

/** Test hook. */
export function resetSeenForTest(): void {
  seen = [];
  implicitWorn = null;
  ready = false;
  seenWriter = null;
  emit();
}
