import { describe, expect, it } from 'vitest';
import { buildProgramSeed, programSuggestionReadiness } from '../client/src/data/programSeed';
import type { Workout } from '../client/src/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const MONDAY = Date.UTC(2026, 7, 10, 10);

function workout(id: string, dayOffset: number, name = 'Bench Press'): Workout {
  const startedAt = MONDAY + dayOffset * DAY_MS;
  return {
    id,
    startedAt,
    finishedAt: startedAt + 60 * 60 * 1000,
    autoFinished: false,
    exercises: [
      {
        id: `${id}-ex`,
        name,
        kind: 'strength',
        position: 0,
        sets: [{ id: `${id}-set`, reps: 8, weight: 80, isWarmup: false, position: 0 }],
      },
    ],
  };
}

describe('programSeed', () => {
  it('considers three lift sessions across two weekdays enough for a suggestion', () => {
    const finished = [workout('w1', 0), workout('w2', 2, 'Squat'), workout('w3', 7)];

    expect(programSuggestionReadiness(finished)).toMatchObject({
      ready: true,
      liftSessions: 3,
      trainedDays: 2,
    });
  });

  it('does not suggest from one repeated weekday', () => {
    const finished = [workout('w1', 0), workout('w2', 7), workout('w3', 14)];

    expect(programSuggestionReadiness(finished).ready).toBe(false);
  });

  it('skips pure cardio when prefilling last weeks lifts', () => {
    const run = workout('run', 1, 'Run');
    run.exercises[0].kind = 'cardio';

    const seed = buildProgramSeed([workout('lift', 0), run], true, 'New program');

    expect(seed.items.map((item) => item.name)).toEqual(['Bench Press']);
  });
});
