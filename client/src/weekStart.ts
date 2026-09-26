/**
 * The training week's first day — an account setting (Profile › Settings),
 * synced across devices through `users/{uid}/meta/prefs` (see store.ts).
 *
 * Weekdays are ISO numbers everywhere in the app (1 = Monday … 7 = Sunday; the
 * program day keys use the same numbering). Only the ORDER and the week
 * boundaries follow this setting: a Sunday-start week runs Sun…Sat, and "this
 * week" begins on the most recent Sunday.
 */
import { useSyncExternalStore } from 'react';

export type IsoDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const KEY = 'spotter.weekStart';
const DAY_MS = 24 * 60 * 60 * 1000;

interface Stored {
  day: IsoDay;
  updatedAt: number;
}

function valid(d: unknown): d is IsoDay {
  return typeof d === 'number' && Number.isInteger(d) && d >= 1 && d <= 7;
}

function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Stored>;
      if (valid(v.day)) return { day: v.day, updatedAt: v.updatedAt ?? 0 };
    }
  } catch {
    /* private mode / corrupt value — fall back to Monday */
  }
  return { day: 1, updatedAt: 0 };
}

let current: Stored = load();
const listeners = new Set<() => void>();

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable — the in-memory value still applies */
  }
}

/** First day of the training week (ISO 1 = Mon … 7 = Sun). */
export function weekStartDay(): IsoDay {
  return current.day;
}

/** When the setting last changed (last-write-wins sync). */
export function weekStartUpdatedAt(): number {
  return current.updatedAt;
}

/** Change it locally (a user edit) or apply the synced value (`at` given). */
export function setWeekStartDay(day: IsoDay, at?: number): void {
  if (!valid(day)) return;
  const updatedAt = at ?? Date.now();
  if (at !== undefined && at < current.updatedAt) return;
  if (day === current.day && updatedAt === current.updatedAt) return;
  current = { day, updatedAt };
  save();
  for (const fn of listeners) fn();
}

/** Subscribe to changes (store sync + re-render). Returns the unsubscribe. */
export function onWeekStartChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** React hook: the current first day, re-rendering when it changes. */
export function useWeekStartDay(): IsoDay {
  return useSyncExternalStore(onWeekStartChange, weekStartDay, weekStartDay);
}

/** Reset on sign-out. */
export function resetWeekStart(): void {
  current = { day: 1, updatedAt: 0 };
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  for (const fn of listeners) fn();
}

// --- pure helpers -------------------------------------------------------------------

/** ISO weekday of a timestamp (1 = Mon … 7 = Sun). */
export function isoWeekday(ts: number): IsoDay {
  return (((new Date(ts).getDay() + 6) % 7) + 1) as IsoDay;
}

/** 0…6: where an ISO weekday sits in a week starting on `start`. */
export function weekPos(day: number, start: IsoDay = weekStartDay()): number {
  return (((day - start) % 7) + 7) % 7;
}

/** The seven ISO weekdays in display order for a week starting on `start`. */
export function weekOrder(start: IsoDay = weekStartDay()): IsoDay[] {
  return Array.from({ length: 7 }, (_, i) => (((start - 1 + i) % 7) + 1) as IsoDay);
}

/** Local midnight of the first day of the week containing `ts`. */
export function weekStartOf(ts: number, start: IsoDay = weekStartDay()): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - weekPos(isoWeekday(d.getTime()), start));
  return d.getTime();
}

/** Local midnight of ISO weekday `day` inside the week that starts at `weekStart`. */
export function dateInWeek(weekStart: number, day: number, start: IsoDay = weekStartDay()): number {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + weekPos(day, start));
  return d.getTime();
}

/** [start, end) of the week containing `ts`. */
export function weekBounds(ts: number, start: IsoDay = weekStartDay()): [number, number] {
  const s = weekStartOf(ts, start);
  const e = new Date(s);
  e.setDate(e.getDate() + 7);
  return [s, e.getTime()];
}

export { DAY_MS as WEEK_DAY_MS };
