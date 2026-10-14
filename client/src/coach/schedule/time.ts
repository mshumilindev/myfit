/**
 * Wall-clock helpers of the schedule (R-BE-CAL-9). A session is a local DAY KEY (whole days since 1970-01-01 of the
 * calendar date in the trainer's zone) plus MINUTES since local midnight. Slots carry epoch ms (`start`); these
 * functions convert both ways in the Coach zone (`coachTimeZone()`), so DST never moves a session's wall-clock time:
 * a nonexistent time (spring gap) shifts forward, a repeated one (autumn) takes the first.
 * Day keys are the same integers the kit `Calendar` / `MonthGrid` use, so they feed them directly.
 */
import { coachTimeZone } from '../format';
import { DAY, MIN } from '../domain/time';

const cache = new Map<string, Intl.DateTimeFormat>();
function dtf(tz: string): Intl.DateTimeFormat {
  let f = cache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    });
    cache.set(tz, f);
  }
  return f;
}

/** Day key + minutes since midnight of an instant, in `tz`. */
export function wall(ts: number, tz: string = coachTimeZone()): { day: number; min: number } {
  if (tz === 'UTC') {
    const day = Math.floor(ts / DAY);
    return { day, min: Math.floor((ts - day * DAY) / MIN) };
  }
  const p: Record<string, number> = {};
  for (const x of dtf(tz).formatToParts(ts)) if (x.type !== 'literal') p[x.type] = Number(x.value);
  return {
    day: Math.floor(Date.UTC(p.year, p.month - 1, p.day) / DAY),
    min: p.hour * 60 + p.minute,
  };
}

const wallMs = (ts: number, tz: string): number => {
  const w = wall(ts, tz);
  return w.day * DAY + w.min * MIN;
};

/**
 * The instant of local `day` + `min` in `tz`. On the autumn repeat (a wall time that happens twice) it is the FIRST
 * occurrence; in the spring gap (a wall time that never happens) it shifts forward.
 */
export function tsOf(day: number, min: number, tz: string = coachTimeZone()): number {
  const guess = day * DAY + min * MIN;
  if (tz === 'UTC') return guess;
  const off = (t: number) => wallMs(t, tz) - (t - (t % MIN));
  // the offsets in force a day before, at and a day after the guess cover both sides of any transition
  const cands = [-DAY, 0, DAY].map((d) => guess - off(guess + d));
  const t1 = guess - off(guess);
  const valid = cands.filter((t) => wallMs(t, tz) === guess);
  if (valid.length) return Math.min(...valid);
  return Math.max(t1, guess - off(t1), ...cands); // spring gap: shift forward
}

export const dayOfTs = (ts: number): number => wall(ts).day;
export const minOfTs = (ts: number): number => wall(ts).min;

/** 0 = Monday .. 6 = Sunday. */
export const dowOfDay = (day: number): number => (((day + 3) % 7) + 7) % 7;
/** Day key of the Monday of the week containing `day`. */
export const weekStartDay = (day: number): number => day - dowOfDay(day);

export const toMin = (t: string): number => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const fromMin = (m: number): string =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export const ymd = (day: number): { y: number; m: number; d: number } => {
  const u = new Date(day * DAY);
  return { y: u.getUTCFullYear(), m: u.getUTCMonth(), d: u.getUTCDate() };
};
export const dayKeyOf = (y: number, m: number, d: number): number =>
  Math.floor(Date.UTC(y, m, d) / DAY);
/** First day key of the month containing `day`, and of the month `delta` months away. */
export const monthStartDay = (day: number, delta = 0): number => {
  const { y, m } = ymd(day);
  return dayKeyOf(y, m + delta, 1);
};
/** First visible day of a 5/6-week Monday-first month grid. */
export const monthGridStart = (day: number): number => weekStartDay(monthStartDay(day));
