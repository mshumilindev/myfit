/**
 * The user's own baselines for the "Without nicotine" card, measured from their data:
 *  - recovery gap: the median hours between sessions of the same day type (this one included);
 *  - sleep: the average night over the last two weeks.
 * Pure. A baseline is null when there is too little data to call it "yours".
 */
import { sleepStats } from '../../sleep';
import { workoutDayType } from '../../sessionProfile';
import {
  summaryHints,
  type NicotineBaselines,
  type NicotineSummaryHints,
  type Range,
} from '../../nicotine';
import type { NicotineState, SleepNight, Workout } from '../../types';

const HOUR = 3600 * 1000;
/** Gaps longer than this are a break, not a recovery rhythm. */
const MAX_GAP_H = 14 * 24;
/** Newest gaps used. */
const MAX_GAPS = 8;
/** Gaps needed before the median is called the user's own. */
const MIN_GAPS = 2;
/** Nights needed before the average is called the user's own. */
const MIN_NIGHTS = 3;

export type SummaryBaselines = NicotineBaselines;

function median(xs: number[]): number {
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** Median hours between consecutive sessions of this workout's day type, or null. */
export function recoveryGapHours(workout: Workout, finished: readonly Workout[]): number | null {
  const type = workoutDayType(workout);
  if (!type) return null;
  const same = finished
    .filter((w) => w.id !== workout.id && w.finishedAt !== null && workoutDayType(w) === type)
    .map((w) => w.startedAt);
  const starts = [...same, workout.startedAt].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const h = (starts[i] - starts[i - 1]) / HOUR;
    if (h > 0 && h <= MAX_GAP_H) gaps.push(h);
  }
  const recent = gaps.slice(-MAX_GAPS);
  return recent.length >= MIN_GAPS ? Math.round(median(recent) * 10) / 10 : null;
}

export function summaryBaselines(
  workout: Workout,
  finished: readonly Workout[],
  sleeps: readonly SleepNight[],
  now: number,
): SummaryBaselines {
  const sl = sleepStats([...sleeps], now, 480, 14);
  return {
    recoveryGapHours: recoveryGapHours(workout, finished),
    avgSleepMin: sl.nights >= MIN_NIGHTS && sl.avgMin > 0 ? sl.avgMin : null,
  };
}

// --- The card's numbers ----------------------------------------------------------------------

export interface NicotineCardModel {
  hints: NicotineSummaryHints;
  /** Recovery gap shorter, in whole percent. */
  recoveryPct: Range | null;
  /** Minutes of sleep recovery better (whole minutes). */
  sleepMin: Range | null;
}

const pctRange = (r: Range, base: number): Range => ({
  low: Math.round((r.low / base) * 100),
  high: Math.round((r.high / base) * 100),
});

/**
 * The "none" scenario of `summaryHints`, shaped for the two lines of the card (recovery, sleep; both weak evidence). A line
 * whose strong end rounds to nothing (< 1 %, < 1 min) is dropped; null when no line is left
 * or `summaryHints` itself says there is nothing to show (switches off, no products).
 * The "less" scenario is intentionally not shown (board 4B is not approved).
 */
export function nicotineCardModel(
  nic: Pick<NicotineState, 'products' | 'settings'>,
  b: SummaryBaselines,
): NicotineCardModel | null {
  const hints = summaryHints(nic, b);
  if (!hints) return null;
  const h = hints.none;
  const gap = hints.baselines.recoveryGapHours;
  let recoveryPct =
    h.recoveryGapShorterHours && gap ? pctRange(h.recoveryGapShorterHours, gap) : null;
  if (recoveryPct && recoveryPct.high < 1) recoveryPct = null;
  let sleepMin = h.sleepNeedLessMin;
  if (sleepMin && sleepMin.high < 1) sleepMin = null;
  if (!recoveryPct && !sleepMin) return null;
  return { hints, recoveryPct, sleepMin };
}

/** "5–8", or just "8" when both ends round to the same. */
export function fmtRangeText(r: Range, digits = 0): string {
  const f = (n: number) =>
    String(digits ? Math.round(n * 10 ** digits) / 10 ** digits : Math.round(n));
  return f(r.low) === f(r.high) ? f(r.high) : `${f(r.low)}–${f(r.high)}`;
}
