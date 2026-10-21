// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DAY, MIN } from '../domain/time';
import { REMIND_BEFORE, UNMARKED_AFTER, dueAtOf, timingOf } from './timing';
import { tsOf } from './time';
import type { ScheduleDoc } from './types';

const day = 20_400;
const at = (d: number, hh: number) => tsOf(d, hh * 60);
const doc = (over: Partial<ScheduleDoc> = {}): ScheduleDoc => ({
  clientId: 'c1',
  rev: 1,
  patterns: [],
  oneOffs: [
    { id: 'a', day: day + 1, start: '18:00', dur: 60, gymId: 'g' },
    { id: 'b', day: day - 1, start: '10:00', dur: 60, gymId: 'g' },
  ],
  exceptions: [],
  cancelled: [],
  ...over,
});

describe('timingOf', () => {
  const now = at(day, 12);
  it('lists upcoming starts and unmarked finished sessions, nothing else', () => {
    const t = timingOf(doc(), now);
    expect(t.starts).toEqual([at(day + 1, 18)]);
    expect(t.unmarked).toEqual([at(day - 1, 11)]);
    expect(Object.keys(t).sort()).toEqual(['dueAt', 'starts', 'unmarked']);
  });
  it('a marked session is not unmarked; a cancelled one is not upcoming', () => {
    const t = timingOf(
      doc({
        exceptions: [{ slotKey: `b:${day - 1}`, status: 'done' }],
        cancelled: [`a:${day + 1}`],
      }),
      now,
    );
    expect(t.starts).toEqual([]);
    expect(t.unmarked).toEqual([]);
    expect(t.dueAt).toBe(0);
  });
  it('dueAt is the earliest reminder moment still ahead', () => {
    const t = timingOf(doc({ exceptions: [{ slotKey: `b:${day - 1}`, status: 'done' }] }), now);
    expect(t.dueAt).toBe(at(day + 1, 18) - REMIND_BEFORE);
  });
  it('dueAtOf skips moments that already passed', () => {
    const t = { starts: [1_000 * MIN + REMIND_BEFORE], unmarked: [5_000 * MIN - UNMARKED_AFTER] };
    expect(dueAtOf(t, 0)).toBe(1_000 * MIN);
    expect(dueAtOf(t, 1_000 * MIN)).toBe(5_000 * MIN);
    expect(dueAtOf(t, 5_000 * MIN)).toBe(0);
  });
  it('constants', () => {
    expect(REMIND_BEFORE).toBe(18 * 60 * MIN);
    expect(UNMARKED_AFTER).toBe(2 * 60 * MIN);
    expect(DAY).toBe(86_400_000);
  });
});
