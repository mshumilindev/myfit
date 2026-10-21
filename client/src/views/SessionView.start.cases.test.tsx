import { cleanup, render, screen } from '@testing-library/react';
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

const DAY = 86400000;
/** A finished session `ago` days back with one exercise of two working sets. */
const hist = (id: string, ago: number, name: string, dayName?: string): Workout => ({
  id,
  startedAt: NOW - ago * DAY,
  finishedAt: NOW - ago * DAY + 3600000,
  autoFinished: false,
  ...(dayName ? { dayName } : {}),
  exercises: [
    ex('e' + id, name, [
      set(id + '1', { loggedAt: NOW - ago * DAY + 600000 }),
      set(id + '2', { loggedAt: NOW - ago * DAY + 900000 }),
    ]),
  ],
});
const empty = () => wk('open', [], { startedAt: NOW - 60000 });
const names = () => mine().exercises.map((e) => e.name);

describe('SessionView · starting a blank session', () => {
  it('without history proposes a science-based first session: warm-up first, four lifts after', () => {
    seed([empty()]);
    const { container } = mount();
    expect(container.querySelector('.es-ready-line')!.textContent).toContain('fresh start');
    expect(container.querySelector('.es-hero.warm .es-hero-name')!.textContent).toBe('Warm-up');
    expect(container.querySelectorAll('.es-tile')).toHaveLength(4);
    expect(container.querySelector('.es-circuit')).toBeTruthy();
    // nothing is added until you tap
    expect(mine().exercises).toHaveLength(0);
  });

  it('with same-weekday history leads with what you usually open with and reports readiness', () => {
    seed([
      empty(),
      hist('h1', 7, 'Bench press', 'Push'),
      hist('h2', 14, 'Bench press', 'Push'),
      hist('h3', 3, 'Squat'),
    ]);
    const { container } = mount();
    expect(container.querySelector('.es-kicker')!.textContent).toBe('USUALLY 1st · WEDNESDAY');
    expect(container.querySelector('.es-hero-name')!.textContent).toBe('Bench press');
    expect(container.querySelector('.es-hero-sub')!.textContent).toBe(
      'Last time 80.0 kg × 8 · aim 80.0 kg × 9',
    );
    const cards = [...container.querySelectorAll('.es-rc')].map(
      (c) => c.querySelector('.es-rc-name')!.textContent,
    );
    expect(cards).toContain('Chest');
    expect(container.querySelector('.es-ready-line')!.textContent).toContain('all recovered');
  });

  it('says a muscle is still recovering when it was trained hard yesterday', () => {
    const hard = hist('hy', 1, 'Bench press');
    hard.exercises[0].sets = Array.from({ length: 10 }, (_, i) =>
      set('hy' + i, { reps: 10, weight: 100, loggedAt: NOW - DAY + 600000 + i * 120000 }),
    );
    seed([
      empty(),
      hard,
      hist('h1', 7, 'Bench press', 'Push'),
      hist('h2', 14, 'Bench press', 'Push'),
    ]);
    const { container } = mount();
    expect(container.querySelector('.es-ready-line')!.textContent).toMatch(/recovering/i);
  });

  it('tapping the hero with a learned weekday offers the whole playbook day and applies it', async () => {
    seed([empty(), hist('h1', 7, 'Bench press', 'Push'), hist('h2', 14, 'Bench press', 'Push')]);
    const { container } = mount();
    await userEvent.click(container.querySelector('.es-hero-main') as HTMLElement);
    const sheet = document.querySelector('.pb-sheet') as HTMLElement;
    expect(sheet.querySelector('.pbs-card-head b')!.textContent).toContain('Push');
    expect(sheet.querySelectorAll('.pbs-row')).toHaveLength(1);
    expect(sheet.querySelector('.pbs-row b')!.textContent).toBe('Bench press');
    await userEvent.click(sheet.querySelector('.pbs-apply') as HTMLElement);
    expect(names()).toEqual(['Bench press']);
    expect(mine().exercises[0].plannedSets).toBe(2);
    expect(document.querySelector('.pb-sheet')).toBeNull();
  });

  it('"Just this" in the playbook sheet starts only the hero exercise', async () => {
    seed([empty(), hist('h1', 7, 'Bench press', 'Push'), hist('h2', 14, 'Bench press', 'Push')]);
    const { container } = mount();
    await userEvent.click(container.querySelector('.es-hero-main') as HTMLElement);
    await userEvent.click(document.querySelector('.pbs-custom') as HTMLElement);
    expect(names()).toEqual(['Bench press']);
    expect(mine().exercises[0].plannedSets).toBeNull();
  });

  it('with a single past session the hero starts straight away with that lift (no playbook yet)', async () => {
    seed([empty(), hist('h1', 7, 'Bench press')]);
    const { container } = mount();
    await userEvent.click(container.querySelector('.es-hero-main') as HTMLElement);
    expect(document.querySelector('.pb-sheet')).toBeNull();
    expect(names()).toEqual(['Bench press']);
  });

  it('a tile adds its exercise, and starting the first exercise restarts the session clock', async () => {
    seed([empty()]);
    const { container } = mount();
    const tile = container.querySelector('.es-tile .es-tile-main') as HTMLElement;
    const pick = tile.querySelector('.es-tile-name')!.textContent!;
    await userEvent.click(tile);
    expect(names()).toEqual([pick]);
    expect(mine().startedAt).toBe(NOW);
    expect(container.querySelector('.es-hero')).toBeNull();
  });

  it('the Details button on a tile opens the exercise details without adding it', async () => {
    seed([
      empty(),
      hist('h1', 7, 'Bench press', 'Push'),
      hist('h2', 14, 'Bench press', 'Push'),
      hist('h3', 3, 'Squat'),
    ]);
    const { container } = mount();
    await userEvent.click(container.querySelector('.es-info') as HTMLElement);
    expect(screen.getByRole('button', { name: 'Add to session' })).toBeTruthy();
    expect(mine().exercises).toHaveLength(0);
  });

  it('the pinned Add exercise opens the picker, and the circuit shortcut opens it in circuit mode', async () => {
    seed([empty()]);
    const { container } = mount();
    await userEvent.click(container.querySelector('.es-add') as HTMLElement);
    expect(screen.getByPlaceholderText('Search by name, muscle or equipment')).toBeTruthy();
    cleanup();
    seed([empty()]);
    const again = mount();
    await userEvent.click(again.container.querySelector('.es-circuit-go') as HTMLElement);
    expect(screen.getByPlaceholderText('Search by name, muscle or equipment')).toBeTruthy();
  });
});

// Sheets leave a 160 ms focus-settle timer behind; let it fire before the jsdom window goes away.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 250)));
