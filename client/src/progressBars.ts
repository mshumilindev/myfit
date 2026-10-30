import type { BarChartBar, BarTone } from './components/ui/BarChart';
import { fmtDayMonth, fmtMonthYear, fmtTonnes } from './i18n';
import type { LocaleId } from './i18n';
import type { Workout } from './types';
import { workoutVolumeKg } from './store';

const DAY_MS = 24 * 3600 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** One bar of the volume chart: the span it covers (`a` inclusive … `b` exclusive) and its volume in kg. */
export interface VolumeBucket {
  a: number;
  b: number;
  monthly: boolean;
  kg: number;
}

/** Noon keeps `ts ± 1 h` (a DST change inside the span) on the intended calendar day. */
const HALF_DAY_MS = DAY_MS / 2;

/**
 * Training-week starts, oldest first, current one last. Stepping a fixed
 * 7×24 h drifts by an hour across a clock change and then no workout matches
 * its week, so every step snaps back to the real week start.
 */
export function lastWeekStarts(
  thisWeek: number,
  n: number,
  weekStart: (ts: number) => number,
): number[] {
  const out = [thisWeek];
  while (out.length < n) out.unshift(weekStart(out[0] - WEEK_MS + HALF_DAY_MS));
  return out;
}

/** The default "This week" chart: one bucket per week start, volumes alongside. */
export function weekBuckets(
  starts: number[],
  kg: number[],
  weekStart: (ts: number) => number,
): VolumeBucket[] {
  return starts.map((a, i) => ({
    a,
    b: i + 1 < starts.length ? starts[i + 1] : weekStart(a + WEEK_MS + HALF_DAY_MS),
    monthly: false,
    kg: kg[i],
  }));
}

/** Volume per bucket across a period: weeks up to ~3 months, months beyond. */
export function periodBuckets(
  finished: Workout[],
  win: { start: number; end: number },
  weekStart: (ts: number) => number,
): VolumeBucket[] {
  const monthly = win.end - win.start > 100 * DAY_MS;
  const spans: { a: number; b: number }[] = [];
  if (monthly) {
    const d = new Date(win.start);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    while (d.getTime() < win.end) {
      const a = d.getTime();
      d.setMonth(d.getMonth() + 1);
      spans.push({ a, b: d.getTime() });
    }
  } else {
    for (let a = weekStart(win.start); a < win.end; a = weekStart(a + WEEK_MS + HALF_DAY_MS))
      spans.push({ a, b: weekStart(a + WEEK_MS + HALF_DAY_MS) });
  }
  return spans.map(({ a, b }) => {
    const from = Math.max(a, win.start);
    const to = Math.min(b, win.end);
    return {
      a: from,
      b: to,
      monthly,
      kg: finished
        .filter((w) => w.startedAt >= from && w.startedAt < to)
        .reduce((v, w) => v + workoutVolumeKg(w), 0),
    };
  });
}

/** Colour by freshness: newest bar bright, the three before it mid, older ones muted. */
export function periodTones(n: number): BarTone[] {
  return Array.from({ length: n }, (_, i) =>
    i === n - 1 ? 'accent' : i >= n - 4 ? 'accent-700' : 'muted',
  );
}

/** The default 10-week chart keeps its fixed gradient. */
export const WEEK_TONES: BarTone[] = [
  'muted',
  'muted',
  'muted',
  'muted',
  'muted',
  'accent-800',
  'accent-700',
  'accent-700',
  'accent-600',
  'accent',
];

/** "13 Oct – 19 Oct" / "October 2026" and the value ("24.8 t" or the empty-week text). */
export function volumeBars(
  buckets: VolumeBucket[],
  tones: BarTone[],
  noWorkouts: string,
  locale: LocaleId,
): BarChartBar[] {
  return buckets.map((b, i) => ({
    label: b.monthly
      ? fmtMonthYear(b.a, locale)
      : `${fmtDayMonth(b.a, locale)} – ${fmtDayMonth(b.b - 1, locale)}`,
    valueText: b.kg > 0 ? fmtTonnes(b.kg) : noWorkouts,
    value: b.kg,
    tone: tones[i],
  }));
}
