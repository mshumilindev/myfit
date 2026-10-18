import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  programOutlook,
  weekDayStatuses,
  type DayStatus,
  type OutlookInput,
} from './programDays';

const START = Date.UTC(2026, 0, 5); // Monday 2026-01-05 00:00 UTC
const at = (dayOffset: number, hours = 0) => START + dayOffset * DAY_MS + hours * 3_600_000;

function input(over: Partial<OutlookInput> = {}): OutlookInput {
  return {
    startedAt: START,
    weeks: 4,
    daysPerWeek: 3,
    itemCountByDay: { 1: 3, 3: 2, 5: 4 },
    workoutDates: [],
    now: at(0, 8),
    ...over,
  };
}

const statuses = (i: OutlookInput, week: number): DayStatus[] =>
  weekDayStatuses(i, week).map((c) => c.status);

describe('weekDayStatuses', () => {
  it('returns seven cells, days 1..7, dated one day apart from the start', () => {
    const cells = weekDayStatuses(input(), 1);
    expect(cells.map((c) => c.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(cells[0].date).toBe(START);
    expect(cells[6].date).toBe(START + 6 * DAY_MS);
  });

  it('offsets later weeks by seven days per week', () => {
    const cells = weekDayStatuses(input(), 3);
    expect(cells[0].date).toBe(START + 14 * DAY_MS);
    expect(cells[4].date).toBe(START + 18 * DAY_MS);
  });

  it('marks days without items as rest, even when a workout was logged that day', () => {
    const i = input({ workoutDates: [at(1, 10)], now: at(3) });
    expect(statuses(i, 1)).toEqual([
      'missed',
      'rest',
      'missed',
      'rest',
      'upcoming',
      'rest',
      'rest',
    ]);
  });

  it('treats a zero item count the same as no entry', () => {
    const i = input({ itemCountByDay: { 1: 0, 2: 1 } });
    expect(statuses(i, 1)[0]).toBe('rest');
    expect(statuses(i, 1)[1]).not.toBe('rest');
  });

  it('is upcoming today and in the future, missed only once the day is past', () => {
    const i = input({ now: at(2, 23) }); // late on day 3
    expect(statuses(i, 1)).toEqual([
      'missed',
      'rest',
      'upcoming',
      'rest',
      'upcoming',
      'rest',
      'rest',
    ]);
  });

  it('flips from upcoming to missed exactly at the UTC day boundary', () => {
    const justBefore = input({ now: at(1) - 1 });
    const atBoundary = input({ now: at(1) });
    expect(statuses(justBefore, 1)[0]).toBe('upcoming');
    expect(statuses(atBoundary, 1)[0]).toBe('missed');
  });

  it('marks a day logged when any workout falls on its calendar day, at any hour', () => {
    const early = input({ workoutDates: [at(0, 0)], now: at(6) });
    const late = input({ workoutDates: [at(0, 23.9)], now: at(6) });
    expect(statuses(early, 1)[0]).toBe('logged');
    expect(statuses(late, 1)[0]).toBe('logged');
    // one millisecond into the next day does not count for day 1
    const next = input({ workoutDates: [at(1)], now: at(6) });
    expect(statuses(next, 1)[0]).toBe('missed');
  });

  it('a logged future-dated day is still logged (not upcoming)', () => {
    expect(statuses(input({ workoutDates: [at(4, 12)], now: at(0) }), 1)[4]).toBe('logged');
  });
});

describe('programOutlook', () => {
  it('starts in week 1, not finished, nothing missed', () => {
    expect(programOutlook(input())).toEqual({
      currentWeek: 1,
      finished: false,
      weekComplete: false,
      missedCount: 0,
    });
  });

  it('advances the week every seven elapsed days', () => {
    expect(programOutlook(input({ now: at(6, 23) })).currentWeek).toBe(1);
    expect(programOutlook(input({ now: at(7) })).currentWeek).toBe(2);
    expect(programOutlook(input({ now: at(20) })).currentWeek).toBe(3);
  });

  it('never reports a week before the start', () => {
    const o = programOutlook(input({ now: at(-5) }));
    expect(o.currentWeek).toBe(1);
    expect(o.missedCount).toBe(0);
    expect(o.finished).toBe(false);
  });

  it('caps the current week at the program length and finishes at the exact end', () => {
    const lastMs = input({ weeks: 2, now: at(14) - 1 });
    expect(programOutlook(lastMs)).toMatchObject({ currentWeek: 2, finished: false });
    const end = input({ weeks: 2, now: at(14) });
    expect(programOutlook(end)).toMatchObject({ currentWeek: 2, finished: true });
    const long = input({ weeks: 2, now: at(100) });
    expect(programOutlook(long)).toMatchObject({ currentWeek: 2, finished: true });
  });

  it('an open-ended program (weeks 0) never finishes and keeps counting weeks', () => {
    const o = programOutlook(input({ weeks: 0, now: at(70) }));
    expect(o.currentWeek).toBe(11);
    expect(o.finished).toBe(false);
  });

  it('counts missed days across all weeks so far', () => {
    // 3 training days/week; now = start of week 3 -> weeks 1 and 2 fully past, week 3 day 1 is today.
    const o = programOutlook(input({ now: at(14, 9) }));
    expect(o.currentWeek).toBe(3);
    expect(o.missedCount).toBe(6);
    // log two of those days: one in each week
    const some = programOutlook(input({ now: at(14, 9), workoutDates: [at(0), at(7 + 2)] }));
    expect(some.missedCount).toBe(4);
  });

  it('does not count days after the capped current week for a finished program', () => {
    const o = programOutlook(input({ weeks: 1, now: at(60) }));
    expect(o.currentWeek).toBe(1);
    expect(o.missedCount).toBe(3);
    expect(o.finished).toBe(true);
  });

  it('weekComplete is true only when every training day of the current week is logged', () => {
    const all = programOutlook(input({ now: at(1), workoutDates: [at(0), at(2), at(4)] }));
    expect(all.weekComplete).toBe(true);
    const one = programOutlook(input({ now: at(1), workoutDates: [at(0), at(2)] }));
    expect(one.weekComplete).toBe(false);
  });

  it('weekComplete is false for a week with no training days', () => {
    const o = programOutlook(input({ itemCountByDay: {}, now: at(3) }));
    expect(o.weekComplete).toBe(false);
    expect(o.missedCount).toBe(0);
  });

  it('only looks at the current week for weekComplete', () => {
    // week 1 fully logged, but now is in week 2 and nothing in week 2 is logged
    const o = programOutlook(input({ now: at(8), workoutDates: [at(0), at(2), at(4)] }));
    expect(o.currentWeek).toBe(2);
    expect(o.weekComplete).toBe(false);
    expect(o.missedCount).toBe(1); // week 2 day 1 (Monday) already passed unlogged
  });
});
