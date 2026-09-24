import { describe, expect, it } from 'vitest';
import type { Exercise, Workout } from '../types';
import { blockWeek, isDeloadWeek, planDayFor, proposePlan } from './plan';

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 7, 12).getTime(); // Wed 7 Oct 2026, local
let n = 0;
const lift = (name: string, reps: number): Exercise =>
  ({
    id: `e${n++}`,
    name,
    kind: 'strength',
    position: n,
    sets: [0, 1, 2].map((i) => ({ id: `s${n++}`, reps, weight: 60, isWarmup: false, position: i })),
  }) as unknown as Exercise;
const session = (at: number, reps = 10, mins = 60): Workout =>
  ({
    id: `W${n++}`,
    startedAt: at,
    finishedAt: at + mins * 60000,
    gymId: null,
    exercises: [lift('Barbell Bench Press - Medium Grip', reps), lift('Barbell Squat', reps)],
  }) as unknown as Workout;

describe('proposePlan', () => {
  it('no history → three full-body days, Mon/Wed/Fri, warm-up on', () => {
    const plan = proposePlan({ finished: [], plays: [], now: NOW });
    expect(plan.days.map((d) => d.weekday)).toEqual([1, 3, 5]);
    expect(plan.days.every((d) => d.split === 'full')).toBe(true);
    expect(plan.warmup).toBe(true);
    expect(plan.lengthMin).toBe(60);
  });

  it('keeps the weekdays you actually train and your usual length', () => {
    const hist: Workout[] = [];
    // Tue + Sat evenings for 8 weeks, 75 min each.
    for (let w = 1; w <= 8; w++)
      for (const dow of [2, 6]) {
        const d = new Date(NOW - w * 7 * DAY);
        d.setDate(d.getDate() - d.getDay() + dow);
        d.setHours(18, 0, 0, 0);
        hist.push(session(d.getTime(), 10, 75));
      }
    const plan = proposePlan({ finished: hist, plays: [], now: NOW });
    expect(plan.days.map((d) => d.weekday)).toEqual([2, 6]);
    expect(plan.lengthMin).toBe(75);
  });

  it('reads the rep focus from history', () => {
    const heavy = Array.from({ length: 6 }, (_, i) => session(NOW - (i + 1) * 3 * DAY, 4));
    expect(proposePlan({ finished: heavy, plays: [], now: NOW }).intent).toBe('strength');
  });
});

describe('block weeks', () => {
  it('counts weeks from the block start and makes the last one lighter', () => {
    const plan = proposePlan({ finished: [], plays: [], now: NOW });
    expect(blockWeek(plan, NOW)).toBe(1);
    const lastWeek = plan.blockStart + 5 * 7 * DAY + DAY;
    expect(blockWeek(plan, lastWeek)).toBe(6);
    expect(isDeloadWeek(plan, lastWeek)).toBe(true);
    expect(isDeloadWeek(plan, NOW)).toBe(false);
  });
  it('finds today’s planned day by weekday', () => {
    const plan = proposePlan({ finished: [], plays: [], now: NOW });
    expect(planDayFor(plan, NOW)?.weekday).toBe(3); // Wednesday
    expect(planDayFor(plan, NOW + DAY)).toBeNull(); // Thursday — rest
  });
});
