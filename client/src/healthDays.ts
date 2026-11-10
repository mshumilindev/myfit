/** Calendar-day helpers shared by the health trackers (kept apart from the alcohol model so supplements etc. do not pull it in). */

/** A calendar day: a Date, a ms timestamp, or a 'YYYY-MM-DD' string (read as a local day). */
export type DayInput = Date | number | string;

export function toLocalDate(day: DayInput): Date | null {
  if (day instanceof Date) return Number.isNaN(day.getTime()) ? null : day;
  if (typeof day === 'number') return Number.isFinite(day) ? new Date(day) : null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(day);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Weekday of a day, 0 = Monday ... 6 = Sunday; null when the input is not a date. */
export function weekdayIndex(day: DayInput): number | null {
  const d = toLocalDate(day);
  return d ? (d.getDay() + 6) % 7 : null;
}

/** The local calendar day as 'YYYY-MM-DD'; null when the input is not a date. */
export function dayKey(day: DayInput): string | null {
  const d = toLocalDate(day);
  if (!d) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** A 'YYYY-MM-DD' key `n` calendar days later (negative = earlier). DST-safe. */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n))!;
}

/** Keeps the 60 newest check-ins (by day) and drops invalid ones. */
export const MAX_CHECKIN_DAYS = 60;
