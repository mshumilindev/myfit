import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LOCALES, setLocale } from '../i18n';
import { __getStateForTests, __replaceStateForTests } from '../store';
import { BUILT_IN_CATALOG } from '../data/exercises';
import { buildPickItems } from '../picker';
import type { Gym, Workout } from '../types';

vi.mock('../data/exercises', async (orig) => ({
  ...(await orig<typeof import('../data/exercises')>()),
  loadExerciseInstructions: vi.fn(async () => [
    'Set up under the bar.',
    'Brace and press.',
    'Lower with control.',
  ]),
}));

import { ExerciseDetail } from './ExercisePicker';

const en = () => LOCALES.en;
const NOW = new Date(2026, 8, 15, 12, 0).getTime();
const DAY = 86400000;
const bench = BUILT_IN_CATALOG.find((c) => c.muscle === 'chest' && /bench press/i.test(c.names[0]))!
  .names[0];
const workout = (over: Partial<Workout> = {}): Workout => ({
  id: 'cur',
  startedAt: NOW - 600000,
  finishedAt: null,
  autoFinished: false,
  exercises: [],
  ...over,
});
const done = (
  id: string,
  name: string,
  sets: Array<[number, number | null]>,
  finishedAt: number,
): Workout =>
  workout({
    id,
    startedAt: finishedAt - 3600000,
    finishedAt,
    exercises: [
      {
        id: `${id}-e`,
        name,
        position: 0,
        sets: sets.map(([reps, weight], i) => ({
          id: `${id}-s${i}`,
          reps,
          weight,
          isWarmup: false,
        })),
      } as never,
    ],
  });
const setWorkouts = (workouts: Workout[]) =>
  __replaceStateForTests({ ...__getStateForTests(), workouts } as never);
const gym = (inventory?: string[]): Gym =>
  ({ id: 'g1', name: 'Iron', lat: 0, lng: 0, radiusM: 100, inventory }) as Gym;

