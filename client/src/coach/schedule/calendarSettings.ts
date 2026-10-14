/**
 * The trainer's calendar settings (working hours, the gyms they work at, the visible range) as one small store.
 * The data goes through a port: sealed on the trainer's own vault key in the real backend
 * (`data/firestore/calendarSettingsPort.ts`, collection `calendarSettings`), in memory in fixtures, stories and tests.
 * The store never throws: a failing load keeps the defaults, a failing save rolls back and reports `false`.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { defaultSettings, sanitizeSettings, type CalendarSettings } from './hours';

export interface CalendarSettingsPort {
  /** the stored settings, or null when the trainer never saved any */
  load(): Promise<CalendarSettings | null>;
  save(s: CalendarSettings): Promise<void>;
}

export function createMemoryCalendarSettingsPort(
  initial: CalendarSettings | null = null,
): CalendarSettingsPort {
  let cur = initial;
  return {
    load: () => Promise.resolve(cur),
    save: (s) => {
      cur = s;
      return Promise.resolve();
    },
  };
}

export interface CalendarSettingsState {
  settings: CalendarSettings;
  loaded: boolean;
}

let port: CalendarSettingsPort | null = null;
let state: CalendarSettingsState = { settings: defaultSettings(), loaded: false };
let loading: Promise<void> | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

/** Install the real port (the trainer's sealed store) or null to go back to the in-memory default. */
export function configureCalendarSettings(p: CalendarSettingsPort | null): void {
  port = p;
  loading = null;
  state = { settings: defaultSettings(), loaded: false };
  emit();
}

const activePort = (): CalendarSettingsPort => (port ??= createMemoryCalendarSettingsPort());

function ensureLoaded(): void {
  if (loading) return;
  const active = activePort();
  const mine = port;
  loading = active
    .load()
    .then((s) => {
      if (port !== mine) return;
      state = { settings: s ? sanitizeSettings(s) : state.settings, loaded: true };
      emit();
    })
    .catch(() => {
      if (port !== mine) return;
      state = { ...state, loaded: true };
      emit();
    });
}

/** Save: the new settings show at once, a failure puts the old ones back. */
export async function saveCalendarSettings(next: CalendarSettings): Promise<boolean> {
  const clean = sanitizeSettings(next);
  const before = state;
  state = { settings: clean, loaded: true };
  emit();
  try {
    await activePort().save(clean);
    return true;
  } catch {
    state = before;
    emit();
    return false;
  }
}

export function useCalendarSettings(): CalendarSettingsState & {
  save: (s: CalendarSettings) => Promise<boolean>;
} {
  useEffect(() => {
    ensureLoaded();
  }, []);
  const s = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => void subs.delete(f);
    },
    () => state,
    () => state,
  );
  return { ...s, save: saveCalendarSettings };
}
