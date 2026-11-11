import type { LocaleId } from '../i18n';
import { fill, type PlannerStrings } from './strings';
import { parseDay, type DayKey } from './zoned';

/** English dates read "12 Nov" (day first), like the approved design. */
const INTL: Record<LocaleId, string> = {
  en: 'en-GB',
  uk: 'uk-UA',
  pl: 'pl-PL',
  lt: 'lt-LT',
  et: 'et-EE',
};
const at = (d: DayKey) => {
  const p = parseDay(d);
  return new Date(p.y, p.m - 1, p.d, 12);
};
export const dayLong = (l: LocaleId, d: DayKey) =>
  new Intl.DateTimeFormat(INTL[l], { weekday: 'long' }).format(at(d));
export const dayShort = (l: LocaleId, d: DayKey) =>
  new Intl.DateTimeFormat(INTL[l], { weekday: 'short' }).format(at(d));
/** "12 Nov". */
export const dayMonth = (l: LocaleId, d: DayKey) =>
  new Intl.DateTimeFormat(INTL[l], { day: 'numeric', month: 'short' }).format(at(d));
/** "Thu 12 Nov". */
export const dayFull = (l: LocaleId, d: DayKey) => `${dayShort(l, d)} ${dayMonth(l, d)}`;
export const monthYear = (l: LocaleId, d: DayKey) =>
  new Intl.DateTimeFormat(INTL[l], { month: 'long', year: 'numeric' }).format(at(d));
/** Short weekday names Monday first. 2026-11-09 is a Monday. */
export const weekdayShorts = (l: LocaleId): string[] =>
  Array.from({ length: 7 }, (_, i) => dayShort(l, `2026-11-${String(9 + i).padStart(2, '0')}`));

/** "Nov 9–15" (English) / "9–15 lis"; across months "28 lis – 4 gru". */
export function weekRange(l: LocaleId, a: DayKey, b: DayKey): string {
  const pa = parseDay(a);
  const pb = parseDay(b);
  const mon = (d: DayKey) =>
    new Intl.DateTimeFormat(l === 'en' ? 'en-US' : INTL[l], { month: 'short' }).format(at(d));
  if (pa.m === pb.m) return l === 'en' ? `${mon(a)} ${pa.d}–${pb.d}` : `${pa.d}–${pb.d} ${mon(a)}`;
  return l === 'en'
    ? `${mon(a)} ${pa.d} – ${mon(b)} ${pb.d}`
    : `${pa.d} ${mon(a)} – ${pb.d} ${mon(b)}`;
}

/** "45 min", "1 h", "1 h 30", "2 day". */
export function durText(s: PlannerStrings, m: number): string {
  if (m >= 1440 && m % 1440 === 0) return `${m / 1440} ${s.dayU}`;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h} ${s.h} ${r}` : `${h} ${s.h}`;
  }
  return `${m} ${s.min}`;
}
export const leadText = (s: PlannerStrings, m: number): string =>
  m === 0 ? s.atStart : fill(s.before, { d: durText(s, m) });

export const clock = (min: number): string => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
