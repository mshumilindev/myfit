import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Shell } from '../App';
import { addonsPref } from '../addons/enabledSet';
import { COACH_DEFAULT } from '../atlas/types';
import { emptyCycleState } from '../cycle/cycleState';
import { __getStateForTests, __replaceStateForTests } from '../store';
import type { Exercise, Workout } from '../types';
import { openScope } from '../views/optsNav.testkit';
import { SessionView } from '../views/SessionView';
import './timeBlocksBoot';
import type { WorkoutBlock } from './model';

const NOW = new Date(2026, 9, 14, 18, 0).getTime();
const shell = (): Shell => ({
  openOverlay: vi.fn(),
  replaceOverlay: vi.fn(),
  goTab: vi.fn(),
  goPlaybook: vi.fn(),
  openStart: vi.fn(),
  toast: vi.fn(),
  snack: vi.fn(),
  signOut: vi.fn(),
  queueLength: 0,
});
const block = (o: Partial<WorkoutBlock> = {}): WorkoutBlock => ({
  id: 'b1',
  spec: { fmt: 'amrap', capSec: 720 },
  members: [{ name: 'Pullups', reps: '5' }],
  position: -0.5,
  ...o,
});
const ex = (id: string, name: string, position: number): Exercise => ({
  id,
  name,
  kind: 'strength',
  position,
  sets: [],
});
function seed(blocks: WorkoutBlock[], exercises: Exercise[] = []) {
  const w: Workout = {
    id: 'open',
    startedAt: NOW - 600000,
    finishedAt: null,
    autoFinished: false,
    exercises,
    blocks,
  };
  __replaceStateForTests({
    ...__getStateForTests(),
    workouts: [w],
    activities: [],
    sleeps: [],
    gyms: [],
    queue: [],
    coach: { ...COACH_DEFAULT },
    cycle: emptyCycleState(),
  });
}
const mine = () => __getStateForTests().workouts.find((w) => w.id === 'open')!;
const mount = (sh: Shell = shell()) =>
  render(<SessionView workoutId="open" shell={sh} onClose={vi.fn()} />);

beforeEach(() => {
  addonsPref.set(['advanced-training', 'time-blocks']);
  localStorage.clear();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (q: string) => ({
      matches: false,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
});
afterEach(() => {
  addonsPref.reset();
  cleanup();
});

describe('Time blocks in the session', () => {
  it('shows a ready block with Start and goes into the countdown', async () => {
    seed([block()]);
    mount();
    const card = await screen.findByTestId('block-ready');
    expect(within(card).getByText('12:00')).toBeTruthy();
    await userEvent.click(within(card).getByRole('button', { name: 'Start' }));
    expect(await screen.findByRole('dialog', { name: /get ready/i })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mine().blocks?.[0].run).toBeUndefined();
  });

  it('shows nothing of a stored block while the module is not installed', async () => {
    addonsPref.set([]);
    seed([block()]);
    mount();
    await waitFor(() => expect(screen.queryByTestId('time-blocks')).toBeNull());
    expect(mine().blocks).toHaveLength(1); // the data stays
  });

  it('counts rounds on a running block and logs the result of an ended one', async () => {
    seed([block({ run: { startedAt: Date.now() - 5000, pausedMs: 0, pausedAt: null } })]);
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Round' }));
    expect(mine().blocks?.[0].roundsDone).toBe(1);
    await userEvent.click(
      within(screen.getByRole('timer')).getByRole('button', { name: 'Finish' }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Log result' }));
    await userEvent.click(
      within(await screen.findByTestId('block-result')).getByRole('button', { name: 'Save' }),
    );
    expect(mine().blocks?.[0].result?.rounds).toBe(1);
  });

  it('deletes a logged block after a confirmation', async () => {
    seed([
      block({
        run: { startedAt: NOW - 800000, pausedMs: 0, pausedAt: null, finishedAt: NOW - 80000 },
        result: { rounds: 7, extraReps: 2, savedAt: NOW },
      }),
    ]);
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Delete block' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete block' }),
    );
    expect(mine().blocks).toBeUndefined();
  });

  it('is a step of the focus flow: a segment in the progress, reached with Next, and named on the Next button', async () => {
    seed([block({ position: 0.5 })], [ex('a', 'Bench Press', 0), ex('b', 'Barbell Row', 1)]);
    const { container } = mount();
    await waitFor(() =>
      expect(container.querySelectorAll('.plan-segments > span')).toHaveLength(3),
    );
    expect(container.querySelectorAll('.plan-segments > span.tb')).toHaveLength(1);
    expect(screen.queryByTestId('block-ready')).toBeNull(); // not on it yet
    await userEvent.click(container.querySelector('.focus-next') as HTMLElement);
    expect(await screen.findByTestId('block-ready')).toBeTruthy();
    expect(container.querySelector('.focus-next')!.textContent).toContain('Barbell Row');
  });

  it('moves an exercise into a new block from its options, and Undo puts it back', async () => {
    const sh = shell();
    seed([], [ex('a', 'Bench Press', 0), ex('b', 'Barbell Row', 1)]);
    const { container } = mount(sh);
    await userEvent.click(
      within(container.querySelector('.focus-view') as HTMLElement).getByRole('button', {
        name: 'Set options',
      }),
    );
    const d = screen.getByRole('dialog');
    await openScope(d, 'Exercise');
    await userEvent.click(within(d).getByRole('button', { name: /Time block/ }));
    const sheet = await screen.findByRole('dialog', { name: /New block|Time block/i });
    await userEvent.click(within(sheet).getByRole('button', { name: /Add block/ }));
    await waitFor(() => expect(mine().blocks).toHaveLength(1));
    expect(mine().blocks![0].members.map((m) => m.name)).toEqual(['Bench Press']);
    expect(mine().exercises.map((e) => e.name)).toEqual(['Barbell Row']);
    const snack = (sh.snack as ReturnType<typeof vi.fn>).mock.calls[0][0] as { onUndo: () => void };
    snack.onUndo();
    expect(mine().exercises.map((e) => e.name)).toEqual(['Bench Press', 'Barbell Row']);
    expect(mine().blocks ?? []).toHaveLength(0);
  });
});
