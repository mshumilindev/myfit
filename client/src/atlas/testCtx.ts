/**
 * A realistic log for tests: 30 sessions over ~4 months, seven lifts
 * (incl. pull-ups), bodyweight entries, one gym.
 */
import type { Exercise, Workout } from '../types';
import type { AskCtx } from './intents';
import { COACH_DEFAULT } from './types';

const DAY = 86_400_000;
const NOW = new Date(2026, 8, 23, 18).getTime();
let n = 0;
const lift = (name: string, weight: number, reps: number): Exercise =>
  ({
    id: `e${n++}`,
    name,
    kind: 'strength',
    position: n,
    sets: [0, 1, 2].map((i) => ({
      id: `s${n++}`,
      reps,
      weight,
      isWarmup: false,
      position: i,
    })),
  }) as unknown as Exercise;
const LIFTS: [string, number, number][] = [
  ['Barbell Bench Press - Medium Grip', 85, 8],
  ['Barbell Full Squat', 110, 6],
  ['Barbell Deadlift', 140, 5],
  ['Standing Military Press', 50, 8],
  ['Pullups', 10, 8],
  ['Bent Over Barbell Row', 70, 8],
  ['Barbell Curl', 35, 10],
];
const session = (daysAgo: number, k: number): Workout =>
  ({
    id: `W${n++}`,
    startedAt: NOW - daysAgo * DAY,
    finishedAt: NOW - daysAgo * DAY + 3_600_000,
    gymId: 'g1',
    exercises: LIFTS.filter((_, i) => (i + k) % 2 === 0 || i < 3).map(([nm, w, r]) =>
      lift(nm, w - k, r),
    ),
  }) as unknown as Workout;

export const richCtx = (locale: 'en' | 'uk'): AskCtx => ({
  s: {
    workouts: Array.from({ length: 30 }, (_, i) => session(2 + i * 4, i % 3)),
    coach: { ...COACH_DEFAULT, enabled: true },
    injuries: [],
    sleeps: [],
    bodyMetrics: {
      weights: Array.from({ length: 12 }, (_, i) => ({
        id: `b${i}`,
        at: NOW - i * 9 * DAY,
        weight: 90 - i * 0.3,
      })),
    },
    restPeriods: [],
    exerciseRest: {},
    activities: [],
    gyms: [{ id: 'g1', name: 'Northside Gym' } as never],
    goals: {},
  },
  now: NOW,
  locale,
  temper: 2,
  fmt: {
    kg: (k) => `${k} kg`,
    mmss: (s) => `${s}s`,
    muscle: (m) => m,
    exercise: (e) => e,
  },
});
