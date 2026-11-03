import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Exercise, Workout } from '../types';

const h = vi.hoisted(() => ({ workouts: [] as unknown[], nav: vi.fn() }));

vi.mock('../store', async (orig) => ({
  ...(await orig<typeof import('../store')>()),
  useStore: () => ({ workouts: h.workouts }),
}));
vi.mock('../ui', () => ({ useExerciseName: () => (n: string) => `<${n}>` }));
vi.mock('../navigateHash', () => ({ navigateHash: h.nav }));

import { SESSION_HASH, useWorkoutChip } from './workoutChip';

const T0 = 1_000_000_000_000;
const ex = (id: string, planned: number, loggedAt: number[] = []): Exercise =>
  ({
    id,
    name: id,
    position: 0,
    plannedSets: planned,
    sets: loggedAt.map((a, i) => ({ id: `s${i}`, position: i, reps: 5, weight: 50, loggedAt: a })),
  }) as unknown as Exercise;
const wk = (exercises: Exercise[], finishedAt: number | null = null): Workout =>
  ({ id: 'w', startedAt: T0, finishedAt, exercises }) as unknown as Workout;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0 + 65_000);
  h.nav.mockClear();
});
afterEach(() => vi.useRealTimers());

describe('useWorkoutChip', () => {
  it('is null when no workout is open, and starts no timer', () => {
    h.workouts = [wk([ex('Bench', 3)], T0 + 10)];
    const { result } = renderHook(() => useWorkoutChip());
    expect(result.current).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shows the exercise, the set and the elapsed time of a fresh session', () => {
    h.workouts = [wk([ex('Bench', 4)])];
    const { result } = renderHook(() => useWorkoutChip());
    expect(result.current).toMatchObject({ title: '<Bench>', detail: 'Set 1/4', time: '1:05' });
  });

  it('while resting it says so and counts from the last set, ticking each second', () => {
    h.workouts = [wk([ex('Bench', 4, [T0 + 60_000])])];
    const { result } = renderHook(() => useWorkoutChip());
    expect(result.current).toMatchObject({ detail: 'Set 2/4 · rest', time: '0:05' });
    act(() => void vi.advanceTimersByTime(3_000));
    expect(result.current?.time).toBe('0:08');
  });

  it('an unplanned exercise shows a bare set number', () => {
    h.workouts = [wk([ex('Curl', 0)])];
    const { result } = renderHook(() => useWorkoutChip());
    expect(result.current?.detail).toBe('Set 1');
  });

  it('a session without exercises falls back to the generic label and no detail', () => {
    h.workouts = [wk([])];
    const { result } = renderHook(() => useWorkoutChip());
    expect(result.current).toMatchObject({ title: 'Workout', detail: '', time: '1:05' });
  });

  it('open() goes to the session screen; the timer stops on unmount', () => {
    h.workouts = [wk([ex('Bench', 2)])];
    const { result, unmount } = renderHook(() => useWorkoutChip());
    result.current?.open();
    expect(h.nav).toHaveBeenCalledWith(SESSION_HASH);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
