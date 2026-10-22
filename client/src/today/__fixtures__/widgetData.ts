/** Synthetic Today-widget fixtures (see widgetHarness.tsx). */

import { __getStateForTests, type StoreState } from '../../store';
import type {
  Activity,
  Exercise,
  Injury,
  RestPeriod,
  SetEntry,
  SleepNight,
  Workout,
} from '../../types';

/** The store as the test run found it, before any test seeded it (keeps every fixture independent of test order). */
const PRISTINE: StoreState = __getStateForTests();

/** Saturday 26 Sep 2026, 12:00 local. */
export const NOW = new Date(2026, 8, 26, 12, 0).getTime();
export const DAY = 86_400_000;

export const set = (
  id: string,
  reps: number,
  weight: number | null,
  extra: Partial<SetEntry> = {},
): SetEntry =>
  ({
    id,
    reps,
    weight,
    isWarmup: false,
    ...extra,
  }) as SetEntry;

const LIFTS: Array<{ name: string; muscle: string; sec: string[]; base: number }> = [
  {
    name: 'Barbell Bench Press - Medium Grip',
    muscle: 'chest',
    sec: ['triceps', 'shoulders'],
    base: 70,
  },
  { name: 'Barbell Squat', muscle: 'quads', sec: ['glutes', 'hamstrings'], base: 100 },
  { name: 'Barbell Deadlift', muscle: 'hamstrings', sec: ['glutes', 'back'], base: 120 },
  { name: 'Barbell Shoulder Press', muscle: 'shoulders', sec: ['triceps'], base: 45 },
  { name: 'Pullups', muscle: 'lats', sec: ['biceps'], base: 0 },
  { name: 'Bent Over Barbell Row', muscle: 'back', sec: ['biceps'], base: 60 },
];

const DAYS: Array<{ name: string; lifts: number[] }> = [
  { name: 'Push', lifts: [0, 3] },
  { name: 'Legs', lifts: [1, 2] },
  { name: 'Pull', lifts: [4, 5] },
];

/** `weeks` weeks of three sessions (Mon/Wed/Fri), newest ending the week before NOW's Saturday, with slow progression. */
export function history(weeks = 10, end = NOW): Workout[] {
  const out: Workout[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    DAYS.forEach((d, i) => {
      const day = new Date(end - (w * 7 + (5 - i * 2)) * DAY);
      day.setHours(18, 0, 0, 0);
      const startedAt = day.getTime();
      const progress = (weeks - w) * 1.25;
      const exercises: Exercise[] = d.lifts.map((li, pos) => {
        const l = LIFTS[li];
        const kg = l.base === 0 ? null : l.base + progress;
        return {
          id: `e-${w}-${i}-${pos}`,
          name: l.name,
          kind: 'strength',
          position: pos,
          primaryMuscle: l.muscle,
          secondaryMuscles: l.sec,
          sets: [
            set(`s-${w}-${i}-${pos}-0`, 10, kg === null ? null : kg * 0.6, { isWarmup: true }),
            set(`s-${w}-${i}-${pos}-1`, 8, kg, { rpe: 8 }),
            set(`s-${w}-${i}-${pos}-2`, 8, kg, { rpe: 8.5 }),
            set(`s-${w}-${i}-${pos}-3`, 6 + (w % 3), kg, {
              rpe: 9,
              failure: w % 4 === 0 ? 'manual' : null,
            }),
          ],
        } as Exercise;
      });
      if (i === 1)
        exercises.push({
          id: `c-${w}`,
          name: 'Treadmill Running',
          kind: 'cardio',
          position: 9,
          sets: [
            set(`cs-${w}`, 0, null, { durationMin: 20 + w, distanceKm: 3 + w / 10, calories: 220 }),
          ],
        } as Exercise);
      out.push({
        id: `w-${w}-${i}`,
        startedAt,
        finishedAt: startedAt + 58 * 60_000,
        autoFinished: false,
        dayName: d.name,
        gymId: w % 4 === 0 ? 'g2' : 'g1',
        exercises,
      });
    });
  }
  return out;
}

export function sleeps(nights = 21, end = NOW, hours = 0): SleepNight[] {
  const out: SleepNight[] = [];
  for (let i = 0; i < nights; i++) {
    const wake = new Date(end - i * DAY);
    wake.setHours(6, 30 + (i % 3) * 10, 0, 0);
    const date = `${wake.getFullYear()}-${String(wake.getMonth() + 1).padStart(2, '0')}-${String(wake.getDate()).padStart(2, '0')}`;
    const dur = hours > 0 ? hours * 60 : 7 * 60 + (i % 4) * 20 - (i % 5 === 0 ? 120 : 0);
    out.push({
      id: `sl-${i}`,
      date,
      bedtime: wake.getTime() - dur * 60_000,
      wake: wake.getTime(),
      quality: i % 3 === 0 ? 'good' : i % 3 === 1 ? 'ok' : 'restless',
      source: i % 6 === 5 ? 'auto' : 'backfill',
    });
  }
  return out;
}

/** Two daytime naps on the two days before NOW. */
export function naps(end = NOW): SleepNight[] {
  return [1, 2].map((i) => {
    const start = new Date(end - i * DAY);
    start.setHours(14, 0, 0, 0);
    return {
      id: `nap-${i}`,
      date: `nap${i}`,
      bedtime: start.getTime(),
      wake: start.getTime() + 40 * 60_000,
      source: 'backfill',
      kind: 'nap',
    } as SleepNight;
  });
}

