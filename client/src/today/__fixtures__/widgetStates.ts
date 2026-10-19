/** Synthetic Today-widget fixtures (see widgetHarness.tsx). */

import {
  NOW,
  DAY,
  set,
  history,
  sleeps,
  naps,
  activities,
  richState,
  emptyState,
  coachOn,
} from './widgetData';
import { type StoreState } from '../../store';
import type { Exercise, SetEntry, SleepNight, Workout } from '../../types';
/** A session that started 35 minutes ago and is still open, with one logged set. */
export function liveWorkout(base: StoreState): StoreState {
  const startedAt = NOW - 35 * 60_000;
  return {
    ...base,
    workouts: [
      ...base.workouts,
      {
        id: 'live',
        startedAt,
        finishedAt: null,
        autoFinished: false,
        dayName: 'Push',
        exercises: [
          {
            id: 'live-e1',
            name: 'Barbell Bench Press - Medium Grip',
            kind: 'strength',
            position: 0,
            primaryMuscle: 'chest',
            secondaryMuscles: ['triceps'],
            sets: [set('live-s1', 8, 75, { rpe: 8, loggedAt: NOW - 40_000 } as Partial<SetEntry>)],
          } as Exercise,
        ],
      },
    ],
  } as StoreState;
}

/** One finished session this morning and nothing before it. */
export function justStarted(base: StoreState): StoreState {
  return {
    ...base,
    workouts: history(1)
      .slice(-1)
      .map((w) => ({ ...w, startedAt: NOW - 3 * 3_600_000, finishedAt: NOW - 2 * 3_600_000 })),
  } as StoreState;
}

/** A long layoff: the last session was seven weeks ago. */
export function layoff(base: StoreState): StoreState {
  return { ...base, workouts: history(6, NOW - 49 * DAY) } as StoreState;
}

/** Eight weeks on the same weights, short nights, rest cut short, weight falling fast. */
export function stalled(base: StoreState): StoreState {
  const flat = history(8).map((w) => ({
    ...w,
    exercises: w.exercises.map((e) => ({
      ...e,
      sets: e.sets.map((x) => ({
        ...x,
        weight: x.weight === null ? null : Math.round(x.weight / 20) * 20 || 20,
        restTargetSec: 120,
        rpe: 9.5,
      })),
    })),
  }));
  return {
    ...base,
    workouts: flat,
    sleeps: sleeps(14).map((n) => ({
      ...n,
      bedtime: (n.wake as number) - 4.5 * 3_600_000,
      quality: 'restless' as const,
    })),
    bodyMetrics: {
      ...base.bodyMetrics,
      weights: Array.from({ length: 6 }, (_, i) => ({
        id: `sw${i}`,
        at: NOW - (5 - i) * 4 * DAY,
        weight: 90 - i * 1.5,
      })),
    },
  } as StoreState;
}

/** A session every day for three weeks; the last one beats every earlier lift. */
export function streakWithPr(base: StoreState): StoreState {
  const days = Array.from({ length: 21 }, (_, i) => history(1)[i % 3]).map((w, i) => {
    const startedAt = NOW - (21 - i) * DAY + 3_600_000 * 6;
    const last = i === 20;
    return {
      ...w,
      id: `d${i}`,
      startedAt,
      finishedAt: startedAt + 3_000_000,
      exercises: w.exercises.map((e) => ({
        ...e,
        id: `${e.id}-${i}`,
        sets: e.sets.map((x, k) => ({
          ...x,
          id: `${x.id}-${i}`,
          weight: x.weight === null ? null : x.weight + (last ? 15 : 0) + (k === 0 ? 0 : 0),
        })),
      })),
    };
  });
  return { ...base, workouts: days } as StoreState;
}

/** Slept well every night (no debt), a live night in progress. */
export function sleepGood(base: StoreState): StoreState {
  return { ...base, sleeps: [...sleeps(21, NOW, 8.7), ...naps()] } as StoreState;
}
export function sleepLive(base: StoreState): StoreState {
  return {
    ...base,
    sleeps: [
      ...base.sleeps,
      {
        id: 'live-night',
        date: '2026-09-27',
        bedtime: NOW - 4 * 3_600_000,
        wake: null,
        source: 'live',
      } as SleepNight,
    ],
  } as StoreState;
}
/** Barely any body data: one weigh-in, nothing else. */
export function thinBody(base: StoreState): StoreState {
  return {
    ...base,
    bodyMetrics: { weights: [{ id: 'w', at: NOW - 2 * DAY, weight: 90 }] },
  } as StoreState;
}
/** Resting today (illness) with an open-ended period. */
export function unwell(base: StoreState): StoreState {
  const today = Math.floor(NOW / DAY);
  return {
    ...base,
    restPeriods: [
      {
        id: 'ill',
        startDay: today - 2,
        endDay: today + 2,
        mode: 'illness',
        createdAt: NOW - 2 * DAY,
        name: 'Flu',
        illnessKind: 'cold',
      },
      {
        id: 'off',
        startDay: today + 5,
        endDay: today + 9,
        mode: 'off',
        createdAt: NOW - DAY,
        name: 'Trip',
      },
    ],
  } as StoreState;
}

