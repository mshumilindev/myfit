/**
 * Weekly free hours (SPO-552 I9): pure helpers over `WeeklyHours` (day 0 = Monday ... 6 = Sunday, ranges in minutes since midnight [from, to)),
 * and the read-only list of Health states that override them. The screens only call these; nothing here touches storage.
 */
import type { RestPeriod } from '../types';
import type { WeeklyHours } from './types';

export type Range = [number, number];

/** Minutes in a day: the end of the last range of a day. */
export const DAY = 1440;

/** Sorted, clamped to 0..1440 (minutes), empty and inverted ranges dropped, touching or overlapping ranges merged. */
export function normalizeRanges(ranges: readonly Range[]): Range[] {
  const clean = ranges
    .map(([a, b]): Range => [
      Math.max(0, Math.min(DAY, Math.floor(a))),
      Math.max(0, Math.min(DAY, Math.floor(b))),
    ])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  const out: Range[] = [];
  for (const r of clean) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

export const dayRanges = (h: WeeklyHours, day: number): Range[] => normalizeRanges(h[day] ?? []);

/** A new week with `day` set to `ranges` (a day with no ranges is removed, so an empty week is `{}`). */
export function setDay(h: WeeklyHours, day: number, ranges: readonly Range[]): WeeklyHours {
  const next: WeeklyHours = { ...h };
  const r = normalizeRanges(ranges);
  if (r.length) next[day] = r;
  else delete next[day];
  return next;
}

/** Copies one day's hours onto the other days (the source stays as it is). */
export function copyDay(h: WeeklyHours, from: number, to: readonly number[]): WeeklyHours {
  let next = h;
  const src = dayRanges(h, from);
  for (const d of to) if (d !== from) next = setDay(next, d, src);
  return next;
}

export const WEEKDAYS = [0, 1, 2, 3, 4] as const;
export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6] as const;

/** Minutes since midnight as a clock: 360 -> "06:00", 1440 -> "24:00". */
export const timeText = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/**
 * Hours saved before ranges were minutes ([9, 10] meant 09:00-10:00) cannot be told apart per range, but a whole week whose every
 * end is within the first 24 minutes of a day is never a real week: it is the old unit, and it was only ever made by an old default.
 * Such a week reads as empty.
 */
export function dropHourEra(h: WeeklyHours): WeeklyHours {
  const all = Object.values(h).flat();
  return all.length > 0 && all.every(([, b]) => b <= 24) ? {} : h;
}

/** "06:00–08:00 · 18:00–21:00". Empty for a day with no hours. */
export const rangesText = (ranges: readonly Range[]): string =>
  ranges.map(([a, b]) => `${timeText(a)}–${timeText(b)}`).join(' · ');

const same = (a: readonly Range[], b: readonly Range[]): boolean =>
  a.length === b.length && a.every((r, i) => r[0] === b[i][0] && r[1] === b[i][1]);

export type WeekSummary =
  | { kind: 'none' }
  | { kind: 'weekdays'; text: string }
  | { kind: 'every'; text: string }
  | { kind: 'days'; count: number };

/** What the one-line summary on the Planner page says: the same hours Mon-Fri, the same hours every day, or just how many days. */
export function weekSummary(h: WeeklyHours): WeekSummary {
  const days = EVERY_DAY.filter((d) => dayRanges(h, d).length > 0);
  if (days.length === 0) return { kind: 'none' };
  const first = dayRanges(h, days[0]);
  if (days.length === 7 && days.every((d) => same(dayRanges(h, d), first))) {
    return { kind: 'every', text: rangesText(first) };
  }
  if (
    days.length === 5 &&
    WEEKDAYS.every((d) => days.includes(d)) &&
    days.every((d) => same(dayRanges(h, d), first))
  ) {
    return { kind: 'weekdays', text: rangesText(first) };
  }
  return { kind: 'days', count: days.length };
}

/** A Health state that makes the person unavailable: shown read-only, never edited here. */
export interface Override {
  id: string;
  kind: 'unwell' | 'rest';
  /** Day keys (Math.floor(ms / 86400000)), inclusive. `endDay` is null while the state is open-ended. */
  startDay: number;
  endDay: number | null;
  active: boolean;
}

/**
 * Unwell (illness) and Full rest (`off`) periods that have not ended yet, soonest first. Active rest is training, so it is not
 * an override. `shown` is Health's own gate for a period (its module is on), passed in so this stays pure.
 */
export function overrides(
  periods: readonly RestPeriod[],
  today: number,
  shown: (mode: RestPeriod['mode']) => boolean,
): Override[] {
  const out: Override[] = [];
  for (const p of periods) {
    if (p.mode === 'active' || !shown(p.mode)) continue;
    const open = p.open === true;
    if (!open && p.endDay < today) continue;
    out.push({
      id: p.id,
      kind: p.mode === 'illness' ? 'unwell' : 'rest',
      startDay: p.startDay,
      endDay: open ? null : p.endDay,
      active: p.startDay <= today,
    });
  }
  return out.sort((a, b) => a.startDay - b.startDay);
}
