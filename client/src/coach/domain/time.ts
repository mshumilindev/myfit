/** Time helpers shared by the coach domain. All dates are epoch milliseconds, weeks start on Monday (UTC). */
export const MIN = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;
export const WEEK = 7 * DAY;

/** Monday 00:00 UTC of the week containing `t`. */
export function weekStartOf(t: number): number {
  const day = Math.floor(t / DAY);
  // 1970-01-01 was a Thursday: (day + 3) % 7 === 0 is Monday.
  const sinceMonday = (day + 3) % 7;
  return (day - sinceMonday) * DAY;
}

export const daysBetween = (from: number, to: number): number => Math.floor((to - from) / DAY);

/** Median of a non-empty list (mean of the middle two for even length). */
export function median(xs: readonly number[]): number {
  if (!xs.length) throw new Error('median-of-empty');
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export const mean = (xs: readonly number[]): number =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