beforeEach(() => {
  setLocale('en');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  setWorkouts([]);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ExerciseDetail', () => {
  const items = () => buildPickItems(workout(), __getStateForTests().workouts, null, {});
  const pickItem = (name: string) => items().find((i) => i.name === name)!;

  it('shows name, muscles, equipment and the start/finish frames when it has photos', () => {
    const item = items().find((i) => i.images.length === 2 && i.equipment && i.primary)!;
    render(
      <ExerciseDetail
        item={item}
        items={items()}
        gym={null}
        finished={[]}
        onPick={() => undefined}
        onSwap={() => undefined}
      />,
    );
    expect(screen.getByRole('heading', { name: new RegExp(item.name.split(' ')[0]) })).toBeTruthy();
    expect(document.querySelector('.xp-mus .pri')!.textContent).toBe(
      en().muscleGroups[item.primary!],
    );
    expect(document.querySelector('.xp-mus .eq')!.textContent).toBe(
      en().equipmentNames[item.equipment!],
    );
    expect(screen.getByText(en().pickStart)).toBeTruthy();
    expect(screen.getByText(en().pickFinish)).toBeTruthy();
  });

  it('without photos there are no frames', () => {
    const item = { ...items()[0], images: [], image: null };
    render(
      <ExerciseDetail
        item={item}
        items={items()}
        gym={null}
        finished={[]}
        onPick={() => undefined}
        onSwap={() => undefined}
      />,
    );
    expect(document.querySelector('.xp-frames')).toBeNull();
  });

  it('a broken photo falls back to the barbell placeholder', () => {
    const item = { ...items()[0], images: ['a.jpg', 'b.jpg'], image: 'a.jpg' };
    render(
      <ExerciseDetail
        item={item}
        items={items()}
        gym={null}
        finished={[]}
        onPick={() => undefined}
        onSwap={() => undefined}
      />,
    );
    const img = document.querySelector('.xp-frames img') as HTMLImageElement;
    fireEvent.error(img);
    expect(document.querySelectorAll('.xp-frames .xp-noimg')).toHaveLength(1);
  });

  it('history: sessions count, last set, best weight and a sparkline', () => {
    const finished = [
      done('h1', bench, [[8, 60]], NOW - 9 * DAY),
      done('h2', bench, [[8, 65]], NOW - 5 * DAY),
      done('h3', bench, [[6, 70]], NOW - 2 * DAY),
    ];
    setWorkouts(finished);
    const item = buildPickItems(workout(), finished, null, {}).find((i) => i.name === bench)!;
    render(
      <ExerciseDetail
        item={item}
        items={[item]}
        gym={null}
        finished={finished}
        onPick={() => undefined}
        onSwap={() => undefined}
      />,
    );
    expect(screen.getByText(en().pickHistoryN(3))).toBeTruthy();
    expect(document.querySelector('.xp-hist b')!.textContent).toMatch(/^Last .*70.*· best 70/);
    expect(document.querySelector('.xp-spark polyline')).toBeTruthy();
  });

  it('a single past session shows history but no sparkline', () => {
    const finished = [done('h1', bench, [[8, 60]], NOW - 5 * DAY)];
    setWorkouts(finished);
    const item = buildPickItems(workout(), finished, null, {}).find((i) => i.name === bench)!;
    render(
      <ExerciseDetail
        item={item}
        items={[item]}
        gym={null}
        finished={finished}
        onPick={() => undefined}
        onSwap={() => undefined}
      />,
    );
    expect(screen.getByText(en().pickHistoryN(1))).toBeTruthy();
    expect(document.querySelector('.xp-spark')).toBeNull();
  });

  it('exercises done in this session say so', () => {
    const w = workout({
      exercises: [
        {
          id: 'x',
          name: bench,
          position: 0,
          sets: [{ id: 's', reps: 5, weight: 100, isWarmup: false }],
        } as never,
      ],
    });
    const item = buildPickItems(w, [], null, {}).find((i) => i.name === bench)!;
    render(
      <ExerciseDetail
        item={item}
        items={[item]}
        gym={null}
        finished={[]}
        onPick={() => undefined}
        onSwap={() => undefined}
      />,
    );
    expect(document.querySelector('.xp-detail .xp-done')!.textContent).toMatch(/again\?$/);
  });

  it('lists up to two same-muscle swaps and swapping reports the choice', () => {
    const all = items();
    const item = pickItem(bench);
    const onSwap = vi.fn();
    render(
      <ExerciseDetail
        item={item}
        items={all}
        gym={null}
        finished={[]}
        onPick={() => undefined}
        onSwap={onSwap}
      />,
    );
    const rows = document.querySelectorAll('.xp-swaps button');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(2);
    fireEvent.click(rows[0]);
    expect(onSwap).toHaveBeenCalledTimes(1);
    expect(onSwap.mock.calls[0][0].key).not.toBe(item.key);
  });

  it('loads the cues: two by default (one when compact), then all with the toggle', async () => {
    const item = pickItem(bench);
    const { rerender } = render(
      <ExerciseDetail
        item={item}
        items={items()}
        gym={null}
        finished={[]}
        onPick={() => undefined}
        onSwap={() => undefined}
      />,
    );
    await act(async () => void (await Promise.resolve()));
    expect(document.querySelectorAll('.xp-cues li')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: en().pickAllSteps(3) }));
    expect(document.querySelectorAll('.xp-cues li')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: en().pickFewerSteps }));
    expect(document.querySelectorAll('.xp-cues li')).toHaveLength(2);
    rerender(
      <ExerciseDetail
        item={item}
        items={items()}
        gym={null}
        finished={[]}
        compact
        onPick={() => undefined}
        onSwap={() => undefined}
      />,
    );
    await act(async () => void (await Promise.resolve()));
    expect(document.querySelectorAll('.xp-cues li')).toHaveLength(1);
    expect(document.querySelector('.xp-add kbd')!.textContent).toBe('↵');
  });

  it('Add and Back call their handlers; Back is absent without onBack', () => {
    const item = pickItem(bench);
    const onPick = vi.fn();
    const onBack = vi.fn();
    const a = render(
      <ExerciseDetail
        item={item}
        items={items()}
        gym={null}
        finished={[]}
        onPick={onPick}
        onSwap={() => undefined}
        onBack={onBack}
        addLabel="Put it in"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Put it in' }));
    expect(onPick).toHaveBeenCalledWith(item);
    fireEvent.click(screen.getByRole('button', { name: en().backAction }));
    expect(onBack).toHaveBeenCalled();
    a.unmount();
    render(
      <ExerciseDetail
        item={item}
        items={items()}
        gym={null}
        finished={[]}
        onPick={onPick}
        onSwap={() => undefined}
      />,
    );
    expect(screen.queryByRole('button', { name: en().backAction })).toBeNull();
  });

  it("for a machine lift in a saved gym it reads that gym's history", () => {
    const machine = items().find((i) => i.equipment === 'machine')!;
    const finished = [
      done('h1', machine.name, [[10, 40]], NOW - 4 * DAY),
      done('h2', machine.name, [[10, 45]], NOW - 2 * DAY),
    ];
    setWorkouts(finished);
    const it2 = buildPickItems(workout(), finished, gym(['machine']), {}).find(
      (i) => i.name === machine.name,
    )!;
    render(
      <ExerciseDetail
        item={it2}
        items={[it2]}
        gym={gym(['machine'])}
        finished={finished}
        onPick={() => undefined}
        onSwap={() => undefined}
      />,
    );
    expect(document.querySelector('.xp-detail-name')).toBeTruthy();
  });
});
