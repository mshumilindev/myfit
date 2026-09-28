/**
 * Health page model (design docs/design/health, F01–F10 / W01–W03): pure
 * helpers over rest periods, injuries and workouts — range validation, overlap
 * detection (with other periods and with logged workouts), overlap resolution
 * (merge / replace), date presets and the view-only timeline rows. The store
 * wires persistence; the view (views/HealthView.tsx) renders these.
 *
 * All days are "day keys" (see store.dayKey): the index of the LOCAL calendar
 * date, so `dayToTs` maps a key back to local midnight for formatting.
 */
import type { Injury, RestMode, RestPeriod, Workout } from './types';
import { isoWeekday, weekPos, type IsoDay } from './weekStart';

const DAY_MS = 86_400_000;

/** Local midnight of a day key (inverse of store.dayKey). */
export function dayToTs(day: number): number {
  const u = new Date(day * DAY_MS);
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()).getTime();
}

/** Day key of a local Y/M/D (month 0-based). */
export function ymdToDay(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m, d) / DAY_MS);
}

/** A candidate period range. `open` = no end yet (runs up to today). */
export interface DayRange {
  startDay: number;
  endDay: number;
  open?: boolean;
}

/** The last day a period currently covers (open periods run up to today). */
export function rangeEnd(r: DayRange, today: number): number {
  return r.open ? Math.max(today, r.startDay) : r.endDay;
}

/** Inclusive length in days (open periods counted up to today). */
export function rangeDays(r: DayRange, today: number): number {
  return rangeEnd(r, today) - r.startDay + 1;
}

export type RangeError = 'end-before-start' | 'future' | 'open-future-start';

/**
 * Validate a range for saving. `allowFuture` is true when starting / scheduling
 * a period (F03), false for logging the past (F04–F06). An open-ended period
 * must already have started (it runs up to today).
 */
export function validateRange(
  r: DayRange,
  opts: { today: number; allowFuture: boolean },
): RangeError | null {
  if (!r.open && r.endDay < r.startDay) return 'end-before-start';
  if (r.open && r.startDay > opts.today) return 'open-future-start';
  if (!opts.allowFuture && (r.startDay > opts.today || (!r.open && r.endDay > opts.today)))
    return 'future';
  return null;
}

/** Does [a] share at least one day with [b]? Open ranges extend without end. */
export function rangesOverlap(a: DayRange, b: DayRange): boolean {
  const aEnd = a.open ? Infinity : a.endDay;
  const bEnd = b.open ? Infinity : b.endDay;
  return a.startDay <= bEnd && b.startDay <= aEnd;
}

/** Other rest periods that overlap `r` (excluding `excludeId`, e.g. the one
 *  being edited). Newest-created first. */
export function overlappingPeriods(
  r: DayRange,
  periods: RestPeriod[],
  excludeId?: string | null,
): RestPeriod[] {
  return periods
    .filter((p) => p.id !== excludeId && rangesOverlap(r, p))
    .sort((a, b) => a.startDay - b.startDay);
}

/** Finished workouts logged on a day inside `r` (the F04 overlap state). */
export function workoutsInRange(r: DayRange, workouts: Workout[], today: number): Workout[] {
  const end = rangeEnd(r, today);
  return workouts
    .filter((w) => {
      if (w.finishedAt === null) return false;
      const d = dayOfTs(w.startedAt);
      return d >= r.startDay && d <= end;
    })
    .sort((a, b) => a.startedAt - b.startedAt);
}

