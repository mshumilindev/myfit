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

const done = (o: Partial<Workout> = {}): Workout =>
  wk(
    'done',
    [
      ex('bench', 'Bench press', [
        set('s1', { loggedAt: NOW - 20 * MIN }),
        set('s2', { loggedAt: NOW - 15 * MIN }),
      ]),
      ex('row', 'Cable row', [set('r1', { weight: 50, loggedAt: NOW - 12 * MIN })], {
        position: 1,
      }),
    ],
    { startedAt: NOW - 40 * MIN, finishedAt: NOW - 5 * MIN, ...o },
  );
const gym = { id: 'g1', name: 'Smartfit', lat: 50.45, lng: 30.52, radiusM: 150 };
const rowCard = (c: HTMLElement, id: string) =>
  c.querySelector(`[data-exid="${id}"]`) as HTMLElement;

describe('SessionView · past session editor', () => {
  it('shows the finished day: title, time range, gym link, and exercises as collapsed summaries', () => {
    seed([done()]);
    const { container } = mount('done', shell(), { past: true });
    expect(container.querySelector('.past-hero .title')!.textContent).toBe('Chest');
    expect(container.querySelector('.past-datebar')!.textContent).toBe(
      'Wednesday, October 14, 2026 · 17:20 → 17:55',
    );
    expect(container.querySelector('.past-gym-row')!.textContent).toBe('Add gym');
    expect(container.querySelector('.session-live')).toBeNull();
    const summaries = [...container.querySelectorAll('[data-exid]')].map((e) => e.textContent);
    expect(summaries[0]).toContain('2 × 8 · 80.0 kg');
    expect(summaries[1]).toContain('1 × 8 · 50.0 kg');
    expect(container.querySelector('.mworked-head')!.textContent).toBe('Muscle groups worked');
  });

  it('names the day by its program day when the sessions follow one', () => {
    seed([done({ dayName: 'Push day' })]);
    const { container } = mount('done', shell(), { past: true });
    expect(container.querySelector('.past-hero .title')!.textContent).toBe('Push day');
  });

  it('Save stays disabled until something changes, then saves and closes', async () => {
    seed([done()]);
    const { container, onClose } = mount('done', shell(), { past: true });
    const save = container.querySelector('.past-save') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    // open the first set and bump its weight
    await userEvent.click(rowCard(container, 'bench'));
    await userEvent.click(screen.getByRole('button', { name: /^1880\.0/ }));
    const d = screen.getByRole('dialog');
    await userEvent.click(
      within(d).getByRole('group', { name: 'Weight, kg' }).querySelectorAll('button')[1],
    );
    await userEvent.click(within(d).getByRole('button', { name: 'Save' }));
    expect(mine('done').exercises[0].sets[0].weight).toBe(82.5);
    expect((container.querySelector('.past-save') as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(container.querySelector('.past-save') as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mine('done').exercises[0].sets[0].weight).toBe(82.5);
  });

  it('adds a set to an expanded exercise with the Add button', async () => {
    seed([done()]);
    const { container } = mount('done', shell(), { past: true });
    await userEvent.click(rowCard(container, 'bench'));
    await userEvent.click(within(rowCard(container, 'bench')).getByRole('button', { name: 'Add' }));
    expect(mine('done').exercises[0].sets).toHaveLength(3);
    expect(mine('done').exercises[0].sets[2]).toMatchObject({ reps: 8, weight: 80 });
  });

  it('deleting a workout asks first, then deletes it and closes', async () => {
    seed([done()]);
    const { container, onClose } = mount('done', shell(), { past: true });
    await userEvent.click(container.querySelector('.trash') as HTMLElement);
    const dlg = screen.getByRole('alertdialog');
    expect(dlg.textContent).toContain('Delete this workout?');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Keep' }));
    expect(__getStateForTests().workouts).toHaveLength(1);
    await userEvent.click(container.querySelector('.trash') as HTMLElement);
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    expect(__getStateForTests().workouts.find((w) => w.id === 'done')).toBeUndefined();
    expect(onClose).toHaveBeenCalled();
  });

  it('attaches a gym to the session from the gym row', async () => {
    seed([done()], { gyms: [gym] });
    const { container } = mount('done', shell(), { past: true });
    await userEvent.click(container.querySelector('.past-gym-row') as HTMLElement);
    await userEvent.click(await screen.findByText('Smartfit'));
    expect(mine('done').gymId).toBe('g1');
    expect(container.querySelector('.past-gym-row')!.textContent).toBe('Smartfit');
  });

  it('adds an exercise to the past session from the picker', async () => {
    seed([done()]);
    const { container } = mount('done', shell(), { past: true });
    await userEvent.click(screen.getByRole('button', { name: 'Add exercise to this session' }));
    await userEvent.type(
      screen.getByPlaceholderText('Search by name, muscle or equipment'),
      'barbell curl',
    );
    await userEvent.click(document.querySelector('.xp-row .xp-row-main') as HTMLElement);
    expect(mine('done').exercises).toHaveLength(3);
    expect(container.querySelectorAll('[data-exid]')).toHaveLength(3);
  });

  it('moves an exercise down from its menu on a phone', async () => {
    seed([done()]);
    const { container } = mount('done', shell(), { past: true });
    await userEvent.click(
      within(rowCard(container, 'bench')).getByRole('button', { name: 'Menu' }),
    );
    await userEvent.click(screen.getByRole('button', { name: /Move down/ }));
    expect(mine('done').exercises.map((e) => [e.id, e.position])).toEqual([
      ['row', 0],
      ['bench', 1],
    ]);
  });

  it('ticks the program target muscles that got work and crosses the skipped ones', () => {
    seed([done({ targetMuscles: ['chest', 'quads', 'chest'] })]);
    const { container } = mount('done', shell(), { past: true });
    const tags = [...container.querySelectorAll('.ptarget-row > *')].map((e) => [
      e.textContent,
      e.getAttribute('title'),
    ]);
    expect(tags).toEqual([
      ['Chest', 'Worked'],
      ['Quads', 'Skipped'],
    ]);
  });

  it('a session the app closed on its own says so and can be reopened', async () => {
    seed([done({ autoFinished: true })]);
    const { container } = mount('done', shell(), { past: true });
    expect(container.querySelector('.notice-accent')).toBeTruthy();
    expect(container.querySelector('.past-datebar')!.textContent).toBe('Closed automatically');
    await userEvent.click(screen.getByRole('button', { name: 'Reopen' }));
    expect(mine('done').finishedAt).toBeNull();
    expect(mine('done').autoFinished).toBe(false);
  });

  it('a home set shows the home row instead of a gym', () => {
    seed([done({ kind: 'home', homeSetId: null, dayName: 'Morning' })]);
    const { container } = mount('done', shell(), { past: true });
    expect(container.querySelector('.past-home-row')!.textContent).toBe('Home set');
    expect(container.querySelector('.past-gym-row.uibtn')).toBeNull();
  });

  it('a finished session opened without the editor flag has no Save', () => {
    seed([done()]);
    const { container } = mount('done');
    expect(container.querySelector('.past-save')).toBeNull();
    expect(container.querySelector('.trash')).toBeTruthy();
  });

  it('shows the share button and opens the share sheet for a past day', async () => {
    seed([done()]);
    mount('done', shell(), { past: true });
    await userEvent.click(screen.getByRole('button', { name: 'Share workout' }));
    expect(document.querySelector('.share-sheet')).toBeTruthy();
  });
});

// Sheets leave a 160 ms focus-settle timer behind; let it fire before the jsdom window goes away.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 250)));
