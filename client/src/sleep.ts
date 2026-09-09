/**
 * Pure sleep helpers: durations, rolling stats, the learned per-weekday pattern
 * (with circular means so bedtimes near midnight average correctly), and the
 * readiness bias a night contributes. English is the source of truth; display
 * strings live in i18n.
 */
import type { SleepNight, SleepSchedule, SleepDayPlan } from './types';

const DAY = 86400000;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Local minutes from midnight (0..1439) for an epoch ms. */
export function minutesOfDay(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

/** A night's duration in minutes (live nights measure up to `now`). */
/** After this long with no activity off the sleep screen (or with the app
 *  closed), we take it that you actually fell asleep: the gap stops counting
 *  as "awake" and counts as sleep from your last activity onward. */
export const SLEEP_IDLE_MS = 5 * 60 * 1000;

/** How long after the scheduled bedtime the app may still auto-start tonight's
 *  night (beyond this we leave it to retroactive auto-log after wake). */
export const AUTO_START_WINDOW_MS = 45 * 60 * 1000;

/** The most recent clock occurrence of `bedMin` (minutes from midnight) at or
 *  before `now`, as epoch ms — today's if it has passed, else yesterday's. */
export function lastBedtimeAt(now: number, bedMin: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  let ts = d.getTime() + bedMin * 60000;
  if (ts > now) ts -= 86400000;
  return ts;
}

/** Awake (non-sleep) ms for a night as of `now`: banked intervals plus the
 *  open one, if any. An open interval that has gone idle past SLEEP_IDLE_MS is
 *  capped at the last activity — the idle tail counts as sleep, not awake. */
export function awakeMsAt(n: SleepNight, now: number = Date.now()): number {
  let awake = n.awakeMs ?? 0;
  if (n.awakeSince != null) {
    const cut = n.lastSeen ?? n.awakeSince;
    const upTo = now - cut >= SLEEP_IDLE_MS ? cut : now;
    awake += Math.max(0, upTo - n.awakeSince);
  }
  return awake;
}

export function nightDurationMin(n: SleepNight, now: number = Date.now()): number {
  const end = n.wake ?? now;
  return Math.max(0, Math.round((end - n.bedtime - awakeMsAt(n, now)) / 60000));
}

/** Finished nights (wake set), newest first, excluding anything in the future. */
export function finishedNights(
  sleeps: SleepNight[] | null | undefined,
  now: number = Date.now(),
): SleepNight[] {
  return (sleeps ?? [])
    .filter((n) => n.wake !== null && n.bedtime <= now)
    .sort((a, b) => b.bedtime - a.bedtime);
}

/** The most recent finished night. */
export function lastNight(
  sleeps: SleepNight[] | null | undefined,
  now: number = Date.now(),
): SleepNight | null {
  return finishedNights(sleeps, now)[0] ?? null;
}

// --- circular mean over minutes-of-day (handles the midnight wrap) ----------
function circularMeanMin(mins: number[]): number {
  if (mins.length === 0) return 0;
  let sx = 0;
  let sy = 0;
  for (const m of mins) {
    const a = (m / 1440) * 2 * Math.PI;
    sx += Math.cos(a);
    sy += Math.sin(a);
  }
  let ang = Math.atan2(sy / mins.length, sx / mins.length);
  if (ang < 0) ang += 2 * Math.PI;
  return Math.round((ang / (2 * Math.PI)) * 1440) % 1440;
}
/** Shortest signed distance (minutes) from a to b around the 24h clock. */
function circularDist(a: number, b: number): number {
  let d = Math.abs(a - b) % 1440;
  if (d > 720) d = 1440 - d;
  return d;
}

export interface SleepStats {
  nights: number;
  avgMin: number;
  /** Nights meeting the goal, of `nights`. */
  goalMet: number;
  /** % of nights whose bedtime sits within ±30 min of the usual bedtime. */
  consistencyPct: number;
  /** Δ average vs the previous window of the same length. */
  deltaVsPrevMin: number;
  /** Consecutive logged nights up to the most recent. */
  streak: number;
}

export function sleepStats(
  sleeps: SleepNight[] | null | undefined,
  now: number = Date.now(),
  goalMin = 480,
  days = 14,
): SleepStats {
  const all = finishedNights(sleeps, now);
  const from = now - days * DAY;
  const win = all.filter((n) => n.bedtime >= from);
  const prev = all.filter((n) => n.bedtime >= from - days * DAY && n.bedtime < from);
  const durs = win.map((n) => nightDurationMin(n, now));
  const avg = durs.length ? Math.round(durs.reduce((s, x) => s + x, 0) / durs.length) : 0;
  const prevDurs = prev.map((n) => nightDurationMin(n, now));
  const prevAvg = prevDurs.length
    ? Math.round(prevDurs.reduce((s, x) => s + x, 0) / prevDurs.length)
    : 0;
  // Consistency: how tightly each night holds to THAT WEEKDAY's usual bedtime.
  // A steady weekday sleeper who drifts later on weekends still scores high —
  // this is the per-weekday rhythm the whole feature is built around, so it
  // must not be punished as "inconsistent" against one flat nightly mean.
  const bedsByWd = new Map<number, number[]>();
  for (const n of win) {
    const wd = new Date(n.bedtime).getDay();
    const arr = bedsByWd.get(wd) ?? [];
    arr.push(minutesOfDay(n.bedtime));
    bedsByWd.set(wd, arr);
  }
  const wdMean = new Map<number, number>();
  for (const [wd, arr] of bedsByWd) wdMean.set(wd, circularMeanMin(arr));
  const within = win.filter(
    (n) =>
      circularDist(minutesOfDay(n.bedtime), wdMean.get(new Date(n.bedtime).getDay()) ?? 0) <= 30,
  ).length;
  const consistencyPct = win.length ? Math.round((within / win.length) * 100) : 0;
  // streak: consecutive calendar days with a logged night, ending at the latest.
  let streak = 0;
  if (all.length) {
    const dayset = new Set(all.map((n) => Math.floor(n.bedtime / DAY)));
    let cursor = Math.floor(all[0].bedtime / DAY);
    while (dayset.has(cursor)) {
      streak++;
      cursor--;
    }
  }
  return {
    nights: win.length,
    avgMin: avg,
    goalMet: durs.filter((d) => d >= goalMin).length,
    consistencyPct,
    deltaVsPrevMin: prevAvg ? avg - prevAvg : 0,
    streak,
  };
}

export type SleepConfidence = 'low' | 'med' | 'high';

export interface WeekdayPattern {
  /** Per weekday (0 = Sun … 6 = Sat); absent when no data for that day. */
  byDay: Partial<Record<number, SleepDayPlan & { durMin: number; n: number }>>;
  confidence: SleepConfidence;
  /** Distinct calendar weeks the history spans. */
  weeksCovered: number;
  /** Deep + stable enough to offer auto-log. */
  autoLogEligible: boolean;
}

/** Learn the per-weekday rhythm from finished nights (bed-day weekday). */
export function weekdayPattern(
  sleeps: SleepNight[] | null | undefined,
  now: number = Date.now(),
): WeekdayPattern {
  const all = finishedNights(sleeps, now);
  const byWeekday: Record<number, SleepNight[]> = {};
  for (const n of all) {
    const wd = new Date(n.bedtime).getDay();
    (byWeekday[wd] ??= []).push(n);
  }
  const byDay: WeekdayPattern['byDay'] = {};
  for (const wd of Object.keys(byWeekday).map(Number)) {
    const nights = byWeekday[wd];
    const beds = nights.map((n) => minutesOfDay(n.bedtime));
    const wakes = nights.map((n) => minutesOfDay(n.wake as number));
    const durs = nights.map((n) => nightDurationMin(n, now));
    byDay[wd] = {
      bedMin: circularMeanMin(beds),
      wakeMin: circularMeanMin(wakes),
      durMin: Math.round(durs.reduce((s, x) => s + x, 0) / durs.length),
      n: nights.length,
    };
  }
  const weeks = new Set(all.map((n) => Math.floor(n.bedtime / (7 * DAY)))).size;
  const stats = sleepStats(sleeps, now, 480, 28);
  let confidence: SleepConfidence = 'low';
  if (all.length >= 30 && stats.consistencyPct >= 80) confidence = 'high';
  else if (all.length >= 14 && stats.consistencyPct >= 60) confidence = 'med';
  return {
    byDay,
    confidence,
    weeksCovered: weeks,
    autoLogEligible: weeks >= 6 && confidence === 'high',
  };
}

/**
 * How last night should nudge readiness/recovery: 0 = neutral (met goal),
 * positive for a full/long night, negative for short or irregular sleep.
 * Returns roughly -1..1.
 */
export function sleepReadinessBias(
  sleeps: SleepNight[] | null | undefined,
  now: number = Date.now(),
  goalMin = 480,
): number {
  const all = finishedNights(sleeps, now);
  if (all.length === 0) return 0;
  const last = nightDurationMin(all[0], now);
  const recent = all.filter((n) => n.bedtime >= now - 7 * DAY).map((n) => nightDurationMin(n, now));
  const avg7 = recent.length ? recent.reduce((s, x) => s + x, 0) / recent.length : last;
  const lastTerm = clamp((last - goalMin) / 120, -1, 1);
  const avgTerm = clamp((avg7 - goalMin) / 120, -1, 1);
  const cons = sleepStats(sleeps, now, goalMin, 14).consistencyPct / 100;
  const consTerm = clamp((cons - 0.6) / 0.4, -1, 1);
  return clamp(0.5 * lastTerm + 0.3 * avgTerm + 0.2 * consTerm, -1, 1);
}

/** The intended plan for a weekday, from the schedule (0 = Sun … 6 = Sat). */
export function planForWeekday(
  schedule: SleepSchedule | null | undefined,
  weekday: number,
): SleepDayPlan | null {
  if (!schedule) return null;
  if (schedule.sameEveryNight) return schedule.every ?? null;
  return schedule.byDay[weekday] ?? schedule.every ?? null;
}

/** Duration of a plan in minutes (handling the overnight wrap). */
export function planDurationMin(p: SleepDayPlan): number {
  return (p.wakeMin - p.bedMin + 1440) % 1440;
}
