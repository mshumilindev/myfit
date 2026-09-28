/**
 * Pure date helpers for the kit Calendar. A "day" is an integer day key: the
 * number of whole days from 1970-01-01 to a LOCAL calendar date (built via
 * Date.UTC, so DST never shifts it). Same encoding as health.ts `ymdToDay`.
 */
import { isoWeekday, weekPos, type IsoDay } from '../../weekStart';

const DAY_MS = 86_400_000;

/** Day key of a local Y / M (0-based) / D. Overflowing D or M normalises. */
export function dayKeyOf(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m, d) / DAY_MS);
}

/** Day key of the local calendar date a timestamp falls on. */
export function dayOfTimestamp(ts: number): number {
  const d = new Date(ts);
  return dayKeyOf(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Local midnight of a day key. */
export function timestampOfDay(day: number): number {
  const u = new Date(day * DAY_MS);
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()).getTime();
}

/** { y, m, d } of a day key (m 0-based). */
export function ymdOf(day: number): { y: number; m: number; d: number } {
  const u = new Date(day * DAY_MS);
  return { y: u.getUTCFullYear(), m: u.getUTCMonth(), d: u.getUTCDate() };
}

/** First-of-month key `delta` months from the month containing `day`. */
export function addMonths(day: number, delta: number): number {
  const { y, m } = ymdOf(day);
  return dayKeyOf(y, m + delta, 1);
}

/** First-of-month key of the month containing `day`. */
export function monthStart(day: number): number {
  return addMonths(day, 0);
}

/** Last day key of the month containing `day`. */
export function monthEnd(day: number): number {
  return addMonths(day, 1) - 1;
}

/** Month grid rows for (y, m): 7 cells per row, null outside the month. */
export function monthWeeks(y: number, m: number, weekStart: IsoDay): (number | null)[][] {
  const first = dayKeyOf(y, m, 1);
  const n = new Date(y, m + 1, 0).getDate();
  const lead = weekPos(isoWeekday(timestampOfDay(first)), weekStart);
  const cells: (number | null)[] = Array.from({ length: lead }, () => null);
  for (let i = 0; i < n; i++) cells.push(first + i);
  while (cells.length % 7) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/** 0…6 column of a day in a week starting on `weekStart`. */
export function columnOf(day: number, weekStart: IsoDay): number {
  return weekPos(isoWeekday(timestampOfDay(day)), weekStart);
}
