/**
 * Holiday schedule (SPO-321). Pure: no DOM, no storage, no network, so it is trivial to test and nothing here is a
 * server job — the app reads the date on the device when it opens and puts the holiday theme on by itself.
 *
 * A holiday theme is ON from `LEAD_DAYS` days before the holiday through the holiday itself (or through `trail` days
 * after it, Christmas: until 1 January), and OFF the next day (the person's own theme comes back). Dates are the device's local calendar dates, so the switch happens at the
 * person's own midnight.
 *
 * Calendars (assumptions, SPO-321 open question; change the table, not the code):
 *  - Easter: Western (Gregorian) date everywhere, Orthodox (Julian) date for the Ukrainian UI language.
 *  - Christmas: 25 December everywhere (Ukraine's official date since 2023; 7 January is not used); the theme runs
 *    from 18 December through 1 January (owner, 28.10).
 *  - St Patrick's Day: 17 March everywhere.
 *  - Independence Day: paused (owner, 22.10: dropped from the first set; the date is region-specific).
 */

export type HolidayId =
  'valentine' | 'stpatrick' | 'easter' | 'halloween' | 'christmas' | 'independence';

/** How many days before the holiday its theme comes on. The theme goes off the day AFTER the holiday. */
export const LEAD_DAYS = 7;

/** A local calendar date (month 1–12). */
export interface DayDate {
  y: number;
  m: number;
  d: number;
}

export interface HolidayDef {
  id: HolidayId;
  /** `false` = in the schedule but never switched on (paused by the owner). */
  active: boolean;
  /** Days the theme stays on AFTER the holiday (default 0). */
  trail?: number;
  /** The holiday's date in `year` for a UI language. */
  on: (year: number, locale: string) => DayDate;
}

/** UI languages whose Easter follows the Julian calendar (Orthodox). */
const ORTHODOX_EASTER_LOCALES: readonly string[] = ['uk'];

/** Western Easter Sunday (Meeus/Jones/Butcher, Gregorian). */
export function westernEaster(year: number): DayDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { y: year, m: month, d: day };
}

/** Orthodox Easter Sunday on the Gregorian calendar (Julian computus + 13 days, valid 1900–2099). */
export function orthodoxEaster(year: number): DayDate {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  return addDays({ y: year, m: month, d: day }, 13);
}

const utc = (x: DayDate): number => Date.UTC(x.y, x.m - 1, x.d);

export function addDays(x: DayDate, n: number): DayDate {
  const t = new Date(utc(x) + n * 86_400_000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export function daysBetween(a: DayDate, b: DayDate): number {
  return Math.round((utc(b) - utc(a)) / 86_400_000);
}

export function dayOf(now: Date): DayDate {
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

/** The schedule. Order = priority when two windows overlap and are equally close (never today). */
export const HOLIDAYS: readonly HolidayDef[] = [
  { id: 'valentine', active: true, on: (y) => ({ y, m: 2, d: 14 }) },
  { id: 'stpatrick', active: true, on: (y) => ({ y, m: 3, d: 17 }) },
  {
    id: 'easter',
    active: true,
    on: (y, locale) =>
      ORTHODOX_EASTER_LOCALES.includes(locale.slice(0, 2)) ? orthodoxEaster(y) : westernEaster(y),
  },
  { id: 'halloween', active: true, on: (y) => ({ y, m: 10, d: 31 }) },
  { id: 'christmas', active: true, trail: 7, on: (y) => ({ y, m: 12, d: 25 }) },
  { id: 'independence', active: false, on: (y) => ({ y, m: 8, d: 24 }) },
];

export interface HolidayWindow {
  id: HolidayId;
  /** The holiday itself. */
  day: DayDate;
  /** First day the theme is on. */
  from: DayDate;
  /** Last day the theme is on (the holiday, or its trail); it goes off the day after. */
  to: DayDate;
}

/** The holiday whose window contains `today`, the nearest one if windows overlap; `null` otherwise. */
export function activeHoliday(
  today: DayDate,
  locale: string,
  only?: (id: HolidayId) => boolean,
): HolidayWindow | null {
  let best: HolidayWindow | null = null;
  let bestLeft = Infinity;
  for (const h of HOLIDAYS) {
    if (!h.active || (only && !only(h.id))) continue;
    // a window can straddle New Year, so look at the neighbouring years too
    for (const y of [today.y - 1, today.y, today.y + 1]) {
      const day = h.on(y, locale);
      const trail = h.trail ?? 0;
      const left = daysBetween(today, day);
      if (left < -trail || left > LEAD_DAYS) continue;
      // after the day itself a window counts as "closest" only once the holidays still to come are further away
      const dist = left < 0 ? 0 : left;
      if (dist < bestLeft) {
        bestLeft = dist;
        best = { id: h.id, day, from: addDays(day, -LEAD_DAYS), to: addDays(day, trail) };
      }
    }
  }
  return best;
}

/** Calendar year of the holiday, for "skipped this year". */
export const skipKey = (w: HolidayWindow): string => `${w.id}:${w.day.y}`;

/** Milliseconds from `now` to the next local midnight (when the schedule is read again). */
export function msToNextDay(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return Math.max(1_000, next.getTime() - now.getTime());
}
