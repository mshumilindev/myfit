import { describe, expect, it } from 'vitest';
import {
  dayState,
  dayKeyOf,
  fitsFree,
  freeBands,
  freeOn,
  isUnavailableOn,
  minutesText,
  rangesLabel,
  upcomingUnavailable,
  parseAvailability,
  weekdayOfKey,
  type ClientAvailability,
} from './availability';

// 2026-11-12 is a Thursday
const THU = dayKeyOf(Date.UTC(2026, 10, 12));
const A: ClientAvailability = {
  weekly: {
    0: [[480, 600]],
    3: [
      [1080, 1200],
      [360, 420],
    ].sort((x, y) => x[0] - y[0]) as [number, number][],
  },
  unavailable: [{ fromDay: THU + 2, toDay: THU + 3 }],
};

describe('weekdayOfKey', () => {
  it('Monday = 0 … Sunday = 6, and the epoch Thursday is 3', () => {
    expect(weekdayOfKey(0)).toBe(3);
    expect(weekdayOfKey(THU)).toBe(3);
    expect(weekdayOfKey(THU - 3)).toBe(0);
    expect(weekdayOfKey(THU + 3)).toBe(6);
    expect(weekdayOfKey(-1)).toBe(2);
  });
});

describe('parseAvailability', () => {
  it('keeps clean data, sorts and merges ranges, drops what is malformed', () => {
    const p = parseAvailability({
      weekly: {
        '0': [[600, 700], [480, 620], [5, 5], [900, 800], ['a', 1], [1, 2, 3], null],
        '9': [[0, 60]],
        '2': 'x',
      },
      unavailable: [
        { fromDay: 20000, toDay: 20002 },
        { fromDay: 20010, toDay: null },
        { fromDay: 20020 },
        { fromDay: 20030, toDay: 20029 },
        { fromDay: -1, toDay: 3 },
        'bad',
      ],
    });
    expect(p).toEqual({
      weekly: { 0: [[480, 700]] },
      unavailable: [
        { fromDay: 20000, toDay: 20002 },
        { fromDay: 20010, toDay: null },
        { fromDay: 20020, toDay: null },
      ],
    });
  });
  it('is null when nothing was shared or the shape is wrong', () => {
    for (const v of [null, undefined, 5, 'x', {}, { weekly: 3 }])
      expect(parseAvailability(v)).toBeNull();
  });
  it('minutes beyond a day are rejected, a full day 0-1440 is kept', () => {
    expect(parseAvailability({ weekly: { 1: [[0, 1441]] }, unavailable: [] })).toEqual({
      weekly: {},
      unavailable: [],
    });
    expect(parseAvailability({ weekly: { 1: [[0, 1440]] }, unavailable: [] })?.weekly[1]).toEqual([
      [0, 1440],
    ]);
  });
  it('unavailable that is not a list is empty', () => {
    expect(parseAvailability({ weekly: {}, unavailable: 'x' })).toEqual({
      weekly: {},
      unavailable: [],
    });
  });
});

describe('free hours and not-available days', () => {
  it('a normal day returns its weekday hours', () => {
    expect(freeOn(A, THU - 3)).toEqual([[480, 600]]);
    expect(freeOn(A, THU)).toHaveLength(2);
  });
  it('a not-available day has no free hours, and the span is inclusive at both ends', () => {
    expect(isUnavailableOn(A, THU + 1)).toBe(false);
    expect(isUnavailableOn(A, THU + 2)).toBe(true);
    expect(isUnavailableOn(A, THU + 3)).toBe(true);
    expect(isUnavailableOn(A, THU + 4)).toBe(false);
    expect(freeOn(A, THU + 3)).toEqual([]);
  });
  it('an open-ended span never ends, but does not reach back before it began', () => {
    const open: ClientAvailability = { weekly: {}, unavailable: [{ fromDay: THU, toDay: null }] };
    expect(isUnavailableOn(open, THU - 1)).toBe(false);
    expect(isUnavailableOn(open, THU)).toBe(true);
    expect(isUnavailableOn(open, THU + 900)).toBe(true);
  });
  it('fitsFree needs the whole slot inside one free range', () => {
    const mon = THU - 3;
    expect(fitsFree(A, mon, 480, 540)).toBe(true);
    expect(fitsFree(A, mon, 480, 600)).toBe(true);
    expect(fitsFree(A, mon, 470, 540)).toBe(false);
    expect(fitsFree(A, mon, 540, 601)).toBe(false);
    expect(fitsFree(A, mon, 540, 540)).toBe(false);
    expect(fitsFree(A, THU + 2, 480, 540)).toBe(false);
  });
  it('dayState is one word per day', () => {
    expect(dayState(A, THU - 3)).toBe('free');
    expect(dayState(A, THU - 2)).toBe('none');
    expect(dayState(A, THU + 2)).toBe('unavailable');
  });
});

describe('texts', () => {
  it('minutes and ranges read as clock times', () => {
    expect(minutesText(0)).toBe('00:00');
    expect(minutesText(485)).toBe('08:05');
    expect(minutesText(1440)).toBe('24:00');
    expect(
      rangesLabel([
        [360, 480],
        [1080, 1260],
      ]),
    ).toBe('06:00–08:00 · 18:00–21:00');
    expect(rangesLabel([])).toBe('');
  });
  it('only spans that are not over are upcoming, soonest first, without changing the input', () => {
    const a: ClientAvailability = {
      weekly: {},
      unavailable: [
        { fromDay: 30, toDay: null },
        { fromDay: 5, toDay: 8 },
        { fromDay: 10, toDay: 12 },
        { fromDay: 1, toDay: 3 },
      ],
    };
    expect(upcomingUnavailable(a, 9).map((u) => u.fromDay)).toEqual([10, 30]);
    expect(upcomingUnavailable(a, 8).map((u) => u.fromDay)).toEqual([5, 10, 30]);
    expect(a.unavailable[0].fromDay).toBe(30);
  });
});

describe('freeBands', () => {
  it('clips free ranges to the visible hours and drops what is outside', () => {
    const a: ClientAvailability = {
      weekly: {
        3: [
          [360, 480],
          [1080, 1260],
        ],
      },
      unavailable: [],
    };
    expect(freeBands(a, THU, 420, 1200)).toEqual([
      [420, 480],
      [1080, 1200],
    ]);
    expect(freeBands(a, THU, 480, 1080)).toEqual([]);
    expect(freeBands(a, THU, 0, 1440)).toEqual([
      [360, 480],
      [1080, 1260],
    ]);
    expect(freeBands(a, THU - 1, 0, 1440)).toEqual([]);
  });
  it('a not-available day has no bands at all', () => {
    const a: ClientAvailability = {
      weekly: { 3: [[360, 480]] },
      unavailable: [{ fromDay: THU, toDay: THU }],
    };
    expect(freeBands(a, THU, 0, 1440)).toEqual([]);
  });
});
