import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MuscleHistoryView } from './MuscleHistoryView';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import type { Workout } from '../types';
import {
  DAY,
  emptyState,
  freezeClock,
  makeShell,
  NOW,
  richState,
  seed,
} from './__fixtures__/viewKit';

const ex = (
  id: string,
  name: string,
  primary: string,
  secondary: string[],
  sets: Array<[number, number]>,
) => ({
  id,
  name,
  position: 0,
  kind: 'strength' as const,
  primaryMuscle: primary,
  secondaryMuscles: secondary,
  sets: sets.map(([reps, weight], i) => ({
    id: `${id}-${i}`,
    position: i,
    reps,
    weight,
    isWarmup: false,
  })),
});
const wk = (
  id: string,
  ageDays: number,
  exercises: Workout['exercises'],
  finished = true,
): Workout =>
  ({
    id,
    startedAt: NOW - ageDays * DAY,
    finishedAt: finished ? NOW - ageDays * DAY + 3_600_000 : null,
    autoFinished: false,
    gymId: null,
    exercises,
  }) as Workout;

beforeEach(() => {
  freezeClock();
  setLocale('en');
  seed({ ...emptyState() });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const state = (workouts: Workout[]) => seed({ ...emptyState(), workouts });
const stat = (label: string) =>
  [...document.querySelectorAll('.stat-grid .cell')]
    .find((c) => c.querySelector('.l')?.textContent === label)
    ?.querySelector('.v')?.textContent;

describe('MuscleHistoryView', () => {
  it('with no matching sessions: dashes, zero volume and no exercise list', () => {
    state([wk('a', 2, [ex('e', 'Barbell Squat', 'quads', [], [[5, 100]])])]);
    render(<MuscleHistoryView muscle="chest" shell={makeShell()} onClose={() => undefined} />);
    expect(stat(en.setsStat)).toBe('—');
    expect(stat(en.lastSessionLabel)).toBe('—');
    expect(stat(en.volumeCol)).toBe('0.0 t');
    expect(screen.queryByText(en.topExercises)).toBeNull();
    // an account with no matching session still shows the "since" caption, dangling
    expect(document.querySelector('.uipagehead-sub, [class*="sub"]')?.textContent).toMatch(
      /^0 sessions/,
    );
  });

  it('totals the volume and sets of sessions that hit the muscle as primary or secondary', () => {
    state([
      wk('new', 2, [
        ex(
          'e1',
          'Barbell Bench Press - Medium Grip',
          'chest',
          ['triceps'],
          [
            [10, 80],
            [8, 80],
          ],
        ),
        ex('e2', 'Barbell Squat', 'quads', [], [[5, 100]]),
      ]),
      wk('old', 9, [
        ex(
          'e3',
          'Dips - Triceps Version',
          'triceps',
          ['chest'],
          [
            [10, 0],
            [10, 20],
          ],
        ),
      ]),
    ]);
    render(<MuscleHistoryView muscle="chest" shell={makeShell()} onClose={() => undefined} />);
    // 10*80 + 8*80 = 1440 ; 10*0 + 10*20 = 200 -> 1.6 t, 4 sets
    expect(stat(en.volumeCol)).toBe('1.6 t');
    expect(stat(en.setsStat)).toBe('4');
    expect(stat(en.lastSessionLabel)).toBe('Sep 24');
    expect(screen.getByText(en.nSessionsSince(2, 'Sep 17'))).toBeTruthy();
    // the squat does not count towards chest
    expect(screen.queryByText('Barbell Squat')).toBeNull();
  });

  it('a single session reads "1 session"', () => {
    state([wk('a', 3, [ex('e', 'Barbell Bench Press - Medium Grip', 'chest', [], [[8, 60]])])]);
    render(<MuscleHistoryView muscle="chest" shell={makeShell()} onClose={() => undefined} />);
    expect(screen.getByText(en.oneSession)).toBeTruthy();
  });

  it('ignores unfinished workouts', () => {
    state([
      wk('live', 0, [ex('e', 'Barbell Bench Press - Medium Grip', 'chest', [], [[8, 60]])], false),
    ]);
    render(<MuscleHistoryView muscle="chest" shell={makeShell()} onClose={() => undefined} />);
    expect(stat(en.setsStat)).toBe('—');
  });

  it('ranks exercises by volume and opens their history or the past session', () => {
    const shell = makeShell();
    state([
      wk('s1', 2, [
        ex('a', 'Barbell Bench Press - Medium Grip', 'chest', [], [[10, 100]]),
        ex('b', 'Dumbbell Flyes', 'chest', [], [[12, 20]]),
      ]),
      wk('s2', 6, [ex('c', 'Barbell Bench Press - Medium Grip', 'chest', [], [[10, 100]])]),
    ]);
    const { container } = render(
      <MuscleHistoryView muscle="chest" shell={shell} onClose={() => undefined} />,
    );
    const top = [...container.querySelectorAll('.record-group button')];
    expect(top[0].textContent).toContain('Barbell Bench Press - Medium Grip');
    expect(top[0].textContent).toMatch(/2\D?000 kg/);
    expect(top[1].textContent).toContain('Dumbbell Flyes');
    fireEvent.click(top[0]);
    expect(shell.openOverlay).toHaveBeenLastCalledWith({
      screen: 'exercise-history',
      name: 'Barbell Bench Press - Medium Grip',
    });
    const sessions = [...container.querySelectorAll('.mh-session-list button')];
    expect(sessions).toHaveLength(2);
    expect(sessions[0].textContent).toContain('2 sets');
    fireEvent.click(sessions[0]);
    expect(shell.openOverlay).toHaveBeenLastCalledWith({ screen: 'past-workout', workoutId: 's1' });
  });

  it('shows at most 6 top exercises and the 8 latest sessions', () => {
    const many: Workout[] = Array.from({ length: 10 }, (_, i) =>
      wk(`w${i}`, i + 1, [ex(`e${i}`, `Move ${i}`, 'chest', [], [[10, 10 + i]])]),
    );
    state(many);
    const { container } = render(
      <MuscleHistoryView muscle="chest" shell={makeShell()} onClose={() => undefined} />,
    );
    expect(container.querySelectorAll('.record-group button').length).toBe(6);
    expect(container.querySelectorAll('.mh-session-list button').length).toBe(8);
  });

  it('weekly bars: ten of them, the busiest week full height, quiet weeks at the 4% floor', () => {
    state([wk('a', 1, [ex('e', 'Barbell Bench Press - Medium Grip', 'chest', [], [[10, 100]])])]);
    const { container } = render(
      <MuscleHistoryView muscle="chest" shell={makeShell()} onClose={() => undefined} />,
    );
    const bars = [...container.querySelectorAll('.uibc-bar')] as HTMLElement[];
    expect(bars).toHaveLength(10);
    expect(bars[9].style.height).toBe('100%');
    expect(bars.slice(0, 9).every((b) => b.style.height === '4%')).toBe(true);
  });

  it('back closes the screen; the title names the muscle', () => {
    const onClose = vi.fn();
    state([]);
    render(<MuscleHistoryView muscle="chest" shell={makeShell()} onClose={onClose} />);
    expect(screen.getByText(en.muscleHistoryTitle(en.muscleGroups.chest))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.backAction }));
    expect(onClose).toHaveBeenCalled();
  });

  it('works against a long realistic history', () => {
    seed(richState());
    const { container } = render(
      <MuscleHistoryView muscle="quads" shell={makeShell()} onClose={() => undefined} />,
    );
    expect(container.querySelectorAll('.mh-session-list button').length).toBe(8);
    expect(Number(stat(en.setsStat))).toBeGreaterThan(20);
  });
});
