/**
 * Activity trends — a plain-data rollup of the user's finished activities over
 * the last N weeks (design: Trends tab › Activities block, variant A):
 *
 *   • per-week conditioning vs recovery minutes (the stacked bars),
 *   • totals (sessions · active time · kcal) and the last-4-vs-prior-4 change,
 *   • the most frequent activity types, each with its own weekly series, usual
 *     weekday, median length and a Rising / Steady / Fading momentum label.
 *
 * Pure over the activity list + "now" — no store or React imports.
 */
import type { Activity } from './types';
import { activityCalories, activityCategory, durationMin } from './activities';
import { isoWeekday, weekStartOf, type IsoDay } from './weekStart';

const WEEK_MS = 7 * 24 * 3600 * 1000;

export type Momentum = 'rising' | 'steady' | 'fading';

export interface TrendWeek {
  /** Local start of the week (per the user's week-start day). */
  start: number;
  conditioningMin: number;
  recoveryMin: number;
}

export interface TypeTrend {
  type: string;
  count: number;
  minutes: number;
  /** Median session length in minutes. */
  medianMin: number;
  /** The weekday it is usually done on — only when a clear majority of ≥3 sessions. */
  usualDay: IsoDay | null;
  /** Minutes per week, oldest → newest, same length as `ActivityTrends.weeks`. */
  weeks: number[];
  momentum: Momentum;
  /** Newest first, at most 3. */
  recent: Activity[];
}

export interface ActivityTrends {
  weeks: TrendWeek[];
  sessions: number;
  totalMin: number;
  totalKcal: number;
  /** Active minutes, last 4 weeks vs the 4 before; null when there is no earlier period. */
  deltaPct: number | null;
  /** Most frequent first (count, then minutes). */
  top: TypeTrend[];
}

export const TREND_WEEKS = 8;
/** Below this many finished sessions in the window the block stays hidden. */
export const MIN_TREND_SESSIONS = 2;

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Rising / steady / fading from the last half of the window vs the first half. */
export function momentumOf(weeks: number[]): Momentum {
  const half = Math.floor(weeks.length / 2);
  const prior = weeks.slice(0, half).reduce((a, b) => a + b, 0);
  const last = weeks.slice(half).reduce((a, b) => a + b, 0);
  if (prior === 0) return last > 0 ? 'rising' : 'steady';
  const r = last / prior;
  if (r >= 1.25) return 'rising';
  if (r <= 0.6) return 'fading';
  return 'steady';
}

export function activityTrends(
  activities: Activity[] | null | undefined,
  now: number,
  bodyKg: number | null | undefined,
  weeksN: number = TREND_WEEKS,
  startDay?: IsoDay,
): ActivityTrends | null {
  const thisWeek = weekStartOf(now, startDay);
  const first = thisWeek - (weeksN - 1) * WEEK_MS;
  const weeks: TrendWeek[] = Array.from({ length: weeksN }, (_, i) => ({
    start: first + i * WEEK_MS,
    conditioningMin: 0,
    recoveryMin: 0,
  }));
  const byType = new Map<string, Activity[]>();
  let sessions = 0;
  let totalMin = 0;
  let totalKcal = 0;
  const idxOf = (ts: number) => Math.round((weekStartOf(ts, startDay) - first) / WEEK_MS);

  for (const a of activities ?? []) {
    if (a.finishedAt === null || a.startedAt > now) continue;
    const i = idxOf(a.startedAt);
    if (i < 0 || i >= weeksN) continue;
    const min = durationMin(a);
    if (min <= 0) continue;
    sessions++;
    totalMin += min;
    totalKcal += activityCalories(a, bodyKg) ?? 0;
    if (activityCategory(a) === 'recovery') weeks[i]!.recoveryMin += min;
    else weeks[i]!.conditioningMin += min;
    const list = byType.get(a.type);
    if (list) list.push(a);
    else byType.set(a.type, [a]);
  }
  if (sessions < MIN_TREND_SESSIONS) return null;

  const sum = (from: number, to: number) =>
    weeks.slice(from, to).reduce((s, w) => s + w.conditioningMin + w.recoveryMin, 0);
  const half = Math.floor(weeksN / 2);
  const prior = sum(0, half);
  const deltaPct = prior > 0 ? Math.round(((sum(half, weeksN) - prior) / prior) * 100) : null;

  const top: TypeTrend[] = [...byType.entries()].map(([type, list]) => {
    const series = new Array<number>(weeksN).fill(0);
    const days = new Map<IsoDay, number>();
    for (const a of list) {
      series[idxOf(a.startedAt)]! += durationMin(a);
      const d = isoWeekday(a.startedAt);
      days.set(d, (days.get(d) ?? 0) + 1);
    }
    let usualDay: IsoDay | null = null;
    if (list.length >= 3) {
      const [d, n] = [...days.entries()].sort((a, b) => b[1] - a[1])[0]!;
      if (n / list.length >= 0.5) usualDay = d;
    }
    return {
      type,
      count: list.length,
      minutes: Math.round(series.reduce((s, v) => s + v, 0)),
      medianMin: Math.round(median(list.map(durationMin))),
      usualDay,
      weeks: series.map((v) => Math.round(v)),
      momentum: momentumOf(series),
      recent: [...list].sort((a, b) => b.startedAt - a.startedAt).slice(0, 3),
    };
  });
  top.sort((a, b) => b.count - a.count || b.minutes - a.minutes);

  return {
    weeks,
    sessions,
    totalMin: Math.round(totalMin),
    totalKcal: Math.round(totalKcal),
    deltaPct,
    top,
  };
}