export function activities(end = NOW): Activity[] {
  const kinds: Array<[string, Activity['category'], number, number | null]> = [
    ['run', 'conditioning', 35, 5.4],
    ['cycle', 'conditioning', 50, 18],
    ['walk', 'conditioning', 40, 3.1],
    ['mobility', 'recovery', 20, null],
    ['yoga', 'recovery', 30, null],
    ['swim', 'conditioning', 45, 1.2],
    ['run', 'conditioning', 28, 4.2],
    ['hike', 'conditioning', 120, 9.5],
    ['sauna', 'recovery', 15, null],
    ['football', 'conditioning', 60, null],
    ['row', 'conditioning', 25, 5],
    ['run', 'conditioning', 42, 6.6],
    ['cycle', 'conditioning', 65, 24],
    ['hiit', 'conditioning', 22, null],
  ];
  return kinds.map(([type, category, durationMin, distanceKm], i) => {
    const startedAt = end - (i * 2 + 1) * DAY - 3 * 3_600_000;
    return {
      id: `a-${i}`,
      type,
      category,
      startedAt,
      finishedAt: startedAt + durationMin * 60_000,
      durationMin,
      distanceKm,
      calories: i % 3 ? durationMin * 8 : null,
      effort: i % 2 ? 'hard' : 'moderate',
      note: i === 0 ? 'Easy loop by the river' : null,
    } as Activity;
  });
}

export const knee: Injury = {
  id: 'knee',
  reason: 'injury',
  bodyPart: 'knee',
  side: 'left',
  muscles: ['quads'],
  stage: 'reintroduce',
  startDay: Math.floor((NOW - 3 * DAY) / DAY),
  createdAt: NOW - 3 * DAY,
  checkins: [],
  healedDay: null,
} as Injury;

export const restWeek: RestPeriod = {
  id: 'rest1',
  startDay: Math.floor((NOW + 3 * DAY) / DAY),
  endDay: Math.floor((NOW + 6 * DAY) / DAY),
  mode: 'off',
  createdAt: NOW - DAY,
  name: 'Trip',
};

/** The store as a user with ten weeks of history, sleep, activities, weigh-ins, goals and an injury would have it. */
export const GYM = {
  id: 'g1',
  name: 'Iron Yard',
  lat: 1,
  lng: 1,
  radiusM: 100,
  favorite: true,
  externalId: 'osm:1',
  inventory: ['barbell', 'dumbbell', 'cable', 'machine', 'kettlebell', 'bands'],
  equipmentItems: [
    'barbell-olympic',
    'dumbbell-adjustable',
    'rack-power',
    'bench-flat',
    'smith-machine',
    'kettlebell-cast',
    'cable-crossover',
    'cable-lat-tower',
    'plate-bumper',
  ],
};

export function richState(): StoreState {
  const s = structuredClone(PRISTINE);
  return {
    ...s,
    workouts: history(),
    sleeps: [...sleeps(), ...naps()],
    sleepSchedule: { sameEveryNight: true, every: { bedMin: 1380, wakeMin: 420 }, byDay: {} },
    activities: activities(),
    restPeriods: [restWeek],
    injuries: [knee],
    gyms: [GYM, { id: 'g2', name: 'Home Rack', lat: 5, lng: 5, radiusM: 50 }],
    sharedGyms: { 'osm:1': { equipmentItems: GYM.equipmentItems, updatedAt: NOW - DAY } },
    bodyMetrics: {
      ...s.bodyMetrics,
      sex: 'male',
      dob: '1992-04-12',
      heightCm: 180,
      goalWeightKg: 80,
      bodyFatPct: 18,
      muscleKg: 36,
      waistCm: 84,
      chestCm: 102,
      weights: Array.from({ length: 12 }, (_, i) => ({
        id: `wt-${i}`,
        at: NOW - (11 - i) * 7 * DAY,
        weight: 86 - i * 0.4,
      })),
    },
    goals: {
      physique: { archetype: 'classic', sex: 'male', setAt: NOW - 30 * DAY },
      focus: {
        label: 'Block 2',
        startedAt: NOW - 14 * DAY,
        weeks: 8,
        emphasis: { 'delt-side': 'grow', quads: 'grow', biceps: 'hold', calves: 'maintain' },
      },
    },
  } as unknown as StoreState;
}

export function emptyState(): StoreState {
  const s = structuredClone(PRISTINE);
  return {
    ...s,
    workouts: [],
    sleeps: [],
    activities: [],
    restPeriods: [],
    injuries: [],
    gyms: [],
    goals: {},
    bodyMetrics: { ...s.bodyMetrics, weights: [] },
  } as StoreState;
}

export function coachOn(base: StoreState, over: Partial<StoreState['coach']> = {}): StoreState {
  return {
    ...base,
    coach: {
      ...base.coach,
      enabled: true,
      temper: 3,
      role: 'main',
      startedAt: NOW - 20 * DAY,
      readAt: NOW - 5 * DAY,
      plan: {
        createdAt: NOW - 14 * DAY,
        blockStart: NOW - 14 * DAY,
        weeks: 6,
        days: [
          { weekday: 1, split: 'push', muscles: ['chest', 'shoulders'], name: null },
          { weekday: 3, split: 'legs', muscles: ['quads', 'hamstrings'], name: 'Leg day' },
          { weekday: 5, split: 'pull', muscles: ['back', 'biceps'], name: null },
        ],
        lengthMin: 60,
        intent: 'hypertrophy',
        warmup: true,
        cardio: false,
        cooldown: false,
      },
      ...over,
    },
  } as StoreState;
}
