import { describe, it, expect } from 'vitest';
import {
  intentSpec,
  warmupRamp,
  coldStartWeight,
  sessionSetsForMuscle,
  patternOf,
  rankExercisesForMuscle,
  buildDay,
  type BuildContext,
} from './sessionBuilder';
import { LANDMARKS } from './volume';
import type { BodyMetrics, Workout } from './types';

const DAY = 24 * 3600 * 1000;
const now = new Date(2025, 5, 15, 12, 0, 0).getTime();

function workout(
  daysAgo: number,
  exs: { name: string; primary: string; kg: number; reps: number; sets: number }[],
): Workout {
  const startedAt = now - daysAgo * DAY;
  return {
    id: `w${daysAgo}-${Math.random()}`,
    startedAt,
    finishedAt: startedAt + 3600_000,
    exercises: exs.map((e, i) => ({
      id: `e${i}-${Math.random()}`,
      name: e.name,
      kind: 'strength' as const,
      position: i,
      primaryMuscle: e.primary,
      secondaryMuscles: [],
      sets: Array.from({ length: e.sets }, (_, s) => ({
        id: `s${s}`,
        reps: e.reps,
        weight: e.kg,
        isWarmup: false,
        type: 'working' as const,
      })),
    })),
  } as unknown as Workout;
}

describe('intentSpec', () => {
  it('maps each intent to a rep/rest scheme', () => {
    expect(intentSpec('strength').repHigh).toBe(5);
    expect(intentSpec('muscle').restSec).toBe(105);
    expect(intentSpec('endurance').repHigh).toBe(20);
  });
});

describe('warmupRamp', () => {
  it('ramps a loaded compound to plates', () => {
    expect(warmupRamp(100, {})).toEqual([
      { reps: 10, weight: 20, type: 'warmup' },
      { reps: 5, weight: 55, type: 'warmup' },
      { reps: 3, weight: 75, type: 'warmup' },
      { reps: 1, weight: 90, type: 'warmup' },
    ]);
  });
  it('skips light or non-weight work', () => {
    expect(warmupRamp(25, { compound: true })).toEqual([]);
    expect(warmupRamp(100, { compound: false })).toEqual([]);
    expect(warmupRamp(100, { loadType: 'band' })).toEqual([]);
    expect(warmupRamp(null, {})).toEqual([]);
  });
});

describe('coldStartWeight', () => {
  it('is a conservative body-weight fraction, rounded', () => {
    expect(coldStartWeight('squat', 80, 'male')).toBe(47.5);
    expect(coldStartWeight('horiz-press', 80, 'female')).toBe(25);
  });
  it('is null for isolation / no body weight', () => {
    expect(coldStartWeight('isolation', 80, 'male')).toBeNull();
    expect(coldStartWeight('squat', null, 'male')).toBeNull();
  });
});

describe('sessionSetsForMuscle', () => {
  it('splits the weekly target over the sessions left', () => {
    const chest = LANDMARKS.chest!; // mev 8, mav 14, mrv 22
    expect(sessionSetsForMuscle(chest, 0, 2)).toBe(7);
    expect(sessionSetsForMuscle(chest, 10, 2)).toBe(4);
  });
});

describe('patternOf', () => {
  it('classifies movement patterns from the name', () => {
    expect(patternOf('Barbell Bench Press', 'compound')).toBe('horiz-press');
    expect(patternOf('Back Squat', 'compound')).toBe('squat');
    expect(patternOf('Romanian Deadlift', 'compound')).toBe('hinge');
    expect(patternOf('Overhead Press', 'compound')).toBe('vert-press');
    expect(patternOf('Lat Pulldown', 'compound')).toBe('vert-pull');
    expect(patternOf('Barbell Curl', 'isolation')).toBe('curl');
    expect(patternOf('Cable Lateral Raise', 'isolation')).toBe('isolation');
  });
});

describe('rankExercisesForMuscle', () => {
  it('returns gym-real strength moves, compounds first', () => {
    const chest = rankExercisesForMuscle('chest', null);
    expect(chest.length).toBeGreaterThan(0);
    expect(chest[0].compound).toBe(true);
    expect(chest.every((c) => c.primary != null)).toBe(true);
  });
});

describe('buildDay', () => {
  const body: BodyMetrics = {
    sex: 'male',
    dob: '1992-01-01',
    heightCm: 180,
    weights: [{ id: 'w', at: now - 3 * DAY, weight: 82 }],
  };
  const finished = [
    workout(5, [{ name: 'Barbell Bench Press', primary: 'chest', kg: 80, reps: 6, sets: 3 }]),
    workout(12, [{ name: 'Barbell Bench Press', primary: 'chest', kg: 77.5, reps: 6, sets: 3 }]),
  ];
  const ctx: BuildContext = {
    finished,
    activities: [],
    body,
    goals: undefined,
    gym: null,
    now,
    intent: 'muscle',
    targetMuscles: ['chest', 'shoulders', 'triceps'],
    warmup: true,
    cardio: true,
    cooldown: true,
    bodyKg: 82,
    sex: 'male',
  };

  it('assembles a full day with blocks, coverage and a duration', () => {
    const day = buildDay(ctx);
    expect(day.main.length).toBeGreaterThan(0);
    expect(day.warmup).toHaveLength(1);
    expect(day.cardio).toHaveLength(1);
    expect(day.cooldown).toHaveLength(1);
    expect(day.estMinutes).toBeGreaterThan(0);
    expect(day.dayName).toBeTruthy();
    expect(day.coverage.some((c) => c.muscle === 'chest')).toBe(true);
    // The benched lift has history → a concrete target with a warm-up ramp.
    const chestLift = day.main.find((e) => e.primary === 'chest');
    expect(chestLift).toBeTruthy();
  });

  it('auto-picks muscles when none are given', () => {
    const day = buildDay({ ...ctx, targetMuscles: undefined });
    expect(day.targetMuscles.length).toBeGreaterThan(0);
    expect(day.main.length).toBeGreaterThan(0);
  });
});
