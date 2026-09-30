import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { WarmupCard } from './WarmupCard';
import {
  __getStateForTests,
  __replaceStateForTests,
  addExercise,
  startWorkout,
  useStore,
} from '../store';
import { setLocale } from '../i18n';
import { warmupItemsOf } from '../warmupLog';
import type { Workout } from '../types';

function Harness({ wid, eid }: { wid: string; eid: string }) {
  const { workouts } = useStore();
  const w = workouts.find((x) => x.id === wid)!;
  const ex = w.exercises.find((e) => e.id === eid)!;
  return <WarmupCard workout={w} exercise={ex} muscles={['chest', 'shoulders']} />;
}

const cur = (wid: string, eid: string) =>
  __getStateForTests()
    .workouts.find((w) => w.id === wid)!
    .exercises.find((e) => e.id === eid)!;

function setup(seedHistory: Workout[] = []) {
  __replaceStateForTests({ ...__getStateForTests(), workouts: seedHistory });
  const w = startWorkout(null)!;
  const ex = addExercise(w.id, 'Warm-up', 'warmup');
  render(<Harness wid={w.id} eid={ex.id} />);
  return { wid: w.id, eid: ex.id };
}

beforeEach(() => setLocale('en'));
afterEach(cleanup);

describe('WarmupCard', () => {
  it('starts as the single warm-up: minutes stepper, no checklist', () => {
    const { wid, eid } = setup();
    expect(screen.getByRole('group', { name: 'Warm-up type' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'One warm-up' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    const minutes = screen.getByRole('group', { name: 'Minutes' });
    expect(screen.queryByText('Add exercise')).toBeNull();
    fireEvent.click(within(minutes).getByRole('button', { name: '+' }));
    expect(cur(wid, eid).plannedDurationMin).toBe(1);
    expect(cur(wid, eid).warmupDetailed).toBeUndefined();
  });

  it('"By exercises": add from a suggestion, tick it off, remove it', () => {
    const { wid, eid } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'By exercises' }));
    expect(cur(wid, eid).warmupDetailed).toBe(true);
    expect(screen.getByText('Add what you did, or tap a suggestion.')).toBeTruthy();
    expect(screen.getByText('Suggested for today')).toBeTruthy();

    const chips = screen.getAllByRole('button').filter((b) => b.classList.contains('uichip'));
    expect(chips.length).toBeGreaterThan(0);
    const label = chips[0].textContent!;
    fireEvent.click(chips[0]);
    const items = warmupItemsOf(cur(wid, eid));
    expect(items).toHaveLength(1);
    expect(items[0].done).toBe(false);
    // The added suggestion leaves the suggestions row
    expect(screen.getAllByText(label.trim())).toHaveLength(1);

    const box = screen.getByRole('checkbox');
    fireEvent.click(box);
    expect(warmupItemsOf(cur(wid, eid))[0].done).toBe(true);
    expect(screen.getByText('1 / 1 done')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^Edit / }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove from warm-up' }));
    expect(warmupItemsOf(cur(wid, eid))).toHaveLength(0);
  });

  it('adds a custom name through the picker and keeps the single mode intact', () => {
    const { wid, eid } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'By exercises' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
    fireEvent.change(screen.getByPlaceholderText('Search stretches and mobility'), {
      target: { value: 'Couch stretch deluxe' },
    });
    fireEvent.click(screen.getByText('Add “Couch stretch deluxe”'));
    expect(warmupItemsOf(cur(wid, eid)).map((i) => i.name)).toEqual(['Couch stretch deluxe']);

    fireEvent.click(screen.getByRole('button', { name: 'One warm-up' }));
    expect(cur(wid, eid).warmupDetailed).toBe(false);
    expect(screen.getByRole('group', { name: 'Minutes' })).toBeTruthy();
    expect(cur(wid, eid).sets).toEqual([]);
  });

  it('picker finds catalog stretches by search and adds them with their id', () => {
    const { wid, eid } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'By exercises' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
    fireEvent.change(screen.getByPlaceholderText('Search stretches and mobility'), {
      target: { value: 'cat stretch' },
    });
    fireEvent.click(screen.getByText('Cat Stretch'));
    expect(warmupItemsOf(cur(wid, eid))[0]).toMatchObject({
      name: 'Cat Stretch',
      exerciseId: 'Cat_Stretch',
    });
  });

  it('offers "Repeat last warm-up" from a finished session and copies its items undone', () => {
    const t0 = Date.UTC(2026, 8, 20, 9);
    const old: Workout = {
      id: 'old',
      startedAt: t0,
      finishedAt: t0 + 3600_000,
      autoFinished: false,
      exercises: [
        {
          id: 'm',
          name: 'Warm-up',
          kind: 'warmup',
          position: 0,
          sets: [],
          warmupDetailed: true,
          warmupItems: [
            { id: 'a', name: 'Arm Circles', reps: 10, done: true },
            { id: 'b', name: 'Cat Stretch', durationSec: 60, done: true },
          ],
        },
      ],
    };
    const { wid, eid } = setup([old]);
    const btn = screen.getByRole('button', { name: /Repeat last warm-up · 2 exercises · 1 min/ });
    act(() => {
      fireEvent.click(btn);
    });
    const items = warmupItemsOf(cur(wid, eid));
    expect(items.map((i) => [i.name, i.done])).toEqual([
      ['Arm Circles', false],
      ['Cat Stretch', false],
    ]);
    expect(items[0].id).not.toBe('a');
    expect(screen.queryByRole('button', { name: /Repeat last warm-up/ })).toBeNull();
  });
});
