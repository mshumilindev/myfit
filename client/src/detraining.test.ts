import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BREAK_ROWS,
  breakRow,
  calendarDaysBetween,
  gapDays,
  gapWeeks,
  muscleGapDays,
  returnSets,
} from './detraining';
import type { Workout } from './types';

/** A local date at `hour` of the day `daysBack` before the anchor day (local arithmetic, DST-proof). */
const local = (y: number, m: number, d: number, hour = 9, min = 0): number =>
  new Date(y, m, d, hour, min).getTime();

describe('calendarDaysBetween', () => {
  it('counts local calendar days, not 24-hour blocks', () => {
    expect(calendarDaysBetween(local(2026, 5, 10, 9), local(2026, 5, 10, 21))).toBe(0);
    expect(calendarDaysBetween(local(2026, 5, 10, 23, 0), local(2026, 5, 11, 1, 0))).toBe(1);
    expect(calendarDaysBetween(local(2026, 5, 10, 0, 1), local(2026, 5, 11, 23, 59))).toBe(1);
    expect(calendarDaysBetween(local(2026, 5, 1), local(2026, 5, 15))).toBe(14);
  });

  it('never goes negative (a future timestamp from clock skew is 0 days)', () => {
    expect(calendarDaysBetween(local(2026, 5, 12), local(2026, 5, 10))).toBe(0);
  });

  describe('across daylight-saving changes', () => {
    const prev = process.env.TZ;
    beforeAll(() => {
      process.env.TZ = 'Europe/Kyiv';
    });
    afterAll(() => {
      if (prev === undefined) delete process.env.TZ;
      else process.env.TZ = prev;
    });

    it('the zone really has 23- and 25-hour days (the premise of the test)', () => {
      const h = 3_600_000;
      // EU: spring forward on 2026-03-29, fall back on 2026-10-25.
      expect((local(2026, 2, 30, 0, 30) - local(2026, 2, 29, 0, 30)) / h).toBe(23);
      expect((local(2026, 9, 26, 0, 30) - local(2026, 9, 25, 0, 30)) / h).toBe(25);
    });

    it('spring-forward: 23-hour day is still one day, two days still two', () => {
      expect(calendarDaysBetween(local(2026, 2, 29, 12), local(2026, 2, 30, 12))).toBe(1);
      expect(calendarDaysBetween(local(2026, 2, 28, 12), local(2026, 2, 30, 12))).toBe(2);
      // 47 hours apart, two calendar days.
      expect(calendarDaysBetween(local(2026, 2, 28, 12), local(2026, 2, 30, 11))).toBe(2);
      // Evening before to morning after the change: one day.
      expect(calendarDaysBetween(local(2026, 2, 28, 23, 30), local(2026, 2, 29, 5, 0))).toBe(1);
      // 23 hours apart, but next calendar day (a plain floor(ms / 24h) would say 0).
      expect(calendarDaysBetween(local(2026, 2, 29, 0, 30), local(2026, 2, 30, 0, 30))).toBe(1);
    });

    it('fall-back: 25-hour day is still one day', () => {
      expect(calendarDaysBetween(local(2026, 9, 25, 12), local(2026, 9, 26, 12))).toBe(1);
      expect(calendarDaysBetween(local(2026, 9, 24, 12), local(2026, 9, 26, 12))).toBe(2);
      // 49 hours apart.
      expect(calendarDaysBetween(local(2026, 9, 24, 12), local(2026, 9, 26, 13))).toBe(2);
      expect(calendarDaysBetween(local(2026, 9, 25, 0, 30), local(2026, 9, 25, 23, 30))).toBe(0);
      // 25 hours apart is one day; the 24 hours from 00:30 to 23:30 inside the long day are still day 0.
      expect(calendarDaysBetween(local(2026, 9, 25, 0, 30), local(2026, 9, 26, 0, 30))).toBe(1);
    });

    it('a 29-day break that crosses a DST change is exactly 29 days (R2 boundary survives)', () => {
      const to = local(2026, 3, 5, 12); // 2026-04-05
      const from = local(2026, 2, 7, 12); // 29 days earlier, DST change in between
      expect(calendarDaysBetween(from, to)).toBe(29);
      expect(breakRow(calendarDaysBetween(from, to))?.tier).toBe(2);
      expect(breakRow(calendarDaysBetween(local(2026, 2, 8, 12), to))?.tier).toBe(1);
    });
  });
});