/** Home sets (own template + catalog moves) with a few finished home runs, one auto-finished. */
export function homeSets(base: StoreState): StoreState {
  const run = (i: number, setId: string, reps: number): Workout => {
    const startedAt = NOW - (i * 2 + 1) * DAY;
    return {
      id: `home-${i}`,
      startedAt,
      finishedAt: startedAt + 25 * 60_000,
      autoFinished: i === 1,
      kind: 'home',
      homeSetId: setId,
      dayName: 'Morning',
      exercises: [
        {
          id: `he-${i}`,
          name: 'Pushups',
          kind: 'strength',
          position: 0,
          primaryMuscle: 'chest',
          secondaryMuscles: [],
          measure: 'reps',
          sets: [
            set(`hs-${i}-1`, reps, null, { loggedAt: startedAt + 5 * 60_000 } as Partial<SetEntry>),
            set(`hs-${i}-2`, reps - 2, null, {
              loggedAt: startedAt + 9 * 60_000,
            } as Partial<SetEntry>),
          ],
        } as Exercise,
        {
          id: `hp-${i}`,
          name: 'Plank',
          kind: 'strength',
          position: 1,
          primaryMuscle: 'core',
          secondaryMuscles: [],
          measure: 'hold',
          sets: [
            set(`hp-${i}-1`, 1, null, {
              durationMin: 1,
              loggedAt: startedAt + 14 * 60_000,
            } as Partial<SetEntry>),
          ],
        } as Exercise,
      ],
    } as Workout;
  };
  return {
    ...base,
    home: {
      sets: [
        {
          id: 'hs1',
          name: 'Morning',
          moves: ['Pushups', 'Plank', 'Bodyweight Squat'],
          createdAt: NOW - 30 * DAY,
          updatedAt: NOW - 30 * DAY,
        },
        {
          id: 'hs2',
          name: 'Pull',
          moves: ['Pullups', 'Chin-Up', 'own1'],
          createdAt: NOW - 20 * DAY,
          updatedAt: NOW - 20 * DAY,
        },
      ],
      moves: [
        {
          id: 'own1',
          name: 'Towel Row',
          measure: 'reps',
          muscle: 'back',
          icon: 'bar',
          custom: true,
        },
      ],
    },
    workouts: [
      ...base.workouts,
      run(0, 'hs1', 20),
      run(1, 'hs1', 18),
      run(2, 'hs1', 15),
      run(3, 'hs2', 8),
    ],
  } as StoreState;
}

/** A session and a run both finished earlier today. */
export function busyToday(base: StoreState): StoreState {
  const w = history(1)[1];
  const startedAt = NOW - 5 * 3_600_000;
  const act = activities().find((a) => a.type === 'run')!;
  return {
    ...base,
    workouts: [
      ...base.workouts,
      { ...w, id: 'today-w', startedAt, finishedAt: startedAt + 3_000_000, dayName: 'Legs' },
    ],
    activities: [
      ...base.activities,
      {
        ...act,
        id: 'today-a',
        startedAt: NOW - 2 * 3_600_000,
        finishedAt: NOW - 3_600_000,
        durationMin: 45,
        calories: null,
      },
    ],
  } as StoreState;
}

/** A coach plan that has a session on today (Saturday); `name` null falls back to the split name. */
export function planToday(base: StoreState, name: string | null): StoreState {
  const on = coachOn(base);
  const plan = on.coach.plan!;
  return {
    ...on,
    coach: {
      ...on.coach,
      plan: {
        ...plan,
        days: [...plan.days, { weekday: 6, split: 'upper', muscles: ['chest', 'back'], name }],
      },
    },
  } as StoreState;
}

export const STATES: Record<string, () => StoreState> = {
  empty: emptyState,
  rich: richState,
  coach: () => coachOn(richState()),
  coachRed: () => coachOn(richState(), { temper: 5, keepTemper: true, mutedUntil: NOW + DAY }),
  live: () => liveWorkout(richState()),
  justStarted: () => justStarted(richState()),
  layoff: () => layoff(richState()),
  coachEmpty: () => coachOn(emptyState()),
  coachStalled: () => coachOn(stalled(richState())),
  coachStreak: () => coachOn(streakWithPr(richState())),
  coachLayoff: () => coachOn(layoff(richState())),
  coachLive: () => coachOn(liveWorkout(richState())),
  busyToday: () => busyToday(richState()),
  coachBusy: () => coachOn(busyToday(richState())),
  planToday: () => planToday(richState(), null),
  planTodayNamed: () => planToday(richState(), 'Upper power'),
  planTodayEmpty: () => planToday(emptyState(), null),
  homeSets: () => homeSets(richState()),
  sleepGood: () => sleepGood(richState()),
  sleepLive: () => sleepLive(richState()),
  thinBody: () => thinBody(richState()),
  unwell: () => unwell(coachOn(richState())),
};
