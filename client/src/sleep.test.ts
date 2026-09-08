import { describe, it, expect } from 'vitest';
import {
  nightDurationMin,
  sleepStats,
  weekdayPattern,
  sleepReadinessBias,
  planForWeekday,
  planDurationMin,
  minutesOfDay,
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