describe('breakRow (research table R0..R5)', () => {
  it('is null for no gap, unknown gap and 0..14 days (R0)', () => {
    expect(breakRow(null)).toBeNull();
    expect(breakRow(undefined)).toBeNull();
    expect(breakRow(Number.NaN)).toBeNull();
    expect(breakRow(0)).toBeNull();
    expect(breakRow(14)).toBeNull();
  });

  it.each([
    [15, 1],
    [28, 1],
    [29, 2],
    [84, 2],
    [85, 3],
    [168, 3],
    [169, 4],
    [364, 4],
    [365, 5],
    [2000, 5],
  ])('gap %i days is row R%i', (gap, tier) => {
    expect(breakRow(gap)?.tier).toBe(tier);
  });

  it('rows ascend; the multipliers only get more conservative', () => {
    for (let i = 1; i < BREAK_ROWS.length; i++) {
      expect(BREAK_ROWS[i].fromDays).toBeGreaterThan(BREAK_ROWS[i - 1].fromDays);
      expect(BREAK_ROWS[i].weightMult).toBeLessThanOrEqual(BREAK_ROWS[i - 1].weightMult);
      expect(BREAK_ROWS[i].setsMult).toBeLessThanOrEqual(BREAK_ROWS[i - 1].setsMult);
    }
  });
});

describe('gapDays', () => {
  const now = local(2026, 5, 15, 12);
  it('is null without history', () => {
    expect(gapDays([], now)).toBeNull();
  });
  it('measures from the newest point whatever the order', () => {
    const hist = [{ ts: local(2026, 5, 1) }, { ts: local(2026, 5, 10) }, { ts: local(2026, 4, 1) }];
    expect(gapDays(hist, now)).toBe(5);
  });
  it('same day = 0', () => {
    expect(gapDays([{ ts: local(2026, 5, 15, 7) }], now)).toBe(0);
  });
});

describe('gapWeeks', () => {
  it('rounds down; 15 days is 2 weeks, 365 is 52', () => {
    expect(gapWeeks(15)).toBe(2);
    expect(gapWeeks(28)).toBe(4);
    expect(gapWeeks(29)).toBe(4);
    expect(gapWeeks(365)).toBe(52);
  });
});

describe('returnSets', () => {
  it('leaves R0/R1 and unknown gaps alone', () => {
    for (const g of [null, undefined, 0, 14, 15, 28]) expect(returnSets(6, g)).toBe(6);
  });
  it('R2/R3 x0.67 and R4/R5 x0.5, never below 2 and never above the input', () => {
    expect(returnSets(6, 29)).toBe(4);
    expect(returnSets(6, 84)).toBe(4);
    expect(returnSets(6, 85)).toBe(4);
    expect(returnSets(6, 168)).toBe(4);
    expect(returnSets(6, 169)).toBe(3);
    expect(returnSets(6, 364)).toBe(3);
    expect(returnSets(6, 365)).toBe(3);
    expect(returnSets(3, 365)).toBe(2);
    expect(returnSets(2, 365)).toBe(2);
    expect(returnSets(1, 365)).toBe(1);
  });
});

describe('muscleGapDays', () => {
  const now = local(2026, 5, 15, 12);
  const w = (id: string, startedAt: number, name: string, primary: string): Workout =>
    ({
      id,
      startedAt,
      finishedAt: startedAt + 3_600_000,
      exercises: [
        {
          id: `e-${id}`,
          name,
          kind: 'strength',
          position: 0,
          primaryMuscle: primary,
          secondaryMuscles: [],
          sets: [{ id: 's1', reps: 8, weight: 60, isWarmup: false, type: 'working' }],
        },
      ],
    }) as unknown as Workout;

  it('is null for an empty history or a muscle never trained', () => {
    expect(muscleGapDays([], 'quads', now)).toBeNull();
    expect(
      muscleGapDays([w('a', local(2026, 5, 1), 'Bench Press', 'chest')], 'quads', now),
    ).toBeNull();
  });

  it('counts calendar days since the newest session that worked the muscle', () => {
    const fin = [
      w('old', local(2026, 3, 1), 'Back Squat', 'quads'),
      w('mid', local(2026, 4, 20), 'Back Squat', 'quads'),
      w('chest', local(2026, 5, 10), 'Bench Press', 'chest'),
    ];
    expect(muscleGapDays(fin, 'quads', now)).toBe(26);
    expect(muscleGapDays(fin, 'chest', now)).toBe(5);
  });

  it('ignores sessions after `now`', () => {
    const fin = [
      w('past', local(2026, 5, 1), 'Back Squat', 'quads'),
      w('future', local(2026, 5, 20), 'Back Squat', 'quads'),
    ];
    expect(muscleGapDays(fin, 'quads', now)).toBe(14);
  });
});
