import { describe, expect, it } from 'vitest';
import { cooldownInProgress, restBeforeSetInWorkout } from './store';
import type { Exercise, SetEntry, Workout } from './types';

const set = (loggedAt: number): SetEntry => ({
  id: `s${loggedAt}`,
  reps: 8,
  weight: 60,
  isWarmup: false,
  position: 0,
  loggedAt,
});
const ex = (id: string, position: number, over: Partial<Exercise> = {}): Exercise => ({
  id,
  name: id,
  position,
  sets: [],
  ...over,
});
const wk = (exercises: Exercise[]): Workout => ({
  id: 'w',
  startedAt: 0,
  finishedAt: null,
  autoFinished: false,
  exercises,
});
const MIN = 60000;

describe('cooldownInProgress', () => {
  it('is on once the cool-down is started after the last set', () => {
    const w = wk([
      ex('bench', 0, { sets: [set(1 * MIN)] }),
      ex('cd', 1, { kind: 'cooldown', markerAt: 3 * MIN }),
    ]);
    expect(cooldownInProgress(w)?.id).toBe('cd');
  });
  it('switches off again when a set is logged after it', () => {
    const w = wk([
      ex('bench', 0, { sets: [set(1 * MIN)] }),
      ex('cd', 1, { kind: 'cooldown', markerAt: 3 * MIN }),
      ex('curl', 2, { sets: [set(10 * MIN)] }),
    ]);
    expect(cooldownInProgress(w)).toBeNull();
  });
  it('turns on by itself when every planned exercise before it is done', () => {
    const w = wk([
      ex('bench', 0, { plannedSets: 1, sets: [set(1 * MIN)] }),
      ex('cd', 1, { kind: 'cooldown' }),
    ]);
    expect(cooldownInProgress(w)?.id).toBe('cd');
  });
  it('stays off mid-plan or on free-form exercises until started', () => {
    const midPlan = wk([
      ex('bench', 0, { plannedSets: 3, sets: [set(1 * MIN)] }),
      ex('cd', 1, { kind: 'cooldown' }),
    ]);
    const freeForm = wk([
      ex('bench', 0, { sets: [set(1 * MIN)] }),
      ex('cd', 1, { kind: 'cooldown' }),
    ]);
    expect(cooldownInProgress(midPlan)).toBeNull();
    expect(cooldownInProgress(freeForm)).toBeNull();
  });
});

describe('restBeforeSetInWorkout across a cool-down', () => {
  it("doesn't count the cool-down as rest", () => {
    const after = set(20 * MIN);
    const w = wk([
      ex('bench', 0, { sets: [set(1 * MIN)] }),
      ex('cd', 1, { kind: 'cooldown', markerAt: 3 * MIN }),
      ex('curl', 2, { sets: [after] }),
    ]);
    expect(restBeforeSetInWorkout(w, after)).toBeNull();
  });
  it('still measures rest between cardio intervals (net of the interval)', () => {
    const second = { ...set(10 * MIN), reps: 0, durationMin: 4 };
    const w = wk([
      ex('row', 0, {
        kind: 'cardio',
        sets: [{ ...set(4 * MIN), reps: 0, durationMin: 4 }, second],
      }),
    ]);
    // 6 min between logs − 4 min rowing = 2 min rest
    expect(restBeforeSetInWorkout(w, second)).toBe(120);
  });
});
