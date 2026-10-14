import { afterEach, describe, expect, it } from 'vitest';
import { setCoachTimeZone } from '../format';
import {
  availableSpans,
  checkHours,
  defaultGym,
  defaultSettings,
  gymSpansByDay,
  gymSummary,
  is24x7,
  sanitizeSettings,
  shadedBands,
  visibleRange,
  type CalendarSettings,
  type GymWeek,
  type GymWeeks,
} from './hours';
import { dayOfTs, minOfTs, tsOf } from './time';

const H = (h: number, m = 0) => h * 60 + m;
const week = (r: [number, number][][]): GymWeek => r;
const same = (ranges: [number, number][]): GymWeek => Array.from({ length: 7 }, () => ranges);
const ALL_DAY = same([[0, 1440]]);
const none: GymWeeks = new Map();
const settings = (p: Partial<CalendarSettings> = {}): CalendarSettings => ({
  ...defaultSettings(),
  ...p,
});
const MON_FRI = [0, 1, 2, 3, 4];

afterEach(() => setCoachTimeZone('UTC'));

describe('defaults and sanitising', () => {
  it('Mon-Fri 07-21, weekend off, Auto, no gyms', () => {
    const d = defaultSettings();
    expect(d.working.map((x) => (x ? [x.start, x.end] : null))).toEqual([
      [420, 1260],
      [420, 1260],
      [420, 1260],
      [420, 1260],
      [420, 1260],
      null,
      null,
    ]);
    expect(d.range).toBe('auto');
    expect(d.gymIds).toEqual([]);
  });
  it('repairs damaged input without throwing', () => {
    expect(sanitizeSettings(null)).toEqual(defaultSettings());
    expect(sanitizeSettings('x')).toEqual(defaultSettings());
    const s = sanitizeSettings({
      working: [{ start: 600, end: 700 }, { start: 900, end: 800 }, null, 'x'],
      gymIds: ['a', 'a', 5, 'b'],
      range: 'nope',
    });
    expect(s.working[0]).toEqual({ start: 600, end: 700 });
    expect(s.working[1]).toEqual({ start: 420, end: 1260 }); // end before start -> default
    expect(s.working[2]).toBeNull();
    expect(s.working[3]).toEqual({ start: 420, end: 1260 });
    expect(s.gymIds).toEqual(['a', 'b']);
    expect(s.range).toBe('auto');
  });
  it('a working day needs at least an hour', () => {
    expect(sanitizeSettings({ working: [{ start: 600, end: 630 }] }).working[0]).toEqual({
      start: 420,
      end: 1260,
    });
  });
});

describe('gym hours', () => {
  it('splits a range that runs past midnight into the next day', () => {
    const w = week([[[H(22), H(2)]], [], [], [], [], [], []]);
    const d = gymSpansByDay(w);
    expect(d[0]).toEqual([[H(22), 1440]]);
    expect(d[1]).toEqual([[0, H(2)]]);
  });
  it('Sunday night spills into Monday', () => {
    const w = week([[], [], [], [], [], [], [[H(20), H(3)]]]);
    expect(gymSpansByDay(w)[0]).toEqual([[0, H(3)]]);
  });
  it('close = open is a full day only as [0, 1440]', () => {
    expect(is24x7(ALL_DAY)).toBe(true);
    expect(is24x7(same([[H(6), H(23)]]))).toBe(false);
    expect(is24x7(null)).toBe(false);
  });
  it('summary of a day', () => {
    expect(gymSummary(same([[H(6), H(23)]]), 2)).toBe('06:00–23:00');
    expect(gymSummary(ALL_DAY, 2)).toBe('00:00–24:00');
    expect(gymSummary(week([[], [], [], [], [], [], []]), 2)).toBeNull();
    expect(gymSummary(null, 0)).toBeNull();
  });
});

