import { describe, expect, it } from 'vitest';
import type { Exercise, SetEntry, Workout } from '../types';
import { clock, workoutChipData } from './workoutChip';

const T0 = 1_000_000_000_000;
const set = (i: number, at: number): SetEntry =>
  ({ id: `s${i}`, position: i, reps: 8, weight: 60, loggedAt: at }) as SetEntry;
const ex = (id: string, position: number, planned: number, loggedAt: number[] = []): Exercise =>
  ({
    id,
    name: id,
    position,
    plannedSets: planned,
    sets: loggedAt.map((a, i) => set(i, a)),
  }) as Exercise;
const wk = (exercises: Exercise[]): Workout =>
  ({ id: 'w', startedAt: T0, finishedAt: null, autoFinished: false, exercises }) as Workout;

describe('workoutChipData', () => {
  it('fresh session: first exercise, set 1, no rest, elapsed ticks', () => {
    const d = workoutChipData(wk([ex('Bench', 0, 4), ex('Row', 1, 3)]), T0 + 65_000);
    expect(d).toEqual({ exercise: 'Bench', setNo: 1, planned: 4, restSec: null, elapsedSec: 65 });
  });
  it('mid exercise: next set number and rest counts from the last logged set', () => {
    const d = workoutChipData(
      wk([ex('Bench', 0, 4, [T0 + 10_000, T0 + 100_000]), ex('Row', 1, 3)]),
      T0 + 192_000,
    );
    expect(d).toMatchObject({ exercise: 'Bench', setNo: 3, planned: 4, restSec: 92 });
  });
  it('moves to the next unfinished exercise when the last one is complete', () => {
    const d = workoutChipData(wk([ex('Bench', 0, 1, [T0 + 5_000]), ex('Row', 1, 3)]), T0 + 35_000);
    expect(d).toMatchObject({ exercise: 'Row', setNo: 1, planned: 3, restSec: 30 });
  });
  it('follows where you actually work when you skipped ahead', () => {
    const d = workoutChipData(wk([ex('Bench', 0, 4), ex('Row', 1, 3, [T0 + 5_000])]), T0 + 6_000);
    expect(d).toMatchObject({ exercise: 'Row', setNo: 2 });
  });
  it('unplanned exercise counts sets without a total', () => {
    const d = workoutChipData(wk([ex('Curl', 0, 0, [T0 + 1_000])]), T0 + 2_000);
    expect(d).toMatchObject({ exercise: 'Curl', setNo: 2, planned: null });
  });
  it('everything done: stays on the last exercise at its last planned set', () => {
    const d = workoutChipData(wk([ex('Bench', 0, 2, [T0 + 1_000, T0 + 2_000])]), T0 + 3_000);
    expect(d).toMatchObject({ exercise: 'Bench', setNo: 2, planned: 2 });
  });
  it('empty session has no exercise', () => {
    expect(workoutChipData(wk([]), T0 + 1_000)).toMatchObject({ exercise: null, restSec: null });
  });
  it('rest stops during a started cool-down', () => {
    const cool = {
      id: 'c',
      name: 'Cool-down',
      kind: 'cooldown',
      position: 5,
      sets: [],
      markerAt: T0 + 50_000,
    } as unknown as Exercise;
    const d = workoutChipData(wk([ex('Bench', 0, 1, [T0 + 10_000]), cool]), T0 + 90_000);
    expect(d.restSec).toBeNull();
  });
});

describe('clock', () => {
  it('formats m:ss and h:mm:ss', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(92)).toBe('1:32');
    expect(clock(3725)).toBe('1:02:05');
  });
});
