import { afterEach, describe, expect, it } from 'vitest';
import { coachClock, setCoachTimeZone } from '../../format';
import { dayOfTs, minOfTs, tsOf } from '../../schedule/time';
import { createDemoClock } from './demoClock';
import { FIXTURE_NOW } from './fixtures';

afterEach(() => setCoachTimeZone('UTC'));

const anchor = dayOfTs(FIXTURE_NOW); // Wed 7 Oct 2026

describe("demo clock: the viewer's real time of day on the fixture day", () => {
  it.each([
    ['Europe/Kyiv', Date.UTC(2026, 9, 13, 14, 14, 20), '17:14'], // the reported case: 17:14 in Kyiv
    ['UTC', Date.UTC(2026, 9, 13, 14, 14, 20), '14:14'],
    ['America/New_York', Date.UTC(2026, 9, 13, 21, 14, 20), '17:14'],
    ['Asia/Kolkata', Date.UTC(2026, 9, 13, 11, 44, 20), '17:14'], // +05:30
  ])('%s', (zone, real, clock) => {
    const now = createDemoClock({ zone, realNow: () => real })();
    expect(coachClock(now)).toBe(clock);
    expect(dayOfTs(now)).toBe(anchor); // the fixture day, not the real date
    expect(now % 60_000).toBe(20_000); // seconds keep ticking with the real clock
  });

  it('is not frozen at 09:05: it moves with the real clock', () => {
    let real = Date.UTC(2026, 9, 13, 14, 14);
    const clock = createDemoClock({ zone: 'Europe/Kyiv', realNow: () => real });
    const a = clock();
    real += 61 * 60_000;
    expect(clock() - a).toBe(61 * 60_000);
  });

  it('follows the Coach zone for the displayed wall clock', () => {
    setCoachTimeZone('Europe/Kyiv');
    const now = createDemoClock({
      zone: 'Europe/Kyiv',
      realNow: () => Date.UTC(2026, 9, 13, 14, 14),
    })();
    expect(minOfTs(now)).toBe(17 * 60 + 14);
    expect(coachClock(now)).toBe('17:14');
  });

  it("DST edges: the wall-clock minute is the viewer's, before and after the change", () => {
    for (const [zone, real, wall] of [
      ['Europe/Kyiv', Date.UTC(2026, 9, 24, 12, 0), 15 * 60], // EEST (+3) the day before the fall change
      ['Europe/Kyiv', Date.UTC(2026, 9, 25, 12, 0), 14 * 60], // EET (+2) after it
      ['Europe/Kyiv', Date.UTC(2026, 2, 29, 12, 0), 15 * 60], // EEST after the spring change
      ['America/New_York', Date.UTC(2026, 2, 8, 12, 0), 8 * 60], // EDT right after spring forward
      ['America/New_York', Date.UTC(2026, 10, 1, 12, 0), 7 * 60], // EST after fall back
    ] as const) {
      const now = createDemoClock({ zone, realNow: () => real })();
      expect(minOfTs(now)).toBe(wall);
    }
  });

  it('an explicit anchor day is honoured', () => {
    const day = anchor + 3;
    const now = createDemoClock({
      anchor: day,
      zone: 'UTC',
      realNow: () => Date.UTC(2026, 9, 13, 8, 5),
    })();
    expect(now).toBe(tsOf(day, 8 * 60 + 5));
  });
});
