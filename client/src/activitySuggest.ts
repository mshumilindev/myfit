/**
 * Log activity — day-pattern suggestions from the user's own history (design
 * docs/design/log-activity, m01/m06/w01). Pure over the activity list + "now":
 *
 *   • likelyNow — the activity type most often logged on THIS weekday near THIS
 *     time of day over the last ~8 weeks ("Saturday evening — Dance? The last 4
 *     Saturdays, ~2 h"), with its median duration and usual start. Hidden when
 *     there's no real pattern (fewer than 2 such days, or under a third of them).
 *   • upNext — right after something was logged today, what usually FOLLOWS that
 *     type the same day ("Sauna 20 min? — after Tennis").
 *   • also — smaller cards: what usually follows the hero, and the other
 *     frequent types on this weekday ("Walk · 30 min · Mornings · 3 of 6").
 *   • dayLoad — a rough "load today" meter for the web Quick-log panel.
 *
 * No store or React imports, so it unit-tests as plain data.
 */
import type { Activity, ActivityEffort, Workout } from './types';
import { activityCategory, durationMin } from './activities';
import { isoWeekday, type IsoDay } from './weekStart';

const DAY = 24 * 3600 * 1000;
const MIN = 60 * 1000;

export type TimeBand = 'morning' | 'afternoon' | 'evening' | 'night';

