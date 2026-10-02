/**
 * Log activity account prefs — synced across devices through the same
 * `users/{uid}/meta/prefs` doc as the week start (see store.ts):
 *
 *   • `activityPins` — activity type keys the user pinned, in their order
 *     (the Pinned row on the Log activity page).
 *   • `nextUpOff` — activity types the user asked Spotter not to suggest after
 *     a workout ("Next up" on the session summary).
 *
 * Each list is its own last-write-wins field with its own `updatedAt`, cached
 * in localStorage so the page works offline and before the first snapshot.
 * The pure `reconcileListPref` decides, per field, whether a snapshot should be
 * applied locally or the (newer) local value pushed back.
 */
import { useSyncExternalStore } from 'react';

export interface ListPref {
  list: string[];
  updatedAt: number;
}

export const EMPTY_LIST_PREF: ListPref = { list: [], updatedAt: 0 };

/** Dedupe + drop non-strings, keeping first occurrence order. */
export function cleanList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) if (typeof v === 'string' && v && !out.includes(v)) out.push(v);
  return out;
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Last-write-wins between the local value and a synced one (`remote` is null
 * when the doc or the field is missing). `apply` → adopt the remote value;
 * `push` → the local value is newer (e.g. edited offline) and should be written.
 */
export function reconcileListPref(
  local: ListPref,
  remote: ListPref | null,
): { apply: ListPref | null; push: boolean } {
  if (!remote) return { apply: null, push: local.updatedAt > 0 };
  if (remote.updatedAt > local.updatedAt) return { apply: remote, push: false };
  if (local.updatedAt > remote.updatedAt) return { apply: null, push: true };
  // Same stamp: identical writes, or a tie — the synced copy wins for stability.
  return { apply: sameList(local.list, remote.list) ? null : remote, push: false };
}

/** Read a synced field pair (`<name>` + `<name>UpdatedAt`) off the prefs doc. */
export function listPrefFromDoc(data: Record<string, unknown>, name: string): ListPref | null {
  if (!(name in data)) return null;
  const at = data[`${name}UpdatedAt`];
  return { list: cleanList(data[name]), updatedAt: typeof at === 'number' ? at : 0 };
}

/** Move `key` to `index` in the list (inserting it when absent). */
export function placeInList(list: string[], key: string, index: number): string[] {
  const rest = list.filter((k) => k !== key);
  const at = Math.max(0, Math.min(rest.length, Math.round(index)));
  return [...rest.slice(0, at), key, ...rest.slice(at)];
}

export interface ListPrefStore {
  get: () => string[];
  updatedAt: () => number;
  snapshot: () => ListPref;
  /** A user edit (stamped now) or a synced value (`at` given — ignored if older). */
  set: (list: string[], at?: number) => void;
  subscribe: (fn: () => void) => () => void;
  reset: () => void;
}

export function createListPref(storageKey: string): ListPrefStore {
  const load = (): ListPref => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const v = JSON.parse(raw) as Partial<ListPref>;
        return { list: cleanList(v.list), updatedAt: Number(v.updatedAt) || 0 };
      }
    } catch {
      /* private mode / corrupt value */
    }
    return EMPTY_LIST_PREF;
  };
  let current = load();
  const listeners = new Set<() => void>();
  const save = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(current));
    } catch {
      /* storage unavailable — in-memory value still applies */
    }
  };
  const emit = () => {
    for (const fn of listeners) fn();
  };
  return {
    get: () => current.list,
    updatedAt: () => current.updatedAt,
    snapshot: () => current,
    set(list, at) {
      const clean = cleanList(list);
      const updatedAt = at ?? Math.max(Date.now(), current.updatedAt + 1);
      if (at !== undefined && at < current.updatedAt) return;
      if (sameList(clean, current.list) && updatedAt === current.updatedAt) return;
      current = { list: clean, updatedAt };
      save();
      emit();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    reset() {
      current = EMPTY_LIST_PREF;
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
      emit();
    },
  };
}

// --- The two synced lists ------------------------------------------------------------

export const pinsPref = createListPref('spotter.activityPins');
export const nextUpOffPref = createListPref('spotter.nextUpOff');
/** "Add it to your program" suggestions turned off / snoozed (see programSuggest.ts). */
export const programSuggestOffPref = createListPref('spotter.programSuggestOff');

/** Pinned activity type keys, in display order. */
export function activityPins(): string[] {
  return pinsPref.get();
}
export function setActivityPins(list: string[]): void {
  pinsPref.set(list);
}
export function isPinned(key: string): boolean {
  return pinsPref.get().includes(key);
}
/** Pin (appended last) or unpin one type. Returns the new pinned state. */
export function togglePin(key: string): boolean {
  const list = pinsPref.get();
  if (list.includes(key)) {
    pinsPref.set(list.filter((k) => k !== key));
    return false;
  }
  pinsPref.set([...list, key]);
  return true;
}
/** Pin at a position / reorder an existing pin (drag & drop). */
export function placePin(key: string, index: number): void {
  pinsPref.set(placeInList(pinsPref.get(), key, index));
}
export function useActivityPins(): string[] {
  return useSyncExternalStore(pinsPref.subscribe, pinsPref.get, pinsPref.get);
}

/** Activity types the user doesn't want suggested after a workout. */
export function nextUpOff(): string[] {
  return nextUpOffPref.get();
}
export function setNextUpOff(list: string[]): void {
  nextUpOffPref.set(list);
}
/** Turn "don't suggest after workouts" on/off for one type. Returns the new off state. */
export function toggleNextUpOff(key: string): boolean {
  const list = nextUpOffPref.get();
  if (list.includes(key)) {
    nextUpOffPref.set(list.filter((k) => k !== key));
    return false;
  }
  nextUpOffPref.set([...list, key]);
  return true;
}
export function useNextUpOff(): string[] {
  return useSyncExternalStore(nextUpOffPref.subscribe, nextUpOffPref.get, nextUpOffPref.get);
}

export function programSuggestOff(): string[] {
  return programSuggestOffPref.get();
}
export function setProgramSuggestOff(list: string[]): void {
  programSuggestOffPref.set(list);
}
export function useProgramSuggestOff(): string[] {
  return useSyncExternalStore(
    programSuggestOffPref.subscribe,
    programSuggestOffPref.get,
    programSuggestOffPref.get,
  );
}
