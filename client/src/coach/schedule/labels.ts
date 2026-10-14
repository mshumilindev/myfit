/** Date words of the schedule: Intl in the active locale over UTC day keys (a day key IS a calendar date, no zone maths). */
import type { LocaleId } from '../../i18n';
import { DAY } from '../domain/time';
import { ymd } from './time';

const loc = (l: LocaleId): string => (l === 'en' ? 'en-GB' : l);
const fmt = (l: LocaleId, o: Intl.DateTimeFormatOptions, day: number): string =>
  new Intl.DateTimeFormat(loc(l), { timeZone: 'UTC', ...o })
    .format(day * DAY)
    .replace('.', '')
    .replace('Sept', 'Sep');

export const shortWeekday = (day: number, l: LocaleId): string => fmt(l, { weekday: 'short' }, day);
export const longWeekday = (day: number, l: LocaleId): string => fmt(l, { weekday: 'long' }, day);
export const dayNumber = (day: number): number => ymd(day).d;
/** "7 Oct" */
export const dayMonth = (day: number, l: LocaleId): string =>
  fmt(l, { day: 'numeric', month: 'short' }, day);
/** "Wed 7 Oct" */
export const shortDate = (day: number, l: LocaleId): string =>
  `${shortWeekday(day, l)} ${dayMonth(day, l)}`;
/** "Wednesday, 7 Oct" */
export const longDate = (day: number, l: LocaleId): string =>
  `${longWeekday(day, l)}, ${dayMonth(day, l)}`;
/** "October 2026" */
export const monthYear = (day: number, l: LocaleId): string => {
  const s = fmt(l, { month: 'long', year: 'numeric' }, day);
  return s.charAt(0).toUpperCase() + s.slice(1);
};
/** "5 – 11 Oct 2026" / "28 Sep – 4 Oct 2026" */
export function rangeLabel(a: number, b: number, l: LocaleId): string {
  const x = ymd(a);
  const y = ymd(b);
  const year = y.y;
  if (x.m === y.m) return `${x.d} – ${dayMonth(b, l)} ${year}`;
  return `${dayMonth(a, l)} – ${dayMonth(b, l)} ${year}`;
}
export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;
