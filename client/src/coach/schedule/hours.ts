/**
 * Working hours, gym hours and the visible range of the calendar grid. Pure (no React, no I/O).
 *
 * Everything is WALL-CLOCK minutes of a day in the trainer's zone (the same `minOfTs` the grid already uses), so DST
 * never needs special handling here: a day has its 24 wall hours in the grid, and a session's start / end minutes come
 * from `time.ts` (a nonexistent spring time already shifts forward there). Days of the week are 0 = Monday .. 6 = Sunday.
 *
 * Settings (sealed per trainer, see `calendarSettings.ts`):
 *   working   per weekday: { start, end } minutes, or null = a day off
 *   gymIds    the gyms the trainer works at ([] = none chosen)
 *   range     auto    = union of the working hours and the chosen gyms' hours (grown to hold any session outside)
 *             working = the working hours only (grown to hold any session outside)
 *             24h     = the whole day, 00:00 to 24:00
 */
export type RangeMode = 'auto' | 'working' | '24h';
export interface WorkDay {
  start: number;
  end: number;
}
export type WeekHours = (WorkDay | null)[];
/** A gym's opening hours: per weekday (Monday first) a list of `[open, close]` minutes. `close <= open` runs past midnight; `[0, 1440]` is 24 h. */
export type GymWeek = ReadonlyArray<ReadonlyArray<readonly [number, number]>>;
export type Span = readonly [number, number];

export interface CalendarSettings {
  v: 1;
  working: WeekHours;
  gymIds: string[];
  range: RangeMode;
}

export const DAY_MIN = 24 * 60;
/** The grid shows at least this when nothing says otherwise (the old fixed 07:00 to 21:00). */
export const FALLBACK_RANGE = { from: 7 * 60, to: 21 * 60 } as const;

export const defaultWorking = (): WeekHours =>
  Array.from({ length: 7 }, (_, i) => (i < 5 ? { start: 7 * 60, end: 21 * 60 } : null));

export const defaultSettings = (): CalendarSettings => ({
  v: 1,
  working: defaultWorking(),
  gymIds: [],
  range: 'auto',
});

const isMin = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

/** Whatever was stored (older, newer, damaged) becomes valid settings; unknown parts fall back to the defaults. */
export function sanitizeSettings(raw: unknown): CalendarSettings {
  const base = defaultSettings();
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;
  const working: WeekHours = base.working.map((d, i) => {
    const w = Array.isArray(o.working) ? (o.working as unknown[])[i] : undefined;
    if (w === null) return null;
    if (w && typeof w === 'object') {
      const { start, end } = w as Record<string, unknown>;
      if (isMin(start) && isMin(end) && start >= 0 && end <= DAY_MIN && end - start >= 60)
        return { start, end };
    }
    return d;
  });
  const gymIds = Array.isArray(o.gymIds)
    ? [...new Set((o.gymIds as unknown[]).filter((x): x is string => typeof x === 'string'))].slice(
        0,
        50,
      )
    : [];
  const range: RangeMode = o.range === 'working' || o.range === '24h' ? o.range : 'auto';
  return { v: 1, working, gymIds, range };
}

const mergeSpans = (spans: Span[]): Span[] => {
  const s = [...spans].filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const [a, b] of s) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
};

/**
 * One gym's opening spans for each weekday, with the ranges that run past midnight split: `22:00-02:00` on Friday is
 * `[22:00, 24:00]` on Friday AND `[00:00, 02:00]` on Saturday (so the spill-over opens the next day's column).
 */
export function gymSpansByDay(week: GymWeek): Span[][] {
  const out: Span[][] = Array.from({ length: 7 }, () => []);
  week.forEach((ranges, d) => {
    if (d > 6) return;
    for (const [a, b] of ranges) {
      if (b > a) out[d].push([a, Math.min(b, DAY_MIN)]);
      else {
        out[d].push([a, DAY_MIN]);
        if (b > 0) out[(d + 1) % 7].push([0, b]);
      }
    }
  });
  return out.map(mergeSpans);
}

/** True for a gym that is open all day, every day. */
export const is24x7 = (week: GymWeek | null | undefined): boolean =>
  !!week &&
  gymSpansByDay(week).every((s) => s.length === 1 && s[0][0] === 0 && s[0][1] === DAY_MIN);

