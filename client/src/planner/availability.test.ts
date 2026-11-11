import { describe, expect, it } from 'vitest';
import {
  copyDay,
  dayRanges,
  timeText,
  dropHourEra,
  normalizeRanges,
  overrides,
  rangesText,
  setDay,
  weekSummary,
} from './availability';
import type { RestPeriod } from '../types';

describe('normalizeRanges', () => {
  it('sorts, clamps, drops empty or inverted and merges touching ranges', () => {
    expect(
      normalizeRanges([
        [1080, 1260],
        [360, 480],
        [480, 540],
        [-3, 120],
        [1800, 2400],
        [600, 600],
        [720, 660],
      ]),
    ).toEqual([
      [0, 120],
      [360, 540],
      [1080, 1260],
    ]);
  });
  it('merges overlaps', () => {
    expect(
      normalizeRanges([
        [360, 720],
        [600, 840],
      ]),
    ).toEqual([[360, 840]]);
  });
});

describe('day edits', () => {
  it('setDay stores normalized hours and removes an emptied day', () => {
    const h = setDay({}, 0, [
      [1080, 1260],
      [360, 480],
    ]);
    expect(h[0]).toEqual([
      [360, 480],
      [1080, 1260],
    ]);
    expect(setDay(h, 0, [])).toEqual({});
  });
  it('does not change the week it was given', () => {
    const h = { 0: [[360, 480]] as [number, number][] };
    setDay(h, 1, [[540, 600]]);
    expect(h).toEqual({ 0: [[360, 480]] });
  });
  it('copyDay puts one day on the others and leaves the source alone', () => {
    const h = copyDay({ 0: [[1080, 1260]] }, 0, [0, 1, 2]);
    expect(h).toEqual({ 0: [[1080, 1260]], 1: [[1080, 1260]], 2: [[1080, 1260]] });
  });
  it('copying an empty day clears the targets', () => {
    expect(copyDay({ 1: [[1080, 1260]] }, 0, [1])).toEqual({});
  });
  it('dayRanges of a missing day is empty', () => {
    expect(dayRanges({}, 3)).toEqual([]);
  });
});

describe('text', () => {
  it('formats hours and ranges', () => {
    expect(timeText(360)).toBe('06:00');
    expect(timeText(1125)).toBe('18:45');
    expect(timeText(1440)).toBe('24:00');
    expect(
      rangesText([
        [360, 480],
        [1080, 1260],
      ]),
    ).toBe('06:00–08:00 · 18:00–21:00');
  });
});

describe('weekSummary', () => {
  const wk = {
    0: [[1080, 1260]],
    1: [[1080, 1260]],
    2: [[1080, 1260]],
    3: [[1080, 1260]],
    4: [[1080, 1260]],
  } as Record<number, [number, number][]>;
  it('Mon-Fri with the same hours', () => {
    expect(weekSummary(wk)).toEqual({ kind: 'weekdays', text: '18:00–21:00' });
  });
  it('every day with the same hours', () => {
    expect(weekSummary({ ...wk, 5: [[1080, 1260]], 6: [[1080, 1260]] })).toEqual({
      kind: 'every',
      text: '18:00–21:00',
    });
  });
  it('different hours: only the count', () => {
    expect(weekSummary({ ...wk, 5: [[540, 780]] })).toEqual({ kind: 'days', count: 6 });
  });
  it('nothing set', () => {
    expect(weekSummary({})).toEqual({ kind: 'none' });
  });
});

describe('overrides', () => {
  const p = (over: Partial<RestPeriod>): RestPeriod => ({
    id: 'a',
    startDay: 100,
    endDay: 102,
    mode: 'illness',
    createdAt: 0,
    ...over,
  });
  const all = () => true;
  it('lists unwell and full rest that have not ended, soonest first, with active now', () => {
    const list = overrides(
      [p({ id: 'r', mode: 'off', startDay: 104, endDay: 105 }), p({ id: 'u' })],
      101,
      all,
    );
    expect(list.map((o) => [o.id, o.kind, o.active])).toEqual([
      ['u', 'unwell', true],
      ['r', 'rest', false],
    ]);
  });
  it('skips ended periods and active rest, and a mode whose module is off', () => {
    expect(overrides([p({ endDay: 99 })], 101, all)).toEqual([]);
    expect(overrides([p({ mode: 'active' })], 101, all)).toEqual([]);
    expect(overrides([p({})], 101, (m) => m !== 'illness')).toEqual([]);
  });
  it('an open-ended illness has no end and stays', () => {
    const [o] = overrides([p({ open: true, endDay: 90 })], 101, all);
    expect(o.endDay).toBeNull();
    expect(o.active).toBe(true);
  });
});

describe('dropHourEra', () => {
  it('reads a week saved in whole hours as empty, and keeps minutes', () => {
    expect(dropHourEra({ 0: [[9, 10]], 1: [[9, 10]] })).toEqual({});
    const real = { 0: [[540, 600]] as [number, number][] };
    expect(dropHourEra(real)).toBe(real);
    expect(dropHourEra({})).toEqual({});
  });
});
