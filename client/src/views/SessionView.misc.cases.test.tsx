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
    reminders: [],
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

const DAY = 24 * 60 * MIN;
const gym = {
  id: 'g1',
  name: 'Iron Yard',
  lat: 0,
  lng: 0,
  radiusM: 100,
  inventory: ['dumbbell'],
  equipmentItems: ['dumbbell-fixed'],
};
const benchAt = (id: string, daysAgo: number): Workout =>
  wk(id, [ex('b', 'Bench press', [set('x1')])], {
    gymId: 'g1',
    startedAt: NOW - daysAgo * DAY,
    finishedAt: NOW - daysAgo * DAY + 50 * MIN,
  });
const liveAtGym = () =>
  wk('open', [ex('bench', 'Bench press', [set('s1', { loggedAt: NOW - 5 * MIN })])], {
    gymId: 'g1',
  });

describe('SessionView · gym kit prompt', () => {
  it('after a set, offers the kit the lift used that the gym list lacks, with the proof', () => {
    seed([liveAtGym(), benchAt('p1', 3), benchAt('p2', 6)], { gyms: [gym] });
    const { container } = mount();
    const tray = container.querySelector('.gk-float-wrap') as HTMLElement;
    expect(tray.textContent).toContain('Olympic barbell (20 kg) isn’t on Iron Yard’s list');
    expect(tray.textContent).toContain('Seen in 3 sessions here');
  });

  it('Add puts it on the gym list and says so', async () => {
    seed([liveAtGym(), benchAt('p1', 3), benchAt('p2', 6)], { gyms: [gym] });
    const { container } = mount();
    await userEvent.click(
      within(container.querySelector('.gk-float-wrap') as HTMLElement).getByRole('button', {
        name: 'Add',
      }),
    );
    expect(__getStateForTests().gyms[0].equipmentItems).toContain('barbell-olympic');
    expect(container.querySelector('.gk-float-wrap')!.textContent).toContain('Added to Iron Yard');
  });

  it('Dismiss hides it for the rest of the session', async () => {
    seed([liveAtGym(), benchAt('p1', 3), benchAt('p2', 6)], { gyms: [gym] });
    const { container } = mount();
    await userEvent.click(
      within(container.querySelector('.gk-float-wrap') as HTMLElement).getByRole('button', {
        name: 'Dismiss',
      }),
    );
    expect(container.querySelector('.gk-float-wrap')).toBeNull();
    expect(__getStateForTests().gyms[0].equipmentItems).toEqual(['dumbbell-fixed']);
  });

  it('is silent with only one session of proof', () => {
    seed([liveAtGym()], { gyms: [{ ...gym }] });
    const { container } = mount();
    expect(container.querySelector('.gk-float-wrap')).toBeNull();
  });
});

describe('SessionView · home sessions', () => {
  it('adds a home move from the home picker with its own measure', async () => {
    seed([wk('open', [ex('pl', 'Plank', [], { measure: 'hold' })], { kind: 'home' })]);
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
    await userEvent.click(screen.getByRole('button', { name: /^Stomach Vacuum/ }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getAllByRole('button', { name: /^Add/ }).at(-1)!,
    );
    const added = mine().exercises.find((e) => e.id !== 'pl')!;
    expect(added.name).toBe('Stomach Vacuum');
    expect(added.measure).toBe('hold');
  });
});

describe('SessionView · a record set in a past session', () => {
  it('toasts the new record when a heavier set is added there', async () => {
    const past = {
      ...wk('open', [ex('bench', 'Bench press', [set('s1', { weight: 80 })])]),
      finishedAt: NOW - 5 * MIN,
    };
    seed([past, fin70()]);
    const { sh } = mount('open', shell(), { past: true });
    await userEvent.click(screen.getByRole('button', { name: /^Bench press1 × 8/ }));
    const w = screen.getByRole('group', { name: 'Weight, kg' });
    await userEvent.click(w.querySelectorAll('button')[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(sh.toast).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sh.toast).mock.calls[0][0]).toMatchObject({
      kind: 'ok',
      text: 'New record · Bench press 82.5 kg × 8',
    });
    expect(mine().exercises[0].sets).toHaveLength(2);
  });
});
function fin70(): Workout {
  return wk('h70', [ex('b', 'Bench press', [set('x1', { weight: 70 })])], {
    startedAt: NOW - 9 * DAY,
    finishedAt: NOW - 9 * DAY + 50 * MIN,
  });
}

// Sheets leave a 160 ms focus-settle timer behind; let it fire before the jsdom window goes away.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 250)));
