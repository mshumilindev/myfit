import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __getStateForTests, __replaceStateForTests } from '../store';
import type { SetEntry, Workout } from '../types';
import { SessionMuscleMap } from './SessionMuscleMap';

const DAY = 86400000;
// Wednesday 14 Oct 2026, 18:00 local.
const NOW = new Date(2026, 9, 14, 18, 0).getTime();

const sets = (n: number, prefix: string, at: number): SetEntry[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i}`,
    reps: 8,
    weight: 80,
    isWarmup: false,
    position: i,
    loggedAt: at + i * 120000,
  }));
function wk(
  id: string,
  startedAt: number,
  finished: boolean,
  name: string,
  n: number,
  extra: Partial<Workout> = {},
): Workout {
  return {
    id,
    startedAt,
    finishedAt: finished ? startedAt + 3600000 : null,
    autoFinished: false,
    exercises: [
      { id: id + 'e', name, kind: 'strength', position: 0, sets: sets(n, id, startedAt) },
    ],
    ...extra,
  };
}
function seed(workouts: Workout[]) {
  __replaceStateForTests({ ...__getStateForTests(), workouts });
}
const group = (label: string) =>
  [...document.querySelectorAll('.mm-group')].find(
    (g) => g.querySelector('.mm-group-label')!.textContent === label,
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SessionMuscleMap', () => {
  it('with no history and no sets says everything is covered and shows the legend', () => {
    const today = wk('t', NOW - 10 * 60000, false, 'Bench press', 0);
    seed([today]);
    render(<SessionMuscleMap workout={today} now={NOW} onClose={vi.fn()} />);
    expect(screen.getByText('Today’s muscle map')).toBeTruthy();
    expect(document.querySelector('.mm-covered')).toBeTruthy();
    expect(document.querySelector('.mm-hints')).toBeNull();
    expect(document.querySelectorAll('.vol-leg')).toHaveLength(4);
  });

  it("lists what is left from this weekday's typical session, biggest gap first", () => {
    const past = [7, 14, 21].map((d, i) => wk('p' + i, NOW - d * DAY, true, 'Bench press', 12));
    const today = wk('t', NOW - 20 * 60000, false, 'Bench press', 4);
    seed([today, ...past]);
    render(<SessionMuscleMap workout={today} now={NOW} onClose={vi.fn()} />);
    const todo = document.querySelector('.mm-group')!;
    expect(todo.querySelector('.mm-group-label')!.textContent).toBe('Still worth doing today');
    expect(todo.textContent).toContain('Chest');
    expect(todo.textContent).toMatch(/8 sets left/);
    expect(document.querySelector('.mm-covered')).toBeNull();
  });

  it('eases off a muscle over its weekly limit and one near it, with days to settle', () => {
    const yday = wk('y', NOW - DAY, true, 'Bench press', 20);
    const today = wk('t', NOW - 20 * 60000, false, 'Bench press', 20);
    seed([today, yday]);
    render(<SessionMuscleMap workout={today} now={NOW} onClose={vi.fn()} />);
    const ease = group('Ease off')!;
    expect(ease.textContent).toContain('Chestover weekly limit · eases in ~3 d');
    expect(ease.textContent).toContain('Tricepsnear weekly limit · eases in ~1 d');
    expect(document.querySelector('.mm-done')!.textContent).toBe('Done today: Shoulders');
    expect(group('Still worth doing today')).toBeUndefined();
    expect(document.querySelector('.mm-covered')).toBeNull();
  });

  it('still lists a muscle that is exactly one set short of the typical session', () => {
    const past = [7, 14, 21].map((d, i) => wk('p' + i, NOW - d * DAY, true, 'Bench press', 12));
    const today = wk('t', NOW - 20 * 60000, false, 'Bench press', 11);
    seed([today, ...past]);
    render(<SessionMuscleMap workout={today} now={NOW} onClose={vi.fn()} />);
    const todo = group('Still worth doing today')!;
    expect(todo.textContent).toMatch(/Chest.*1 set left/);
  });

  it('reports what is done with no other advice when the day went to plan', () => {
    const today = wk('t', NOW - 20 * 60000, false, 'Bench press', 4);
    seed([today]);
    render(<SessionMuscleMap workout={today} now={NOW} onClose={vi.fn()} />);
    expect(document.querySelector('.mm-done')!.textContent).toBe(
      'Done today: Chest, Shoulders, Triceps',
    );
    expect(group('Ease off')).toBeUndefined();
    expect(group('Still worth doing today')).toBeUndefined();
  });

  it('shows a target muscle with no history as planned today', () => {
    const today = wk('t', NOW - 20 * 60000, false, 'Bench press', 0, { targetMuscles: ['biceps'] });
    seed([today]);
    render(<SessionMuscleMap workout={today} now={NOW} onClose={vi.fn()} />);
    expect(group('Still worth doing today')!.textContent).toContain('Bicepsplanned today');
  });

  it('matches the day by program name rather than weekday when the workout has one', () => {
    // Same weekday but a different program day must not set the target.
    const legs = wk('l', NOW - 7 * DAY, true, 'Squat', 12, { dayName: 'Legs' });
    const push = wk('p', NOW - 3 * DAY, true, 'Bench press', 10, { dayName: 'Push' });
    const today = wk('t', NOW - 20 * 60000, false, 'Bench press', 2, { dayName: 'Push' });
    seed([today, legs, push]);
    render(<SessionMuscleMap workout={today} now={NOW} onClose={vi.fn()} />);
    const todo = group('Still worth doing today')!;
    expect(todo.textContent).toContain('Chest');
    expect(todo.textContent).not.toContain('Quads');
  });

  it('opens the muscle history from a row when a handler is given, else the rows are inert', () => {
    const past = wk('p', NOW - 7 * DAY, true, 'Bench press', 12);
    const today = wk('t', NOW - 20 * 60000, false, 'Bench press', 4);
    seed([today, past]);
    const onOpenMuscle = vi.fn();
    const { unmount } = render(
      <SessionMuscleMap workout={today} now={NOW} onClose={vi.fn()} onOpenMuscle={onOpenMuscle} />,
    );
    fireEvent.click(screen.getByText('Chest'));
    expect(onOpenMuscle).toHaveBeenCalledWith('chest');
    unmount();
    render(<SessionMuscleMap workout={today} now={NOW} onClose={vi.fn()} />);
    const row = screen.getByText('Chest').closest('button') as HTMLButtonElement | null;
    expect(row === null || row.disabled).toBe(true);
  });

  it('keeps the grading frozen at open time while the clock moves on', () => {
    const past = wk('p', NOW - 7 * DAY, true, 'Bench press', 12);
    const today = wk('t', NOW - 20 * 60000, false, 'Bench press', 4);
    seed([today, past]);
    const { rerender } = render(<SessionMuscleMap workout={today} now={NOW} onClose={vi.fn()} />);
    const before = document.querySelector('.mm-hints')!.textContent;
    rerender(<SessionMuscleMap workout={today} now={NOW + 20 * DAY} onClose={vi.fn()} />);
    expect(document.querySelector('.mm-hints')!.textContent).toBe(before);
  });
});

// Sheets leave a 160 ms focus-settle timer behind; let it fire before the jsdom window goes away.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 250)));
