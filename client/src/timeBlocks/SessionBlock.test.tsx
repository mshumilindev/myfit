import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Shell } from '../App';
import { addonsPref } from '../addons/enabledSet';
import { COACH_DEFAULT } from '../atlas/types';
import { emptyCycleState } from '../cycle/cycleState';
import { __getStateForTests, __replaceStateForTests } from '../store';
import type { Workout } from '../types';
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
function seed(blocks: WorkoutBlock[]) {
  const w: Workout = {
    id: 'open',
    startedAt: NOW - 600000,
    finishedAt: null,
    autoFinished: false,
    exercises: [],
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
const mount = () => render(<SessionView workoutId="open" shell={shell()} onClose={vi.fn()} />);

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
    await userEvent.click(screen.getByRole('button', { name: 'Finish' }));
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
});