describe('visible range', () => {
  it('default: the working hours of the week, 07:00 to 21:00', () => {
    expect(visibleRange(defaultSettings(), none, [0, 1, 2, 3, 4, 5, 6])).toEqual({
      from: 420,
      to: 1260,
    });
  });
  it('only days off: falls back to 07-21', () => {
    expect(visibleRange(settings({ working: Array(7).fill(null) }), none, [5, 6])).toEqual({
      from: 420,
      to: 1260,
    });
  });
  it('a 24/7 gym in Auto opens the whole day', () => {
    const g: GymWeeks = new Map([['night', ALL_DAY]]);
    expect(visibleRange(settings({ gymIds: ['night'] }), g, MON_FRI)).toEqual({
      from: 0,
      to: 1440,
    });
  });
  it('Auto is the union of the working hours and the chosen gyms (rounded out to whole hours)', () => {
    const g: GymWeeks = new Map([['a', same([[H(6, 30), H(22, 15)]])]]);
    expect(visibleRange(settings({ gymIds: ['a'] }), g, MON_FRI)).toEqual({
      from: H(6),
      to: H(23),
    });
  });
  it('a gym that is not chosen does not count', () => {
    const g: GymWeeks = new Map([['a', ALL_DAY]]);
    expect(visibleRange(settings({ gymIds: [] }), g, MON_FRI)).toEqual({ from: 420, to: 1260 });
  });
  it('Working hours mode ignores the gyms', () => {
    const g: GymWeeks = new Map([['a', ALL_DAY]]);
    expect(visibleRange(settings({ gymIds: ['a'], range: 'working' }), g, MON_FRI)).toEqual({
      from: 420,
      to: 1260,
    });
  });
  it('24h mode is the whole day whatever the hours', () => {
    expect(visibleRange(settings({ range: '24h' }), none, MON_FRI)).toEqual({ from: 0, to: 1440 });
  });
  it('grows to hold a session outside the hours (never hides it), in every mode but 24h', () => {
    const s = [
      { start: H(5, 30), end: H(6, 15) },
      { start: H(22), end: H(23, 30) },
    ];
    expect(visibleRange(defaultSettings(), none, MON_FRI, s)).toEqual({ from: H(5), to: H(24) });
    expect(visibleRange(settings({ range: 'working' }), none, MON_FRI, s)).toEqual({
      from: H(5),
      to: H(24),
    });
  });
  it('a session that ends at midnight (end = 1440) keeps the grid to 24:00', () => {
    expect(visibleRange(defaultSettings(), none, MON_FRI, [{ start: H(23), end: 1440 }])).toEqual({
      from: 420,
      to: 1440,
    });
  });
  it('overnight gym: the spill-over hours open the next day', () => {
    const g: GymWeeks = new Map([['club', week([[], [], [], [], [[H(22), H(3)]], [], []])]]);
    const s = settings({ gymIds: ['club'], working: Array(7).fill(null) });
    expect(visibleRange(s, g, [4])).toEqual({ from: H(22), to: 1440 }); // Friday evening
    expect(visibleRange(s, g, [5])).toEqual({ from: 0, to: H(3) }); // Saturday small hours
    expect(visibleRange(s, g, [4, 5])).toEqual({ from: 0, to: 1440 });
  });
  it('always at least one hour', () => {
    expect(
      visibleRange(
        settings({ working: [{ start: 600, end: 660 }, ...Array(6).fill(null)] }),
        none,
        [0],
      ),
    ).toEqual({ from: 600, to: 660 });
  });
});

describe('shading', () => {
  it('shades before and after the working hours, nothing inside', () => {
    expect(shadedBands(defaultSettings(), none, 0, H(6), H(22))).toEqual([
      [H(6), H(7)],
      [H(21), H(22)],
    ]);
  });
  it('a day off is shaded whole', () => {
    expect(shadedBands(defaultSettings(), none, 6, H(7), H(21))).toEqual([[H(7), H(21)]]);
  });
  it('Auto: gym hours un-shade, 24/7 leaves nothing shaded', () => {
    const g: GymWeeks = new Map([['night', ALL_DAY]]);
    expect(shadedBands(settings({ gymIds: ['night'] }), g, 6, 0, 1440)).toEqual([]);
    const a: GymWeeks = new Map([['a', same([[H(6), H(8)]])]]);
    expect(shadedBands(settings({ gymIds: ['a'] }), a, 0, H(5), H(9))).toEqual([[H(5), H(6)]]);
  });
  it('a lunch break (two spans) shades the gap', () => {
    const g: GymWeeks = new Map([
      [
        'a',
        same([
          [H(7), H(12)],
          [H(14), H(21)],
        ]),
      ],
    ]);
    const s = settings({ gymIds: ['a'], working: Array(7).fill(null) });
    expect(shadedBands(s, g, 2, H(7), H(21))).toEqual([[H(12), H(14)]]);
  });
});

