/**
 * Planner plans: one-off or repeating, and the maths of "when does it happen / when does the reminder fire".
 * Pure and dependency-free (no store, no history): a plan only reminds, it never reads or writes a log (SPO-552).
 */
import {
  addDays,
  dayNumber,
  daysInMonth,
  localParts,
  parseDay,
  weekday,
  zonedToUtc,
  type DayKey,
} from './zoned';

export type Repeat =
  | { kind: 'none' }
  | { kind: 'daily'; every: number }
  /** `days`: 0 = Monday … 6 = Sunday. "Every weekday" = [0,1,2,3,4]. */
  | { kind: 'weekly'; every: number; days: number[] }
  /** The same day of the month; a short month uses its last day. */
  | { kind: 'monthly'; every: number };

export type Ends =
  { kind: 'never' } | { kind: 'on'; day: DayKey } | { kind: 'count'; count: number };

export interface PlanTiming {
  /** IANA zone of the author; the plan keeps its local clock time when the offset changes. */
  tz: string;
  /** First day (for a one-off, its only day). */
  start: DayKey;
  /** Local 'HH:mm'. */
  time: string;
  /** Minutes before the start the reminder fires (default 60, up to 2 days). */
  lead: number;
  repeat: Repeat;
  ends: Ends;
  /** Single days removed from the series. They still count towards an "after N plans" end. */
  skip: DayKey[];
}

export const DEFAULT_LEAD = 60;
export const MAX_LEAD = 2 * 24 * 60;
const SAFETY = 20_000;

/** Every day the series lands on, in order, until it ends (skipped days excluded). Bounded by `limitDay` when given. */
export function* occurrences(p: PlanTiming, limitDay?: DayKey): Generator<DayKey> {
  const skip = new Set(p.skip);
  const stop = limitDay ? dayNumber(limitDay) : Infinity;
  const endDay = p.ends.kind === 'on' ? dayNumber(p.ends.day) : Infinity;
  const maxCount = p.ends.kind === 'count' ? p.ends.count : Infinity;
  let n = 0;
  for (const d of raw(p)) {
    const dn = dayNumber(d);
    if (dn > stop || dn > endDay || n >= maxCount) return;
    n++;
    if (!skip.has(d)) yield d;
  }
}

function* raw(p: PlanTiming): Generator<DayKey> {
  const r = p.repeat;
  if (r.kind === 'none') {
    yield p.start;
    return;
  }
  const every = Math.max(1, Math.floor(r.every));
  if (r.kind === 'daily') {
    for (let i = 0; i < SAFETY; i++) yield addDays(p.start, i * every);
    return;
  }
  if (r.kind === 'weekly') {
    const days = [...new Set(r.days)].filter((x) => x >= 0 && x <= 6).sort((a, b) => a - b);
    if (!days.length) return;
    const monday = addDays(p.start, -weekday(p.start));
    for (let w = 0; w < SAFETY; w += every)
      for (const wd of days) {
        const d = addDays(monday, w * 7 + wd);
        if (dayNumber(d) >= dayNumber(p.start)) yield d;
      }
    return;
  }
  const { y, m, d } = parseDay(p.start);
  for (let i = 0; i < SAFETY; i += every) {
    const mm = m - 1 + i;
    const yy = y + Math.floor(mm / 12);
    const mo = ((mm % 12) + 12) % 12;
    const day = Math.min(d, daysInMonth(yy, mo + 1));
    yield `${yy}-${String(mo + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
}

/** Occurrences inside [from, to] (inclusive), for the week, day and month views. */
export function occurrencesBetween(p: PlanTiming, from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  const f = dayNumber(from);
  for (const d of occurrences(p, to)) if (dayNumber(d) >= f) out.push(d);
  return out;
}

export interface Fire {
  day: DayKey;
  /** UTC ms of the start. */
  startAt: number;
  /** UTC ms the reminder fires. */
  fireAt: number;
}

export function fireFor(p: PlanTiming, day: DayKey): Fire {
  const startAt = zonedToUtc(day, p.time, p.tz);
  return { day, startAt, fireAt: startAt - Math.min(Math.max(0, p.lead), MAX_LEAD) * 60_000 };
}

/** How far ahead the open list of reminder moments reaches, and its size limit. */
export const FIRE_HORIZON_DAYS = 28;
export const FIRE_MAX = 32;

/**
 * The reminder moments (UTC ms, ascending) after `now` within the horizon: what the server is given in the open, because it
 * cannot read the sealed repeat rule. Refreshed whenever the plan is saved and when the app opens.
 */
export function upcomingFires(
  p: PlanTiming,
  now: number,
  horizonDays = FIRE_HORIZON_DAYS,
  max = FIRE_MAX,
): number[] {
  const until = now + horizonDays * 86_400_000;
  const from = dayNumber(localParts(now, p.tz).day) - 3;
  const out: number[] = [];
  for (const d of occurrences(p)) {
    if (dayNumber(d) < from) continue;
    const f = fireFor(p, d);
    if (f.fireAt > until) break;
    if (f.fireAt > now) out.push(f.fireAt);
    if (out.length >= max) break;
  }
  return out;
}

/** The next reminder strictly after `now` (the open `nextFireAt`), or null when the plan is over. */
export function nextFire(p: PlanTiming, now: number): Fire | null {
  // Start two days before today in the plan's zone: a long lead can reach back from a later day.
  const today = localParts(now, p.tz).day;
  const from = dayNumber(today) - 3;
  for (const d of occurrences(p)) {
    if (dayNumber(d) < from) continue;
    const f = fireFor(p, d);
    if (f.fireAt > now) return f;
    if (dayNumber(d) > dayNumber(today) + 3 + Math.ceil(MAX_LEAD / 1440)) return null;
  }
  return null;
}

/** Delete one day of a series (a one-off is removed by the caller). */
export function skipDay(p: PlanTiming, day: DayKey): PlanTiming {
  return p.skip.includes(day) ? p : { ...p, skip: [...p.skip, day].sort() };
}

/** Delete this day and everything after it. Returns null when nothing is left. */
export function endBefore(p: PlanTiming, day: DayKey): PlanTiming | null {
  if (dayNumber(day) <= dayNumber(p.start)) return null;
  return {
    ...p,
    ends: { kind: 'on', day: addDays(day, -1) },
    skip: p.skip.filter((s) => dayNumber(s) < dayNumber(day)),
  };
}
