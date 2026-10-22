import { act, cleanup, render, screen, within } from '@testing-library/react';
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

const treadmill = (sets: SetEntry[] = []) =>
  wk('open', [
    ex('tm', 'Treadmill', sets, { kind: 'cardio', equipmentItems: ['cardio-treadmill'] }),
  ]);
const run = (id: string, o: Partial<SetEntry> = {}) =>
  set(id, {
    reps: 0,
    weight: null,
    durationMin: 20,
    distanceKm: 3,
    speedKmh: 9,
    inclinePct: 1,
    loggedAt: NOW - 10 * MIN,
    ...o,
  });
const entries = () => mine().exercises[0].sets;

describe('SessionView · timed (cardio) entries', () => {
  const pastTreadmill = (sets: SetEntry[]) => ({ ...treadmill(sets), finishedAt: NOW - 5 * MIN });

  it('editing a past session: Add repeats the last entry with its console readings', async () => {
    seed([pastTreadmill([run('s1')])]);
    mount('open', shell(), { past: true });
    await userEvent.click(screen.getByRole('button', { name: 'Treadmill20 min' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(entries()).toHaveLength(2);
    expect(entries()[1]).toMatchObject({
      durationMin: 20,
      distanceKm: 3,
      speedKmh: 9,
      inclinePct: 1,
      reps: 0,
    });
  });

  it('in a past session a first entry proposes twenty minutes and two kilometres on a machine with a distance console', async () => {
    seed([pastTreadmill([])]);
    mount('open', shell(), { past: true });
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(entries()[0]).toMatchObject({ durationMin: 20, distanceKm: 2 });
  });

  it('the stopwatch logs the measured minutes on Stop and opens the entry for the console readings', async () => {
    seed([treadmill([run('s1')])]);
    mount();
    await userEvent.click(screen.getByRole('button', { name: /^Start · interval 2/ }));
    expect(JSON.parse(localStorage.getItem('spotter.session.timing')!)).toMatchObject({
      workoutId: 'open',
      exId: 'tm',
      startedAt: NOW,
    });
    act(() => vi.setSystemTime(NOW + 12.5 * MIN));
    await userEvent.click(screen.getByRole('button', { name: /Stop/ }));
    expect(entries()).toHaveLength(2);
    expect(entries()[1]).toMatchObject({ durationMin: 12.5, reps: 0, weight: null });
    expect(localStorage.getItem('spotter.session.timing')).toBeNull();
    expect(within(screen.getByRole('dialog')).getByText('Entry 2 · Treadmill')).toBeTruthy();
  });

  it('an interval just over six seconds is kept, rounded to a tenth of a minute', async () => {
    seed([treadmill([run('s1')])]);
    mount();
    await userEvent.click(screen.getByRole('button', { name: /^Start · interval 2/ }));
    act(() => vi.setSystemTime(NOW + 7000));
    await userEvent.click(screen.getByRole('button', { name: /Stop/ }));
    expect(entries()).toHaveLength(2);
    expect(entries()[1].durationMin).toBe(0.1);
  });

  it('a stray tap under six seconds is cancelled without logging anything', async () => {
    seed([treadmill([run('s1')])]);
    mount();
    await userEvent.click(screen.getByRole('button', { name: /^Start · interval 2/ }));
    act(() => vi.setSystemTime(NOW + 3000));
    await userEvent.click(screen.getByRole('button', { name: /Stop/ }));
    expect(entries()).toHaveLength(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('an interval started before a reload keeps running for the same workout', () => {
    localStorage.setItem(
      'spotter.session.timing',
      JSON.stringify({ workoutId: 'open', exId: 'tm', startedAt: NOW - 5 * MIN }),
    );
    seed([treadmill([run('s1')])]);
    const { container } = mount();
    expect(container.querySelector('.tt-count')!.textContent).toBe('5:00');
  });

  it('an interval of another workout is ignored', () => {
    localStorage.setItem(
      'spotter.session.timing',
      JSON.stringify({ workoutId: 'other', exId: 'tm', startedAt: NOW - 5 * MIN }),
    );
    seed([treadmill([run('s1')])]);
    const { container } = mount();
    expect(container.querySelector('.tt-count')).toBeNull();
  });

  it('"Log without the timer" opens the empty entry to type minutes by hand', async () => {
    seed([treadmill([run('s1')])]);
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Log without the timer' }));
    const dlg = screen.getByRole('dialog');
    expect(within(dlg).getByText('Entry 2 · Treadmill')).toBeTruthy();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Log' }));
    expect(entries()).toHaveLength(2);
    expect(entries()[1].durationMin).toBe(20);
  });
});

// Sheets leave a 160 ms focus-settle timer behind; let it fire before the jsdom window goes away.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 250)));
