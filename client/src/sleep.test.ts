import { describe, it, expect } from 'vitest';
import {
  nightDurationMin,
  sleepStats,
  weekdayPattern,
  sleepReadinessBias,
  planForWeekday,
  planDurationMin,
  minutesOfDay,
  awakeMsAt,
  SLEEP_IDLE_MS,
} from './sleep';
import type { SleepNight, SleepSchedule } from './types';

const now = new Date(2025, 8, 15, 9, 0).getTime(); // Mon Sep 15 2025, 09:00 local

function bedNight(daysAgo: number, bedH: number, bedM: number, durMin: number): SleepNight {
  const base = new Date(now);
  base.setDate(base.getDate() - daysAgo);
  base.setHours(bedH, bedM, 0, 0);
  const bedtime = base.getTime();
  return { id: `n${daysAgo}`, date: 'x', bedtime, wake: bedtime + durMin * 60000, source: 'live' };
}

describe('sleep helpers', () => {
  it('measures a night duration', () => {
    expect(nightDurationMin(bedNight(1, 23, 0, 450), now)).toBe(450);
  });

  it('reads minutes of day locally', () => {
    const d = new Date(2025, 8, 14, 23, 20).getTime();
    expect(minutesOfDay(d)).toBe(23 * 60 + 20);
  });

  it('aggregates rolling stats and consistency', () => {
    const nights = [2, 3, 4, 5, 6, 7, 8].map((d) => bedNight(d, 23, 0, 420));
    const s = sleepStats(nights, now, 480, 14);
    expect(s.nights).toBe(7);
    expect(s.avgMin).toBe(420);
    expect(s.goalMet).toBe(0);
    expect(s.consistencyPct).toBe(100);
  });

  it('scores weekday-relative consistency high despite a weekend shift', () => {
    // Steady weeknights (~23:00) + consistently later weekends (~01:00): a real
    // per-weekday rhythm should read as highly consistent, not near-zero.
    const nights: SleepNight[] = [];
    for (let d = 1; d <= 14; d++) {
      const wd = new Date(new Date(now).setDate(new Date(now).getDate() - d)).getDay();
      const weekend = wd === 5 || wd === 6; // Fri/Sat nights run late
      nights.push(weekend ? bedNight(d, 1, 0, 480) : bedNight(d, 23, 0, 430));
    }
    const s = sleepStats(nights, now, 480, 14);
    expect(s.consistencyPct).toBeGreaterThanOrEqual(90);
  });

  it('counts goal-met nights', () => {
    const nights = [bedNight(1, 23, 0, 500), bedNight(2, 23, 0, 400)];
    expect(sleepStats(nights, now, 480).goalMet).toBe(1);
  });

  it('groups the pattern by weekday', () => {
    const nights = [bedNight(1, 23, 0, 420), bedNight(8, 23, 30, 430)];
    const p = weekdayPattern(nights, now);
    // both bedtimes fall on the same weekday (7 days apart)
    const wd = new Date(bedNight(1, 23, 0, 420).bedtime).getDay();
    expect(p.byDay[wd]?.n).toBe(2);
    expect(p.confidence).toBe('low');
    expect(p.autoLogEligible).toBe(false);
  });

  it('nudges readiness by sufficiency', () => {
    expect(sleepReadinessBias([], now)).toBe(0);
    expect(sleepReadinessBias([bedNight(1, 23, 0, 300)], now, 480)).toBeLessThan(0);
    expect(sleepReadinessBias([bedNight(1, 22, 0, 560)], now, 480)).toBeGreaterThan(0);
  });

  it('resolves a schedule plan and its duration across midnight', () => {
    const sched: SleepSchedule = {
      sameEveryNight: true,
      every: { bedMin: 1400, wakeMin: 400 },
      byDay: {},
    };
    expect(planForWeekday(sched, 3)).toEqual({ bedMin: 1400, wakeMin: 400 });
    expect(planDurationMin({ bedMin: 1400, wakeMin: 400 })).toBe(440);
  });
});

describe('sleep pause / awake accounting', () => {
  const MIN = 60000;
  // A live night that began 3h before `t0`.
  const t0 = new Date(2025, 8, 15, 6, 0).getTime();
  const bedtime = t0 - 180 * MIN;
  const base: SleepNight = { id: 'live', date: 'x', bedtime, wake: null, source: 'live' };

  it('counts the whole span when never paused', () => {
    expect(nightDurationMin(base, t0)).toBe(180);
    expect(awakeMsAt(base, t0)).toBe(0);
  });

  it('freezes the timer while paused and recently active', () => {
    // Paused 10 min ago, active 1 min ago (still browsing → not idle yet).
    const n: SleepNight = {
      ...base,
      awakeSince: t0 - 10 * MIN,
      lastSeen: t0 - 1 * MIN,
    };
    // Open interval grows with now while active → 10 min awake.
    expect(awakeMsAt(n, t0)).toBe(10 * MIN);
    expect(nightDurationMin(n, t0)).toBe(180 - 10);
  });

  it('caps awake at the last activity once idle past the threshold', () => {
    // Paused 30 min ago; last activity 20 min ago → idle 20 min (> 5 min).
    const n: SleepNight = {
      ...base,
      awakeSince: t0 - 30 * MIN,
      lastSeen: t0 - 20 * MIN,
    };
    // Only the 10 active minutes (awakeSince→lastSeen) count as awake; the
    // 20 idle minutes count as sleep.
    expect(awakeMsAt(n, t0)).toBe(10 * MIN);
    expect(nightDurationMin(n, t0)).toBe(180 - 10);
  });

  it('subtracts banked awake time from earlier intervals', () => {
    const n: SleepNight = { ...base, awakeMs: 25 * MIN };
    expect(nightDurationMin(n, t0)).toBe(180 - 25);
  });

  it('adds a still-open interval on top of banked time', () => {
    const n: SleepNight = {
      ...base,
      awakeMs: 15 * MIN,
      awakeSince: t0 - 4 * MIN,
      lastSeen: t0 - 1 * MIN, // active, not idle
    };
    expect(awakeMsAt(n, t0)).toBe(19 * MIN);
  });

  it('treats the idle threshold as the boundary', () => {
    const justUnder: SleepNight = {
      ...base,
      awakeSince: t0 - 10 * MIN,
      lastSeen: t0 - (SLEEP_IDLE_MS / MIN - 1) * MIN, // 4 min idle
    };
    // Under threshold → open interval runs to now.
    expect(awakeMsAt(justUnder, t0)).toBe(10 * MIN);
    const atThreshold: SleepNight = {
      ...base,
      awakeSince: t0 - 10 * MIN,
      lastSeen: t0 - SLEEP_IDLE_MS, // exactly 5 min idle
    };
    // At/over threshold → capped at lastSeen (5 min of awake).
    expect(awakeMsAt(atThreshold, t0)).toBe(5 * MIN);
  });
});