/** Local day key of a timestamp (same bucketing as store.dayKey). */
export function dayOfTs(ts: number): number {
  const d = new Date(ts);
  return ymdToDay(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Does this mode clash with logged workouts? Active recovery is still gym
 *  time (light training), so only full rest and illness ask what to keep. */
export function modeSkipsWorkouts(mode: RestMode): boolean {
  return mode !== 'active';
}

/**
 * What remains of period `p` once `r` is cut out of it ("Replace those days"):
 * zero, one or two pieces. A piece after an open-ended `p` stays open.
 */
export function cutOut(p: RestPeriod, r: DayRange): DayRange[] {
  const pieces: DayRange[] = [];
  if (p.startDay < r.startDay) pieces.push({ startDay: p.startDay, endDay: r.startDay - 1 });
  if (!r.open) {
    const after = r.endDay + 1;
    if (p.open) {
      if (after >= p.startDay) pieces.push({ startDay: after, endDay: after, open: true });
    } else if (after <= p.endDay) {
      pieces.push({ startDay: Math.max(after, p.startDay), endDay: p.endDay });
    }
  }
  return pieces;
}

/** Union of `r` with the overlapping periods ("Merge into one period"). */
export function mergeRanges(r: DayRange, others: DayRange[]): DayRange {
  let start = r.startDay;
  let end = r.open ? r.startDay : r.endDay;
  let open = !!r.open;
  for (const o of others) {
    start = Math.min(start, o.startDay);
    if (o.open) open = true;
    else end = Math.max(end, o.endDay);
  }
  return open
    ? { startDay: start, endDay: Math.max(start, end), open: true }
    : { startDay: start, endDay: end };
}

/** Which form the Health page shows (overlay `{ screen: 'health', form }`). */
export type HealthFormSpec =
  | { kind: 'new'; ctx: 'start' | 'past'; type: RestMode | 'injury' }
  | { kind: 'edit'; periodId: string }
  | { kind: 'edit-injury'; injuryId: string };

// --- Date presets -------------------------------------------------------------

export type RangePreset =
  | 'today'
  | 'yesterday'
  | 'last3'
  | 'thisWeek'
  | 'lastWeek'
  | 'nextWeek'
  | 'next7'
  | 'tenDays'
  | 'twoWeeks';

/** First day (key) of the training week containing `day`. */
export function weekFirstDay(day: number, start: IsoDay): number {
  return day - weekPos(isoWeekday(dayToTs(day)), start);
}

/**
 * The range a preset picks. Past presets (F04/F05) end today at the latest;
 * the scheduling presets (F03) keep the chosen start for "10 days" / "2 weeks".
 */
export function presetRange(
  preset: RangePreset,
  ctx: { today: number; weekStart: IsoDay; start: number },
): { startDay: number; endDay: number } {
  const { today, weekStart } = ctx;
  const wk = weekFirstDay(today, weekStart);
  switch (preset) {
    case 'today':
      return { startDay: today, endDay: today };
    case 'yesterday':
      return { startDay: today - 1, endDay: today - 1 };
    case 'last3':
      return { startDay: today - 2, endDay: today };
    case 'thisWeek':
      return { startDay: wk, endDay: today };
    case 'lastWeek':
      return { startDay: wk - 7, endDay: wk - 1 };
    case 'nextWeek':
      return { startDay: wk + 7, endDay: wk + 13 };
    case 'next7':
      return { startDay: today + 1, endDay: today + 7 };
    case 'tenDays':
      return { startDay: ctx.start, endDay: ctx.start + 9 };
    case 'twoWeeks':
      return { startDay: ctx.start, endDay: ctx.start + 13 };
  }
}

/** Which preset (if any) the current range equals — drives aria-pressed. */
export function matchingPreset(
  presets: RangePreset[],
  r: { startDay: number; endDay: number },
  ctx: { today: number; weekStart: IsoDay; start: number },
): RangePreset | null {
  for (const p of presets) {
    const x = presetRange(p, ctx);
    if (x.startDay === r.startDay && x.endDay === r.endDay) return p;
  }
  return null;
}

// --- Calendar ------------------------------------------------------------------

/** Month grid (weeks × 7) of day keys, `null` for padding, in week order. */
export function monthGrid(year: number, month: number, weekStart: IsoDay): (number | null)[] {
  const first = ymdToDay(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const lead = weekPos(isoWeekday(dayToTs(first)), weekStart);
  const cells: (number | null)[] = Array.from({ length: lead }, () => null);
  for (let i = 0; i < days; i++) cells.push(first + i);
  while (cells.length % 7) cells.push(null);
  return cells;
}

// --- History items ---------------------------------------------------------------

export type HealthKind = 'rest' | 'illness' | 'injury';

/** One row of the history list / timeline: a rest period or an injury. */
export interface HealthItem {
  id: string;
  kind: HealthKind;
  /** 'rest' items: 'active' | 'off'; illness: 'illness'; injury: undefined. */
  mode?: RestMode;
  startDay: number;
  /** Last covered day (today for ongoing items). */
  endDay: number;
  ongoing: boolean;
  /** Starts after today (scheduled). */
  future: boolean;
  period?: RestPeriod;
  injury?: Injury;
}

export function kindOfMode(mode: RestMode): HealthKind {
  return mode === 'illness' ? 'illness' : 'rest';
}

/** Rest periods + injuries as history items, newest first. */
export function healthItems(
  periods: RestPeriod[],
  injuries: Injury[],
  today: number,
): HealthItem[] {
  const items: HealthItem[] = [];
  for (const p of periods) {
    const end = rangeEnd(p, today);
    items.push({
      id: p.id,
      kind: kindOfMode(p.mode),
      mode: p.mode,
      startDay: p.startDay,
      endDay: end,
      ongoing: p.startDay <= today && (p.open === true || p.endDay >= today),
      future: p.startDay > today,
      period: p,
    });
  }
  for (const i of injuries) {
    const healed = i.healedDay ?? null;
    items.push({
      id: i.id,
      kind: 'injury',
      startDay: i.startDay,
      endDay: healed ?? Math.max(today, i.startDay),
      ongoing: healed === null,
      future: false,
      injury: i,
    });
  }
  return items.sort((a, b) => b.endDay - a.endDay || b.startDay - a.startDay);
}

/** Timeline row (F08) — view-only. */
export type TimelineRow =
  | { kind: 'later'; items: HealthItem[] }
  | { kind: 'now'; count: number }
  | {
      kind: 'item';
      item: HealthItem;
      lane: 0 | 1 | null;
      through: HealthItem[];
      topFlat: boolean;
    }
  | { kind: 'month'; ts: number }
  | { kind: 'gap'; from: number; to: number }
  | { kind: 'origin'; day: number | null };

/**
 * Build the vertical timeline: scheduled items on top ("Later"), a "Now"
 * marker, then ongoing items and past ones newest first, with month headers
 * and "free" gaps between periods. Two items that share days are drawn in two
 * lanes (side by side); an earlier ongoing item passes through later rows.
 */
export function timelineRows(
  items: HealthItem[],
  today: number,
  originDay: number | null,
): TimelineRow[] {
  const rows: TimelineRow[] = [];
  const future = items.filter((i) => i.future).sort((a, b) => a.startDay - b.startDay);
  const current = items.filter((i) => !i.future && i.ongoing);
  const past = items.filter((i) => !i.future && !i.ongoing);
  rows.push({ kind: 'later', items: future });
  rows.push({ kind: 'now', count: current.length });
  const body = [...current.sort((a, b) => b.startDay - a.startDay), ...past];
  const overlapsAny = (it: HealthItem) =>
    body.some((o) => o !== it && o.startDay <= it.endDay && it.startDay <= o.endDay);
  let lastMonth: number | null = null;
  let prevStart: number | null = current.length ? null : today + 1;
  const monthKey = (day: number) => {
    const d = new Date(dayToTs(day));
    return d.getFullYear() * 12 + d.getMonth();
  };
  const pushMonth = (day: number) => {
    const mk = monthKey(day);
    if (lastMonth !== mk) {
      lastMonth = mk;
      const d = new Date(dayToTs(day));
      rows.push({ kind: 'month', ts: new Date(d.getFullYear(), d.getMonth(), 1).getTime() });
    }
  };
  for (const it of body) {
    const concurrent = overlapsAny(it);
    // Earlier-started items still running through this item's days.
    const through = body.filter(
      (o) => o !== it && o.startDay < it.startDay && o.endDay >= it.startDay,
    );
    const topFlat =
      it.ongoing ||
      body.some((o) => o !== it && o.startDay > it.startDay && it.endDay >= o.startDay);
    if (!it.ongoing) {
      if (prevStart !== null && prevStart - 1 > it.endDay) {
        const gapTo = prevStart - 1;
        // The first past section opens with its month; later gaps hang under
        // the period above them (design F08).
        if (lastMonth === null) pushMonth(gapTo);
        rows.push({ kind: 'gap', from: it.endDay + 1, to: gapTo });
      }
      pushMonth(it.endDay);
    }
    rows.push({
      kind: 'item',
      item: it,
      lane: concurrent ? (through.length > 0 ? 0 : 1) : null,
      through,
      topFlat,
    });
    prevStart = prevStart === null ? it.startDay : Math.min(prevStart, it.startDay);
  }
  rows.push({ kind: 'origin', day: originDay });
  return rows;
}
