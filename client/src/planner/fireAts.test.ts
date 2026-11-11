import { describe, expect, it } from 'vitest';
import { DEFAULT_LEAD, upcomingFires, type PlanTiming } from './recurrence';
import { zonedToUtc } from './zoned';

const tz = 'Europe/Warsaw';
const base: PlanTiming = {
  tz,
  start: '2026-11-02',
  time: '18:00',
  lead: DEFAULT_LEAD,
  repeat: { kind: 'weekly', every: 1, days: [0, 3] },
  ends: { kind: 'never' },
  skip: [],
};
const now = zonedToUtc('2026-11-11', '12:00', tz);

describe('upcomingFires', () => {
  it('lists the reminder moments ahead, ascending, one lead before each start', () => {
    const f = upcomingFires(base, now, 14);
    expect(f[0]).toBe(zonedToUtc('2026-11-12', '17:00', tz));
    expect(f[1]).toBe(zonedToUtc('2026-11-16', '17:00', tz));
    expect(f).toEqual([...f].sort((a, b) => a - b));
    expect(f.every((x) => x > now)).toBe(true);
  });
  it('stops at the horizon and at the size limit', () => {
    expect(
      upcomingFires({ ...base, repeat: { kind: 'daily', every: 1 } }, now, 60, 10),
    ).toHaveLength(10);
    expect(Math.max(...upcomingFires(base, now, 10))).toBeLessThanOrEqual(now + 10 * 86_400_000);
  });
  it('is empty when the series is over, and one moment for a one-off', () => {
    expect(upcomingFires({ ...base, ends: { kind: 'on', day: '2026-11-01' } }, now)).toEqual([]);
    const once = upcomingFires({ ...base, start: '2026-11-20', repeat: { kind: 'none' } }, now);
    expect(once).toEqual([zonedToUtc('2026-11-20', '17:00', tz)]);
  });
  it('skips days the person deleted', () => {
    const f = upcomingFires({ ...base, skip: ['2026-11-12'] }, now, 14);
    expect(f[0]).toBe(zonedToUtc('2026-11-16', '17:00', tz));
  });
});
