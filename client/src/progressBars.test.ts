import { describe, expect, it } from 'vitest';
import {
  lastWeekStarts,
  periodBuckets,
  periodTones,
  volumeBars,
  weekBuckets,
  WEEK_TONES,
} from './progressBars';
import type { Workout } from './types';

const DAY = 24 * 3600 * 1000;
const WEEK = 7 * DAY;
// Monday 2026-10-05 00:00 local.
const mon = new Date(2026, 9, 5).getTime();
const weekStart = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
};
const wk = (startedAt: number, kg: number) =>
  ({
    startedAt,
    finishedAt: startedAt + 1,
    exercises: [{ name: 'x', sets: [{ weight: kg, reps: 1, done: true }] }],
  }) as unknown as Workout;

describe('progressBars', () => {
  it('weekBuckets: 10 weeks, newest last, contiguous', () => {
    const starts = lastWeekStarts(mon, 10, weekStart);
    const b = weekBuckets(
      starts,
      Array.from({ length: 10 }, (_, i) => i),
      weekStart,
    );
    expect(b).toHaveLength(10);
    expect(b[9].a).toBe(mon);
    expect(b[0].a).toBe(mon - 9 * WEEK);
    expect(b[3].b).toBe(b[4].a);
    expect(b[9].b).toBe(mon + WEEK);
    expect(b.every((x) => !x.monthly)).toBe(true);
  });

  it('lastWeekStarts stays on real week starts across a clock change (Europe, Oct 25 2026)', () => {
    const prev = process.env.TZ;
    process.env.TZ = 'Europe/Warsaw';
    try {
      const thisWeek = weekStart(new Date(2026, 9, 30).getTime());
      const starts = lastWeekStarts(thisWeek, 10, weekStart);
      expect(starts.every((s) => weekStart(s) === s)).toBe(true);
      expect(new Date(starts[0]).getDate()).toBe(24); // Aug 24, local midnight
      expect(starts[9]).toBe(thisWeek);
      const [first] = volumeBars(
        weekBuckets(starts, new Array(10).fill(1), weekStart),
        [],
        '-',
        'en',
      );
      expect(first.label).toBe('Aug 24 – Aug 30');
      const lastBuckets = weekBuckets(starts, new Array(10).fill(1), weekStart);
      const wk = volumeBars(lastBuckets, [], '-', 'en')[5];
      expect(wk.label).toBe('Sep 28 – Oct 4');
    } finally {
      if (prev === undefined) delete process.env.TZ;
      else process.env.TZ = prev;
    }
  });

  it('periodBuckets: weeks up to ~3 months, clipped to the window', () => {
    const win = { start: mon - 2 * DAY, end: mon + 10 * DAY };
    const b = periodBuckets([], win, weekStart);
    expect(b.map((x) => x.monthly)).toEqual([false, false, false]);
    expect(b[0].a).toBe(win.start);
    expect(b[b.length - 1].b).toBe(win.end);
  });

  it('periodBuckets: months past 100 days, volume only from workouts inside', () => {
    const win = { start: new Date(2026, 0, 15).getTime(), end: new Date(2026, 6, 1).getTime() };
    const inside = new Date(2026, 2, 3).getTime();
    const outside = new Date(2026, 0, 2).getTime();
    const b = periodBuckets([wk(inside, 500), wk(outside, 900)], win, weekStart);
    expect(b.every((x) => x.monthly)).toBe(true);
    expect(b).toHaveLength(6);
    expect(b.reduce((s, x) => s + x.kg, 0)).toBe(500);
  });

  it('periodTones: newest accent, three before accent-700, older muted', () => {
    expect(periodTones(6)).toEqual([
      'muted',
      'muted',
      'accent-700',
      'accent-700',
      'accent-700',
      'accent',
    ]);
    expect(periodTones(1)).toEqual(['accent']);
    expect(WEEK_TONES).toHaveLength(10);
  });

  it('volumeBars: period label, tonnes value and the empty-week text', () => {
    const [a, z] = volumeBars(
      [
        {
          a: new Date(2026, 9, 13).getTime(),
          b: new Date(2026, 9, 20).getTime(),
          monthly: false,
          kg: 24800,
        },
        {
          a: new Date(2026, 9, 1).getTime(),
          b: new Date(2026, 10, 1).getTime(),
          monthly: true,
          kg: 0,
        },
      ],
      ['accent', 'muted'],
      'No workouts',
      'en',
    );
    expect(a.label).toBe('Oct 13 – Oct 19');
    expect(a.valueText).toBe('24.8 t');
    expect(a.tone).toBe('accent');
    expect(z.label).toBe('October 2026');
    expect(z.valueText).toBe('No workouts');
  });

  it('labels read in every locale (week range, month, empty week)', () => {
    const a = new Date(2026, 9, 13).getTime();
    const b = new Date(2026, 9, 20).getTime();
    for (const loc of ['en', 'uk', 'pl', 'lt', 'et'] as const) {
      const [w, m] = volumeBars(
        [
          { a, b, monthly: false, kg: 1500 },
          { a, b, monthly: true, kg: 0 },
        ],
        [],
        'x',
        loc,
      );
      expect(w.label).toMatch(/13.*19/);
      expect(w.label).toContain(' – ');
      expect(m.label).toContain('2026');
      expect(w.valueText).toBe('1.5 t');
    }
  });
});