describe('available spans and checks', () => {
  it('union merges overlapping and touching spans', () => {
    const g: GymWeeks = new Map([['a', same([[H(20), H(23)]])]]);
    expect(availableSpans(settings({ gymIds: ['a'] }), g, 1)).toEqual([[H(7), H(23)]]);
  });
  it('flags a session outside the working hours and outside the gym', () => {
    const g: GymWeeks = new Map([['a', same([[H(8), H(20)]])]]);
    const s = settings({ gymIds: ['a'] });
    expect(checkHours(s, g, 1, H(18), H(19), 'a')).toEqual({
      outsideWorking: false,
      outsideGym: false,
    });
    expect(checkHours(s, g, 1, H(20), H(21), 'a')).toEqual({
      outsideWorking: false,
      outsideGym: true,
    });
    expect(checkHours(s, g, 1, H(21), H(22), 'a')).toEqual({
      outsideWorking: true,
      outsideGym: true,
    });
    expect(checkHours(s, g, 6, H(10), H(11), 'a').outsideWorking).toBe(true); // Sunday off
    expect(checkHours(s, g, 1, H(21), H(22), 'unknown').outsideGym).toBe(false); // no hours known: no warning
  });
  it('a 24/7 gym is never "outside"', () => {
    const g: GymWeeks = new Map([['a', ALL_DAY]]);
    expect(checkHours(settings(), g, 5, 0, 60, 'a').outsideGym).toBe(false);
  });
  it('default gym = first chosen gym that exists', () => {
    expect(defaultGym(settings({ gymIds: ['x', 'b', 'c'] }), ['c', 'b'])).toBe('b');
    expect(defaultGym(settings(), ['b'])).toBeNull();
  });
});

describe('time zones and DST (wall-clock minutes of the trainer zone)', () => {
  it('a session on the spring-forward day is placed by its wall time and fits the range', () => {
    setCoachTimeZone('Europe/Kyiv'); // 2026-03-29: 03:00 -> 04:00
    const day = dayOfTs(Date.UTC(2026, 2, 29, 12));
    const start = tsOf(day, H(3, 30)); // nonexistent wall time: shifts forward
    expect(minOfTs(start)).toBe(H(4, 30));
    const end = start + 60 * 60_000;
    const r = visibleRange(
      defaultSettings(),
      none,
      [6],
      [{ start: minOfTs(start), end: minOfTs(end) }],
    );
    expect(r).toEqual({ from: H(4), to: H(21) });
  });
  it('the autumn repeat hour keeps its wall minutes, so the range is the same as any day', () => {
    setCoachTimeZone('Europe/Kyiv'); // 2026-10-25: 04:00 -> 03:00
    const day = dayOfTs(Date.UTC(2026, 9, 25, 12));
    const start = tsOf(day, H(3, 30));
    expect(minOfTs(start)).toBe(H(3, 30));
    expect(
      visibleRange(defaultSettings(), none, [6], [{ start: H(3, 30), end: H(4, 30) }]),
    ).toEqual({ from: H(3), to: H(21) });
  });
  it('the same gym week reads the same in two zones (hours are wall minutes, not instants)', () => {
    const g: GymWeeks = new Map([['a', same([[H(6), H(23)]])]]);
    const s = settings({ gymIds: ['a'] });
    setCoachTimeZone('Europe/Kyiv');
    const kyiv = visibleRange(s, g, MON_FRI);
    setCoachTimeZone('America/Los_Angeles');
    expect(visibleRange(s, g, MON_FRI)).toEqual(kyiv);
  });
});
