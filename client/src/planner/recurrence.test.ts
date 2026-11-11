import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  endBefore,
  fireFor,
  nextFire,
  occurrences,
  occurrencesBetween,
  skipDay,
  type PlanTiming,
} from './recurrence';
import { addDays, localParts, weekday, zonedToUtc } from './zoned';

const base: PlanTiming = {
  tz: 'Europe/Warsaw',
  start: '2026-11-12', // Thursday
  time: '18:00',
  lead: 60,
  repeat: { kind: 'none' },
  ends: { kind: 'never' },
  skip: [],
};
const take = (p: PlanTiming, n: number) => {
  const out: string[] = [];
  for (const d of occurrences(p)) {
    out.push(d);
    if (out.length >= n) break;
  }
  return out;
};

describe('days', () => {
  it('weekday is Monday-based', () => {
    expect(weekday('2026-11-12')).toBe(3);
    expect(weekday('2026-11-09')).toBe(0);
    expect(weekday('2026-11-15')).toBe(6);
  });
  it('adds days across months without drift', () => {
    expect(addDays('2026-02-27', 3)).toBe('2026-03-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('repeat rules', () => {
  it('a one-off happens once', () => {
    expect(take(base, 5)).toEqual(['2026-11-12']);
  });
  it('every week on the start day', () => {
    const p = { ...base, repeat: { kind: 'weekly', every: 1, days: [3] } } as PlanTiming;
    expect(take(p, 3)).toEqual(['2026-11-12', '2026-11-19', '2026-11-26']);
  });
  it('every weekday skips the weekend and starts from the start day', () => {
    const p = {
      ...base,
      start: '2026-11-13',
      repeat: { kind: 'weekly', every: 1, days: [0, 1, 2, 3, 4] },
    } as PlanTiming;
    expect(take(p, 4)).toEqual(['2026-11-13', '2026-11-16', '2026-11-17', '2026-11-18']);
  });
  it('every 2 weeks', () => {
    const p = { ...base, repeat: { kind: 'weekly', every: 2, days: [3] } } as PlanTiming;
    expect(take(p, 3)).toEqual(['2026-11-12', '2026-11-26', '2026-12-10']);
  });
  it('every day and every 3 days', () => {
    expect(take({ ...base, repeat: { kind: 'daily', every: 1 } }, 3)).toEqual([
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
    ]);
    expect(take({ ...base, repeat: { kind: 'daily', every: 3 } }, 2)).toEqual([
      '2026-11-12',
      '2026-11-15',
    ]);
  });
  it('every month uses the last day of a short month', () => {
    const p = { ...base, start: '2026-01-31', repeat: { kind: 'monthly', every: 1 } } as PlanTiming;
    expect(take(p, 3)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });
  it('ends on a date (inclusive) or after N plans', () => {
    const w: PlanTiming['repeat'] = { kind: 'weekly', every: 1, days: [3] };
    expect(take({ ...base, repeat: w, ends: { kind: 'on', day: '2026-11-19' } }, 9)).toEqual([
      '2026-11-12',
      '2026-11-19',
    ]);
    expect(take({ ...base, repeat: w, ends: { kind: 'count', count: 3 } }, 9)).toHaveLength(3);
  });
  it('between: a month view window', () => {
    const p = { ...base, repeat: { kind: 'weekly', every: 1, days: [3] } } as PlanTiming;
    expect(occurrencesBetween(p, '2026-12-01', '2026-12-31')).toEqual([
      '2026-12-03',
      '2026-12-10',
      '2026-12-17',
      '2026-12-24',
      '2026-12-31',
    ]);
  });
});

describe('deleting', () => {
  const p = {
    ...base,
    repeat: { kind: 'weekly', every: 1, days: [3] },
    ends: { kind: 'count', count: 3 },
  } as PlanTiming;
  it('only one day keeps the rest, and the removed day still counts to "after N plans"', () => {
    expect(take(skipDay(p, '2026-11-19'), 9)).toEqual(['2026-11-12', '2026-11-26']);
  });
  it('this and following cuts the series; from the first day nothing is left', () => {
    expect(take(endBefore(p, '2026-11-26')!, 9)).toEqual(['2026-11-12', '2026-11-19']);
    expect(endBefore(p, '2026-11-12')).toBeNull();
  });
});

describe('time zones and daylight saving', () => {
  it('Warsaw winter 18:00 is 17:00Z, summer 18:00 is 16:00Z', () => {
    expect(new Date(zonedToUtc('2026-11-12', '18:00', 'Europe/Warsaw')).toISOString()).toBe(
      '2026-11-12T17:00:00.000Z',
    );
    expect(new Date(zonedToUtc('2026-07-12', '18:00', 'Europe/Warsaw')).toISOString()).toBe(
      '2026-07-12T16:00:00.000Z',
    );
  });
  it('a weekly plan keeps its local clock time across the autumn change', () => {
    const p = {
      ...base,
      start: '2026-10-22',
      repeat: { kind: 'weekly', every: 1, days: [3] },
    } as PlanTiming;
    const times = take(p, 3).map((d) => localParts(fireFor(p, d).startAt, p.tz).time);
    expect(times).toEqual(['18:00', '18:00', '18:00']);
  });
  it('a time inside the spring gap moves forward, never to another day', () => {
    const u = zonedToUtc('2026-03-29', '02:30', 'Europe/Warsaw');
    expect(localParts(u, 'Europe/Warsaw')).toEqual({ day: '2026-03-29', time: '03:30' });
  });
  it('a time that happens twice in autumn takes the first', () => {
    const u = zonedToUtc('2026-10-25', '02:30', 'Europe/Warsaw');
    expect(new Date(u).toISOString()).toBe('2026-10-25T00:30:00.000Z');
  });
  it('another zone: Kyiv and New York', () => {
    expect(new Date(zonedToUtc('2026-11-12', '09:00', 'Europe/Kyiv')).toISOString()).toBe(
      '2026-11-12T07:00:00.000Z',
    );
    expect(new Date(zonedToUtc('2026-11-12', '09:00', 'America/New_York')).toISOString()).toBe(
      '2026-11-12T14:00:00.000Z',
    );
  });
});

describe('reminder time', () => {
  it('fires `lead` minutes before the start; default 1 h', () => {
    const f = fireFor(base, '2026-11-12');
    expect(f.startAt - f.fireAt).toBe(60 * 60_000);
  });
  it('a lead of 45 minutes and the 2-day cap', () => {
    expect(
      fireFor({ ...base, lead: 45 }, '2026-11-12').startAt -
        fireFor({ ...base, lead: 45 }, '2026-11-12').fireAt,
    ).toBe(45 * 60_000);
    const f = fireFor({ ...base, lead: 99_999 }, '2026-11-12');
    expect(f.startAt - f.fireAt).toBe(2 * 24 * 60 * 60_000);
  });
  it('next fire is the first one still ahead; a past one-off has none', () => {
    const p = { ...base, repeat: { kind: 'weekly', every: 1, days: [3] } } as PlanTiming;
    const now = zonedToUtc('2026-11-12', '17:30', p.tz); // inside the lead of the first one: it already fired
    expect(nextFire(p, now)!.day).toBe('2026-11-19');
    expect(nextFire(base, now)).toBeNull();
    expect(nextFire(base, zonedToUtc('2026-11-12', '16:00', base.tz))!.day).toBe('2026-11-12');
  });
  it('a long lead reaches back to an earlier day', () => {
    const p = { ...base, lead: 2 * 24 * 60 };
    const now = zonedToUtc('2026-11-10', '12:00', p.tz);
    expect(nextFire(p, now)!.fireAt).toBe(zonedToUtc('2026-11-10', '18:00', p.tz));
  });
});

describe('a plan never touches history', () => {
  it('the engine imports nothing from the store or the history', () => {
    for (const f of ['recurrence.ts', 'zoned.ts']) {
      const src = readFileSync(join(__dirname, f), 'utf8');
      expect(src).not.toMatch(/from '\.\.\/(store|types|sessions|homeSets|activities)/);
    }
  });
});
