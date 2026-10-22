import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Shell } from '../App';
import { COACH_DEFAULT } from '../atlas/types';
import { emptyCycleState } from '../cycle/cycleState';
import { __getStateForTests, __replaceStateForTests } from '../store';
import type { Exercise, SetEntry, Workout } from '../types';
import { SessionView } from './SessionView';

// Wednesday 14 Oct 2026, 18:00 local — fixed wall clock, only Date is faked so timers/userEvent keep running.
const NOW = new Date(2026, 9, 14, 18, 0).getTime();
const MIN = 60000;

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
const set = (id: string, o: Partial<SetEntry> = {}): SetEntry => ({
  id,
  reps: 8,
  weight: 80,
  isWarmup: false,
  position: Number(id.replace(/\D/g, '')) || 0,
  ...o,
});
const ex = (id: string, name: string, sets: SetEntry[], o: Partial<Exercise> = {}): Exercise => ({
  id,
  name,
  kind: 'strength',
  position: 0,
  sets,
  ...o,
});
const wk = (id: string, exercises: Exercise[], o: Partial<Workout> = {}): Workout => ({
  id,
  startedAt: NOW - 30 * MIN,
  finishedAt: null,
  autoFinished: false,
  exercises,
  ...o,
});
function seed(workouts: Workout[], extra: Record<string, unknown> = {}) {
  __replaceStateForTests({
    ...__getStateForTests(),
    workouts,
    activities: [],
    sleeps: [],
    gyms: [],
    queue: [],
    coach: { ...COACH_DEFAULT },
    cycle: emptyCycleState(),
    ...extra,
  });
}
const mine = (id = 'open') => __getStateForTests().workouts.find((w) => w.id === id)!;
function mount(id = 'open', sh: Shell = shell(), extra: { past?: boolean } = {}) {
  const onClose = vi.fn();
  const r = render(<SessionView workoutId={id} shell={sh} onClose={onClose} {...extra} />);
  return { ...r, onClose, sh };
}

beforeEach(() => {
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
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const benchLive = () =>
  wk('open', [ex('bench', 'Bench press', [set('s1', { loggedAt: NOW - 10 * MIN })])]);
const names = () => mine().exercises.map((e) => e.name);
const added = () => mine().exercises.find((e) => e.id !== 'bench')!;
const openPicker = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
  return screen.getByRole('dialog');
};

describe('SessionView · adding exercises', () => {
  it('a name the catalog does not know can be created with its muscles and equipment', async () => {
    seed([benchLive()]);
    mount();
    const dlg = await openPicker();
    await userEvent.type(within(dlg).getByRole('searchbox'), 'Zxq pulldown');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Create “Zxq pulldown”' }));
    const sheet = document.querySelector('.new-exercise-sheet') as HTMLElement;
    expect(sheet).toBeTruthy();
    await userEvent.click(within(sheet).getAllByRole('button', { name: /Biceps/ })[0]);
    // The second chip row (secondary muscles) no longer lists the primary one.
    await userEvent.click(within(sheet).getAllByRole('button', { name: /Forearms/ })[1]);
    await userEvent.click(within(sheet).getByRole('button', { name: /Dumbbell/ }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Create “Zxq pulldown”' }));
    expect(added()).toMatchObject({
      name: 'Zxq pulldown',
      kind: 'strength',
      primaryMuscle: 'biceps',
      secondaryMuscles: ['forearms'],
      equipment: ['dumbbell'],
    });
  });

  it('Back from the new-exercise form returns to the picker without adding anything', async () => {
    seed([benchLive()]);
    mount();
    const dlg = await openPicker();
    await userEvent.type(within(dlg).getByRole('searchbox'), 'Zxq pulldown');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Create “Zxq pulldown”' }));
    await userEvent.click(
      within(document.querySelector('.new-exercise-sheet') as HTMLElement).getAllByRole('button', {
        name: 'Back',
      })[0],
    );
    expect(document.querySelector('.new-exercise-sheet')).toBeNull();
    expect(names()).toEqual(['Bench press']);
  });

  it("Cardio asks which machine and adds the exercise with that machine's profile", async () => {
    seed([benchLive()]);
    mount();
    const dlg = await openPicker();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cardio' }));
    expect(screen.getByText('Which machine?')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Treadmill/ }));
    expect(added()).toMatchObject({
      name: 'Treadmill',
      kind: 'cardio',
      equipmentItems: ['cardio-treadmill'],
    });
  });

  it('Warm-up adds a marker instead of a lift', async () => {
    seed([benchLive()]);
    mount();
    const dlg = await openPicker();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Warm-up' }));
    expect(added()).toMatchObject({ kind: 'warmup', sets: [] });
  });

  it('Change machine swaps the machine and the name of a cardio exercise', async () => {
    seed([
      wk('open', [
        ex('tm', 'Treadmill', [], { kind: 'cardio', equipmentItems: ['cardio-treadmill'] }),
      ]),
    ]);
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Change machine' }));
    await userEvent.click(screen.getByRole('button', { name: 'Rowing erg' }));
    expect(mine().exercises[0]).toMatchObject({
      name: 'Rowing erg',
      equipmentItems: ['cardio-rower'],
    });
  });
});

// Sheets leave a 160 ms focus-settle timer behind; let it fire before the jsdom window goes away.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 250)));
