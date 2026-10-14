/**
 * Coach date formatting, one place. Day-month order ("Wed 7 Oct"), 24h clock ("18:00"), fixed to the world's
 * time zone (the trainer's data clock), never the browser's. English uses en-GB ordering.
 */
import type { LocaleId } from '../i18n';

/** The zone the Coach world is read in (fixtures are built in UTC; the real adapter sets the trainer's zone once, Q-22). */
let coachTz = 'UTC';
export const coachTimeZone = (): string => coachTz;
export function setCoachTimeZone(tz: string): void {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    coachTz = tz;
  } catch {
    coachTz = 'UTC';
  }
}

const TZ_KEY = 'spotter.coach.tz';
const validZone = (tz: unknown): tz is string => {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};
/**
 * The trainer's own zone for the real backend: the stored setting when there is one, else this browser's zone. Called
 * once when the trainer's Coach installs. Fixtures, stories and tests never call it (they stay on UTC).
 */
export function initCoachTimeZone(): string {
  let tz: string | null = null;
  try {
    const stored = window.localStorage.getItem(TZ_KEY);
    if (validZone(stored)) tz = stored;
  } catch {
    /* no storage */
  }
  if (!tz) {
    const dev = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    tz = validZone(dev) ? dev : 'UTC';
  }
  setCoachTimeZone(tz);
  return tz;
}
/** The trainer picks the zone their gym runs in (stored on this device); existing sessions keep their wall-clock times. */
export function saveCoachTimeZone(tz: string): void {
  if (!validZone(tz)) return;
  try {
    window.localStorage.setItem(TZ_KEY, tz);
  } catch {
    /* no storage */
  }
  setCoachTimeZone(tz);
}

const loc = (l: LocaleId): string => (l === 'en' ? 'en-GB' : l);
const fmt = (l: LocaleId, o: Intl.DateTimeFormatOptions, ts: number): string =>
  new Intl.DateTimeFormat(loc(l), { timeZone: coachTz, ...o })
    .format(ts)
    .replace('.', '')
    .replace('Sept', 'Sep');

export const coachWeekday = (ts: number, l: LocaleId): string => fmt(l, { weekday: 'short' }, ts);
/** "7 Oct" */
export const coachDayMonth = (ts: number, l: LocaleId): string =>
  fmt(l, { day: 'numeric', month: 'short' }, ts);
/** "18:00" */
export const coachClock = (ts: number): string =>
  new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: coachTz,
  }).format(ts);
/** "Wed 7 Oct" */
export const coachDate = (ts: number, l: LocaleId): string =>
  `${coachWeekday(ts, l)} ${coachDayMonth(ts, l)}`;
/** "Fri 9 Oct, 18:00" */
export const coachMoment = (ts: number, l: LocaleId): string =>
  `${coachDate(ts, l)}, ${coachClock(ts)}`;
/** Eyebrow above a page title: "WED 7 OCT" */
export const coachEyebrow = (ts: number, l: LocaleId): string => coachDate(ts, l).toUpperCase();
