import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  fmtWarmupClock,
  firstStrengthSetAt,
  warmupMeasuredSec,
  warmupMeasureLive,
  warmupSummary,
} from './warmupLog';
import {
  __getStateForTests,
  __replaceStateForTests,
  addExercise,
  finishWorkout,
  startWorkout,
  upsertSet,
  workoutVolumeKg,
} from './store';
import { WarmupMarkerTitle } from './components/WarmupCard';
import { setLocale } from './i18n';
import type { Exercise, Workout } from './types';

const T0 = 1_000_000_000_000;
const marker = (over: Partial<Exercise> = {}): Exercise => ({
  id: 'm',
  name: 'Warm-up',
  kind: 'warmup',
  position: 0,
  markerAt: T0,
  sets: [],
  ...over,
});
const lift = (loggedAt: number, over: Record<string, unknown> = {}): Exercise =>
  ({
    id: 'l',
    name: 'Bench Press',
    kind: 'strength',
    position: 1,
    sets: [{ id: 's', reps: 5, weight: 60, isWarmup: false, position: 0, loggedAt, ...over }],
  }) as Exercise;
const wk = (exercises: Exercise[], over: Partial<Workout> = {}): Workout =>
  ({ id: 'w', startedAt: T0, finishedAt: null, exercises, ...over }) as Workout;

beforeEach(() => setLocale('en'));
afterEach(cleanup);

describe('measured warm-up time', () => {
  it('before the first strength set it runs to now (ticking)', () => {
    const w = wk([marker()]);
    expect(warmupMeasuredSec(w.exercises[0], w, T0 + 65_000)).toBe(65);
    expect(warmupMeasuredSec(w.exercises[0], w, T0 + 66_000)).toBe(66);
    expect(warmupMeasureLive(w.exercises[0], w)).toBe(true);
  });
  it('stops at the first working set; warm-up sets and cardio do not count', () => {
    const w = wk([
      marker(),
      lift(T0 + 50_000, { isWarmup: true, type: 'warmup' }),
      { ...lift(T0 + 10_000), id: 'c', name: 'Rowing', kind: 'cardio' },
      { ...lift(T0 + 300_000), id: 'l2', position: 2 },
    ]);
    expect(firstStrengthSetAt(w)).toBe(T0 + 300_000);
    expect(warmupMeasuredSec(w.exercises[0], w, T0 + 9_000_000)).toBe(300);
    expect(warmupMeasureLive(w.exercises[0], w)).toBe(false);
  });
  it('a finished session with no strength set ends at finish', () => {
    const w = wk([marker()], { finishedAt: T0 + 240_000 });
    expect(warmupMeasuredSec(w.exercises[0], w, T0 + 9_000_000)).toBe(240);
  });
  it('a stored measurement is frozen', () => {
    const w = wk([marker({ warmupMeasuredSec: 77 })]);
    expect(warmupMeasuredSec(w.exercises[0], w, T0 + 9_000_000)).toBe(77);
  });
  it('legacy: no stamp and not the opener -> nothing; planned minutes are never used', () => {
    const m = marker({ markerAt: null, position: 1, plannedDurationMin: 5 });
    const w = wk([lift(T0 + 1000, {}), m].map((e, i) => ({ ...e, position: i })));
    expect(warmupMeasuredSec(m, w, T0 + 9e6)).toBeNull();
    // summary's planned value is not what the card/history display
    expect(warmupSummary(m).minutes).toBe(5);
  });
  it('legacy opener falls back to the session start', () => {
    const m = marker({ markerAt: null, plannedDurationMin: 5 });
    const w = wk([m, lift(T0 + 120_000)]);
    expect(warmupMeasuredSec(m, w, T0 + 9e6)).toBe(120);
  });
  it('formats m:ss', () => {
    expect(fmtWarmupClock(65)).toBe('1:05');
    expect(fmtWarmupClock(0)).toBe('0:00');
  });
});

describe('store: marker stamps and freezes the measurement', () => {
  it('stamps markerAt, freezes on the first working set, volume untouched', () => {
    __replaceStateForTests({ ...__getStateForTests(), workouts: [] });
    const w = startWorkout(null)!;
    const m = addExercise(w.id, 'Warm-up', 'warmup');
    const bench = addExercise(w.id, 'Bench Press', 'strength');
    const find = (id: string) =>
      __getStateForTests()
        .workouts.find((x) => x.id === w.id)!
        .exercises.find((e) => e.id === id)!;
    expect(find(m.id).markerAt).toBeTypeOf('number');
    expect(find(m.id).warmupMeasuredSec).toBeUndefined();
    upsertSet(w.id, bench.id, {
      reps: 5,
      weight: 60,
      isWarmup: false,
      type: 'working',
      loggedAt: find(m.id).markerAt! + 90_000,
    });
    expect(find(m.id).warmupMeasuredSec).toBe(90);
    expect(find(m.id).sets).toHaveLength(0);
    const cur = __getStateForTests().workouts.find((x) => x.id === w.id)!;
    expect(workoutVolumeKg(cur)).toBe(300);
  });
  it('finish with no strength set freezes at finish time', () => {
    __replaceStateForTests({ ...__getStateForTests(), workouts: [] });
    const w = startWorkout(null)!;
    const m = addExercise(w.id, 'Warm-up', 'warmup');
    const at = __getStateForTests().workouts.find((x) => x.id === w.id)!.exercises[0].markerAt!;
    finishWorkout(w.id, at + 180_000);
    const e = __getStateForTests()
      .workouts.find((x) => x.id === w.id)!
      .exercises.find((x) => x.id === m.id)!;
    expect(e.warmupMeasuredSec).toBe(180);
  });
});

describe('warm-up marker title line', () => {
  it('ticks while live, freezes after the first set, never repeats the word', () => {
    const m = marker();
    const live = wk([m]);
    const { container, rerender } = render(
      <WarmupMarkerTitle workout={live} exercise={m} now={T0 + 5_000} />,
    );
    expect(container.textContent).toBe('Ready when you are · 0:05');
    rerender(<WarmupMarkerTitle workout={live} exercise={m} now={T0 + 6_000} />);
    expect(container.textContent).toBe('Ready when you are · 0:06');
    const done = wk([m, lift(T0 + 60_000)]);
    rerender(<WarmupMarkerTitle workout={done} exercise={m} now={T0 + 600_000} />);
    expect(container.textContent).toBe('Ready when you are · 1:00');
    expect(container.textContent).not.toMatch(/warm-up|~|min/i);
  });
  it('shows no time for legacy data', () => {
    const m = marker({ markerAt: null, position: 1, plannedDurationMin: 5 });
    const w = wk([lift(T0 + 1), m]);
    render(<WarmupMarkerTitle workout={w} exercise={m} now={T0 + 9e6} />);
    expect(screen.getByText('Ready when you are')).toBeTruthy();
  });
});