export type GymWeeks = ReadonlyMap<string, GymWeek | null | undefined>;

/** The minutes of weekday `dow` the trainer is available: the working hours, plus (Auto) the chosen gyms' hours. */
export function availableSpans(s: CalendarSettings, gyms: GymWeeks, dow: number): Span[] {
  const spans: Span[] = [];
  const w = s.working[dow];
  if (w) spans.push([w.start, w.end]);
  if (s.range === 'auto')
    for (const id of s.gymIds) {
      const week = gyms.get(id);
      if (week) spans.push(...gymSpansByDay(week)[dow]);
    }
  return mergeSpans(spans);
}

export interface SessionSpan {
  /** minutes since local midnight of the day it is shown on */
  start: number;
  end: number;
}

const floorH = (m: number): number => Math.floor(m / 60) * 60;
const ceilH = (m: number): number => Math.ceil(m / 60) * 60;

/**
 * The visible hours of a grid showing the weekdays `dows`: whole hours, from the earliest to the latest of the available
 * spans (the old 07:00 to 21:00 when there are none), grown to hold every session in `sessions` (a session outside the
 * hours is never hidden). `24h` is always 00:00 to 24:00.
 */
export function visibleRange(
  s: CalendarSettings,
  gyms: GymWeeks,
  dows: readonly number[],
  sessions: readonly SessionSpan[] = [],
): { from: number; to: number } {
  if (s.range === '24h') return { from: 0, to: DAY_MIN };
  let from = Infinity;
  let to = -Infinity;
  for (const d of dows)
    for (const [a, b] of availableSpans(s, gyms, d)) {
      from = Math.min(from, floorH(a));
      to = Math.max(to, ceilH(b));
    }
  if (!Number.isFinite(from)) {
    from = FALLBACK_RANGE.from;
    to = FALLBACK_RANGE.to;
  }
  for (const e of sessions) {
    from = Math.min(from, floorH(e.start));
    to = Math.max(to, ceilH(Math.max(e.end, e.start + 1)));
  }
  from = Math.max(0, from);
  to = Math.min(DAY_MIN, to);
  return { from, to: Math.max(to, from + 60) };
}

/** The not-available parts of weekday `dow` inside `[from, to]`: what the grid shades. */
export function shadedBands(
  s: CalendarSettings,
  gyms: GymWeeks,
  dow: number,
  from: number,
  to: number,
): Span[] {
  const open = availableSpans(s, gyms, dow);
  const out: [number, number][] = [];
  let at = from;
  for (const [a, b] of open) {
    if (b <= from || a >= to) continue;
    if (a > at) out.push([at, Math.min(a, to)]);
    at = Math.max(at, b);
  }
  if (at < to) out.push([at, to]);
  return out;
}

export interface HoursCheck {
  /** outside the trainer's working hours (a day off counts) */
  outsideWorking: boolean;
  /** outside the opening hours of the gym; false when the gym's hours are not known */
  outsideGym: boolean;
}

const within = (spans: readonly Span[], a: number, b: number): boolean =>
  spans.some(([x, y]) => a >= x && b <= y);

/** Whether a session (minutes of its day) is outside the working hours / its gym's opening hours. */
export function checkHours(
  s: CalendarSettings,
  gyms: GymWeeks,
  dow: number,
  start: number,
  end: number,
  gymId?: string | null,
): HoursCheck {
  const w = s.working[dow];
  const outsideWorking = !w || start < w.start || end > w.end;
  const week = gymId ? gyms.get(gymId) : null;
  const outsideGym = week ? !within(gymSpansByDay(week)[dow], start, end) : false;
  return { outsideWorking, outsideGym };
}

/** "06:00–23:00", "24/7" or null (no hours known) for a gym's weekday, for the settings list. */
export function gymSummary(week: GymWeek | null | undefined, dow: number): string | null {
  if (!week) return null;
  const spans = gymSpansByDay(week)[dow];
  if (!spans.length) return null;
  const f = (m: number) =>
    `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return spans.map(([a, b]) => `${f(a)}–${b >= DAY_MIN ? '24:00' : f(b)}`).join(', ');
}

/** The gyms' default place for a new session: the first chosen gym that exists in `known`, else null. */
export const defaultGym = (s: CalendarSettings, known: readonly string[]): string | null =>
  s.gymIds.find((id) => known.includes(id)) ?? null;