/** Morning 5–12, afternoon 12–17, evening 17–22, night otherwise. */
export function timeBand(ts: number): TimeBand {
  const h = new Date(ts).getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

export function minuteOfDay(ts: number): number {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

export function dayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Local midnight `n` calendar days before `ts`'s day (DST-safe). */
function daysBefore(ts: number, n: number): number {
  const d = new Date(dayStart(ts));
  d.setDate(d.getDate() - n);
  return d.getTime();
}

export function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** A typical duration people would type: 5-min steps under an hour, 15 above. */
export function roundDuration(min: number): number {
  if (min <= 0) return 0;
  if (min < 60) return Math.max(5, Math.round(min / 5) * 5);
  return Math.round(min / 15) * 15;
}

/** Pace "m:ss" per km, or null when it can't be honest. */
export function paceStr(minutes: number, km: number | null | undefined): string | null {
  if (!km || km <= 0 || minutes <= 0) return null;
  const secPerKm = Math.round((minutes * 60) / km);
  if (!Number.isFinite(secPerKm) || secPerKm <= 0 || secPerKm > 99 * 60) return null;
  return `${Math.floor(secPerKm / 60)}:${String(secPerKm % 60).padStart(2, '0')}`;
}

export interface Occurrence {
  /** Local midnight of the day. */
  day: number;
  /** Earliest start that day. */
  at: number;
  /** Total minutes of the type that day. */
  minutes: number;
}

export interface LikelyNow {
  kind: 'likely';
  type: string;
  /** Distinct same-weekday days (near this time) with this type. */
  count: number;
  /** Same weekdays in the window since the history began ("your last 6 Saturdays"). */
  weeks: number;
  medianMin: number;
  /** Usual start, minutes after midnight, rounded to 15. */
  usualStartMin: number;
  weekday: IsoDay;
  band: TimeBand;
  /** Up to the last 4 such days, oldest first (the little bar chart). */
  recent: Occurrence[];
}

export interface UpNext {
  kind: 'upnext';
  type: string;
  /** The type just logged today that this one usually follows. */
  after: string;
  medianMin: number;
  /** Days on which `type` followed `after`… */
  count: number;
  /** …out of the days `after` was logged in the window. */
  of: number;
}

export interface Suggestion {
  type: string;
  medianMin: number;
  reason: 'after' | 'band';
  /** For 'after': the hero type it follows. */
  after?: string;
  /** For 'band': when it's usually done. */
  band: TimeBand;
  count: number;
  of: number;
  /** Start of today's log of this type (the "Done" state), else null. */
  doneAt: number | null;
}

export interface SuggestResult {
  hero: LikelyNow | UpNext | null;
  also: Suggestion[];
  hasHistory: boolean;
  weekday: IsoDay;
  weeks: number;
}

export interface SuggestOptions {
  /** Look-back in weeks (default 8). */
  windowWeeks?: number;
  /** "Near this time" tolerance in minutes (default 3 h). */
  nearMin?: number;
  /** Types not to put in the hero (e.g. dismissed with "Not now"). */
  exclude?: string[];
  /** Max secondary cards (default 2). */
  maxAlso?: number;
}

const FOLLOW_WINDOW = 3 * 60 * MIN; // "after X" = started within 3 h of X ending
const MIN_RATIO = 1 / 3;

function finishedOnly(list: Activity[] | null | undefined): Activity[] {
  return (list ?? []).filter((a) => a.finishedAt !== null && durationMin(a) > 0);
}

function endOf(a: Activity): number {
  return a.finishedAt ?? a.startedAt + durationMin(a) * MIN;
}

/** Group a type's logs into one entry per calendar day. */
function perDay(list: Activity[]): Occurrence[] {
  const map = new Map<number, Occurrence>();
  for (const a of list) {
    const day = dayStart(a.startedAt);
    const cur = map.get(day);
    if (cur) {
      cur.minutes += durationMin(a);
      cur.at = Math.min(cur.at, a.startedAt);
    } else map.set(day, { day, at: a.startedAt, minutes: durationMin(a) });
  }
  return [...map.values()].sort((a, b) => a.day - b.day);
}

function byType(list: Activity[]): Map<string, Activity[]> {
  const m = new Map<string, Activity[]>();
  for (const a of list) {
    const arr = m.get(a.type);
    if (arr) arr.push(a);
    else m.set(a.type, [a]);
  }
  return m;
}

/** Days (per follower type) on which that type started after `anchor` ended. */
function followers(
  anchorType: string,
  list: Activity[],
): { of: number; counts: Map<string, number> } {
  const anchors = list.filter((a) => a.type === anchorType);
  const anchorDays = new Set(anchors.map((a) => dayStart(a.startedAt)));
  const counts = new Map<string, Set<number>>();
  for (const x of anchors) {
    const end = endOf(x);
    const day = dayStart(x.startedAt);
    for (const y of list) {
      if (y.type === anchorType || dayStart(y.startedAt) !== day) continue;
      if (y.startedAt < end - 15 * MIN || y.startedAt > end + FOLLOW_WINDOW) continue;
      const s = counts.get(y.type) ?? new Set<number>();
      s.add(day);
      counts.set(y.type, s);
    }
  }
  const out = new Map<string, number>();
  for (const [k, s] of counts) out.set(k, s.size);
  return { of: anchorDays.size, counts: out };
}

function bestOf(
  counts: Map<string, number>,
  of: number,
  skip: Set<string>,
): [string, number] | null {
  let best: [string, number] | null = null;
  for (const [k, c] of counts) {
    if (skip.has(k) || c < 2 || c / Math.max(1, of) < MIN_RATIO) continue;
    if (!best || c > best[1]) best = [k, c];
  }
  return best;
}

function medianMinutes(occ: Occurrence[]): number {
  return roundDuration(median(occ.map((o) => o.minutes)));
}

export function suggestActivities(
  activities: Activity[] | null | undefined,
  now: number,
  opts: SuggestOptions = {},
): SuggestResult {
  const windowWeeks = opts.windowWeeks ?? 8;
  const nearMin = opts.nearMin ?? 180;
  const maxAlso = opts.maxAlso ?? 2;
  const exclude = new Set(opts.exclude ?? []);
  const all = finishedOnly(activities);
  const today = dayStart(now);
  const windowStart = daysBefore(now, windowWeeks * 7);
  const weekday = isoWeekday(now);
  const inWindow = all.filter((a) => a.startedAt >= windowStart && a.startedAt < today);
  const sameWeekday = inWindow.filter((a) => isoWeekday(a.startedAt) === weekday);
  const todays = all.filter((a) => a.startedAt >= today && a.startedAt <= now + DAY);
  const loggedToday = new Map<string, number>();
  for (const a of [...todays].sort((x, y) => x.startedAt - y.startedAt))
    if (!loggedToday.has(a.type)) loggedToday.set(a.type, a.startedAt);

  // How many of this weekday the window holds since the history began.
  const first = all.length ? Math.min(...all.map((a) => a.startedAt)) : now;
  const firstDay = dayStart(first);
  let weeks = 0;
  for (let k = 1; k <= windowWeeks; k++) if (daysBefore(now, k * 7) >= firstDay) weeks++;

  const result: SuggestResult = {
    hero: null,
    also: [],
    hasHistory: all.length > 0,
    weekday,
    weeks,
  };
  if (!all.length) return result;

  const nowMin = minuteOfDay(now);
  const typesToday = new Set(loggedToday.keys());

  // --- Up next: what usually follows the thing just logged today --------------
  const lastToday = [...todays].sort((a, b) => endOf(b) - endOf(a))[0];
  if (lastToday && endOf(lastToday) >= now - 4 * 60 * MIN) {
    const f = followers(lastToday.type, inWindow);
    const best = bestOf(f.counts, f.of, new Set([...typesToday, ...exclude]));
    if (best) {
      const occ = perDay(inWindow.filter((a) => a.type === best[0]));
      result.hero = {
        kind: 'upnext',
        type: best[0],
        after: lastToday.type,
        medianMin: medianMinutes(occ),
        count: best[1],
        of: f.of,
      };
    }
  }

  // --- Likely now: most frequent type on this weekday near this time ----------
  const near = sameWeekday.filter((a) => Math.abs(minuteOfDay(a.startedAt) - nowMin) <= nearMin);
  let likely: LikelyNow | null = null;
  for (const [type, list] of byType(near)) {
    if (exclude.has(type) || typesToday.has(type)) continue;
    const occ = perDay(list);
    const count = occ.length;
    if (count < 2 || count / Math.max(1, weeks) < MIN_RATIO) continue;
    const lastDay = occ[occ.length - 1].day;
    if (
      likely &&
      (count < likely.count ||
        (count === likely.count && lastDay <= likely.recent[likely.recent.length - 1].day))
    )
      continue;
    const usual = Math.round(median(occ.map((o) => minuteOfDay(o.at))) / 15) * 15;
    likely = {
      kind: 'likely',
      type,
      count,
      weeks: Math.max(weeks, count),
      medianMin: medianMinutes(occ),
      usualStartMin: usual,
      weekday,
      band: timeBand(now),
      recent: occ.slice(-4),
    };
  }
  if (!result.hero && likely) result.hero = likely;

  // --- Also on this weekday ----------------------------------------------------
  const heroType = result.hero?.type ?? null;
  const taken = new Set<string>(heroType ? [heroType] : []);
  const also: Suggestion[] = [];
  if (result.hero?.kind === 'likely') {
    const f = followers(result.hero.type, sameWeekday);
    const best = bestOf(f.counts, f.of, new Set([...taken]));
    if (best) {
      const occ = perDay(sameWeekday.filter((a) => a.type === best[0]));
      also.push({
        type: best[0],
        medianMin: medianMinutes(occ),
        reason: 'after',
        after: result.hero.type,
        band: timeBand(occ[occ.length - 1]?.at ?? now),
        count: best[1],
        of: Math.max(weeks, best[1]),
        doneAt: loggedToday.get(best[0]) ?? null,
      });
      taken.add(best[0]);
    }
  }
  const frequent = [...byType(sameWeekday)]
    .map(([type, list]) => ({ type, occ: perDay(list) }))
    .filter((x) => !taken.has(x.type) && x.occ.length >= 2)
    .sort(
      (a, b) =>
        b.occ.length - a.occ.length || b.occ[b.occ.length - 1].day - a.occ[a.occ.length - 1].day,
    );
  for (const x of frequent) {
    if (also.length >= maxAlso) break;
    const startMin = median(x.occ.map((o) => minuteOfDay(o.at)));
    const probe = new Date(today);
    probe.setMinutes(Math.round(startMin));
    also.push({
      type: x.type,
      medianMin: medianMinutes(x.occ),
      reason: 'band',
      band: timeBand(probe.getTime()),
      count: x.occ.length,
      of: Math.max(weeks, x.occ.length),
      doneAt: loggedToday.get(x.type) ?? null,
    });
  }
  result.also = also.slice(0, maxAlso);
  return result;
}

/**
 * What usually follows `type` (m07 "After Dance, usually"): prefers the same
 * weekday's history, falling back to every day in the window. Null when no
 * type followed it on at least 2 days (and a third of them).
 */
export function followerOf(
  activities: Activity[] | null | undefined,
  type: string,
  now: number,
  windowWeeks = 8,
): { type: string; medianMin: number; count: number; of: number } | null {
  const today = dayStart(now);
  const windowStart = daysBefore(now, windowWeeks * 7);
  const inWindow = finishedOnly(activities).filter(
    (a) => a.startedAt >= windowStart && a.startedAt < today,
  );
  const weekday = isoWeekday(now);
  for (const list of [inWindow.filter((a) => isoWeekday(a.startedAt) === weekday), inWindow]) {
    const f = followers(type, list);
    const best = bestOf(f.counts, f.of, new Set());
    if (best) {
      const occ = perDay(list.filter((a) => a.type === best[0]));
      return { type: best[0], medianMin: medianMinutes(occ), count: best[1], of: f.of };
    }
  }
  return null;
}

/** The newest finished log per activity type. */
export function lastLoggedByType(activities: Activity[] | null | undefined): Map<string, Activity> {
  const m = new Map<string, Activity>();
  for (const a of finishedOnly(activities)) {
    const cur = m.get(a.type);
    if (!cur || a.startedAt > cur.startedAt) m.set(a.type, a);
  }
  return m;
}

/** Local midnights of days in [from, to) that hold finished activities, with their tones. */
export function activityDays(
  activities: Activity[] | null | undefined,
  toneOf: (a: Activity) => string,
): Map<number, Set<string>> {
  const m = new Map<number, Set<string>>();
  for (const a of finishedOnly(activities)) {
    const d = dayStart(a.startedAt);
    const s = m.get(d) ?? new Set<string>();
    s.add(toneOf(a));
    m.set(d, s);
  }
  return m;
}

const EFFORT_LOAD: Record<ActivityEffort, number> = { light: 0.7, moderate: 1, hard: 1.35 };

export interface DayLoad {
  liftMin: number;
  conditioningMin: number;
  recoveryMin: number;
  /** 0…1 fill of the "Load today" bar. */
  frac: number;
  level: 'light' | 'moderate' | 'high';
}

/**
 * A rough load score for today: lifting minutes + effort-weighted conditioning
 * minutes; recovery minutes shave a little off. Light < 60, moderate < 150,
 * high above; the bar fills at 240.
 */
export function dayLoad(
  workouts: Workout[] | null | undefined,
  activities: Activity[] | null | undefined,
  now: number,
): DayLoad {
  const today = dayStart(now);
  let liftMin = 0;
  for (const w of workouts ?? []) {
    if (w.startedAt < today || w.startedAt > now) continue;
    const end = w.finishedAt ?? now;
    liftMin += Math.max(0, (end - w.startedAt) / MIN);
  }
  let conditioningMin = 0;
  let recoveryMin = 0;
  let score = liftMin;
  for (const a of finishedOnly(activities)) {
    if (a.startedAt < today || a.startedAt > now) continue;
    const m = durationMin(a);
    if (activityCategory(a) === 'recovery') {
      recoveryMin += m;
      score -= m * 0.25;
    } else {
      conditioningMin += m;
      score += m * (EFFORT_LOAD[a.effort ?? 'moderate'] ?? 1);
    }
  }
  score = Math.max(0, score);
  return {
    liftMin: Math.round(liftMin),
    conditioningMin: Math.round(conditioningMin),
    recoveryMin: Math.round(recoveryMin),
    frac: Math.min(1, score / 240),
    level: score < 60 ? 'light' : score < 150 ? 'moderate' : 'high',
  };
}
