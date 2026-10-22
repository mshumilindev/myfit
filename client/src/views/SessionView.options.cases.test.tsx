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

const two = (): Workout =>
  wk('open', [
    ex('bench', 'Bench press', [
      set('s1', { loggedAt: NOW - 10 * MIN }),
      set('s2', { loggedAt: NOW - 6 * MIN }),
    ]),
    ex('row', 'Cable row', [set('r1', { weight: 50, loggedAt: NOW - 12 * MIN })], { position: 1 }),
  ]);
const openOpts = async (container: HTMLElement) => {
  await userEvent.click(
    within(container.querySelector('.focus-view') as HTMLElement).getByRole('button', {
      name: 'Set options',
    }),
  );
  return screen.getByRole('dialog');
};
const tab = (d: HTMLElement, name: RegExp) => within(d).getByRole('tab', { name });

describe('SessionView · exercise options (focus options sheet)', () => {
  it('opens on "This set" with the set editor, and the pinned footer has the muscle map and delete', async () => {
    seed([two()]);
    const { container } = mount();
    const d = await openOpts(container);
    expect(tab(d, /This set/).getAttribute('aria-selected')).toBe('true');
    expect(d.querySelector('.opts-title')!.textContent).toBe('Bench press');
    expect(d.querySelector('.opts-sub')!.textContent).toBe('Sets · 2');
    expect(within(d).getByRole('button', { name: /Muscle map/ })).toBeTruthy();
    await userEvent.click(within(d).getByRole('button', { name: /Muscle map/ }));
    expect(document.querySelector('.muscle-map-sheet')).toBeTruthy();
  });

  it('duplicates the exercise together with its sets', async () => {
    seed([two()]);
    const { container } = mount();
    const d = await openOpts(container);
    await userEvent.click(tab(d, /Exercise/));
    await userEvent.click(within(d).getByRole('button', { name: /Duplicate with sets/ }));
    const names = mine().exercises.map((e) => [e.name, e.sets.length]);
    expect(names.filter(([n]) => n === 'Bench press')).toEqual([
      ['Bench press', 2],
      ['Bench press', 2],
    ]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('clears all sets with an undo in the snackbar', async () => {
    seed([two()]);
    const { container, sh } = mount();
    const d = await openOpts(container);
    await userEvent.click(tab(d, /Exercise/));
    await userEvent.click(within(d).getByRole('button', { name: 'Clear all sets' }));
    expect(mine().exercises[0].sets).toHaveLength(0);
    const snack = (sh.snack as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      text: string;
      onUndo: () => void;
    };
    expect(snack.text).toContain('Bench press');
    act(() => snack.onUndo());
    expect(
      mine()
        .exercises[0].sets.map((s) => s.id)
        .sort(),
    ).toEqual(['s1', 's2']);
  });

  it('deleting the exercise confirms, then removes it and moves on to the next one', async () => {
    seed([two()]);
    const { container } = mount();
    const d = await openOpts(container);
    await userEvent.click(within(d).getByRole('button', { name: 'Delete exercise' }));
    const confirm = screen.getByRole('alertdialog');
    expect(confirm.textContent).toContain('Bench press');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Keep' }));
    expect(mine().exercises).toHaveLength(2);
    const again = await openOpts(container);
    await userEvent.click(within(again).getByRole('button', { name: 'Delete exercise' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    expect(mine().exercises.map((e) => e.name)).toEqual(['Cable row']);
  });

  it('replaces an exercise through the picker, keeping its logged sets', async () => {
    seed([two()]);
    const { container } = mount();
    const d = await openOpts(container);
    await userEvent.click(tab(d, /Exercise/));
    await userEvent.click(within(d).getByRole('button', { name: /Replace exercise/ }));
    await userEvent.type(
      screen.getByPlaceholderText('Search by name, muscle or equipment'),
      'dumbbell bench press',
    );
    await userEvent.click(document.querySelector('.xp-row .xp-row-main') as HTMLElement);
    const first = mine().exercises[0];
    expect(first.name).toMatch(/Dumbbell Bench Press/i);
    expect(first.sets).toHaveLength(2);
    expect(first.id).toBe('bench');
  });

  it('opens the exercise history and details screens from the look-up rows', async () => {
    seed([two()]);
    const { container, sh } = mount();
    const d = await openOpts(container);
    await userEvent.click(tab(d, /Exercise/));
    await userEvent.click(within(d).getByRole('button', { name: /Details/ }));
    expect(sh.openOverlay).toHaveBeenLastCalledWith({
      screen: 'exercise-detail',
      name: 'Bench press',
    });
    const d2 = await openOpts(container);
    await userEvent.click(tab(d2, /Exercise/));
    await userEvent.click(within(d2).getByRole('button', { name: /history/i }));
    expect(sh.openOverlay).toHaveBeenLastCalledWith({
      screen: 'exercise-history',
      name: 'Bench press',
    });
  });

  it('groups two lifts into a superset and ungroups them again', async () => {
    seed([two()]);
    const { container } = mount();
    const d = await openOpts(container);
    await userEvent.click(tab(d, /Exercise/));
    await userEvent.click(within(d).getByRole('button', { name: /Superset with/ }));
    const sheet = screen.getByRole('dialog');
    expect(
      (within(sheet).getByRole('button', { name: /^Group as/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await userEvent.click(within(sheet).getByText('Cable row'));
    await userEvent.click(within(sheet).getByRole('button', { name: /^Group as/ }));
    const [a, b] = mine().exercises;
    expect(a.groupId).toBeTruthy();
    expect(a.groupId).toBe(b.groupId);
    // the focus view shows the pair as one step; ungroup from its menu
    const d3 = await openOpts(container);
    await userEvent.click(tab(d3, /Exercise/));
    await userEvent.click(within(d3).getByRole('button', { name: 'Ungroup' }));
    expect(mine().exercises.every((e) => !e.groupId)).toBe(true);
  });

  it('Session tab: circuit switch, change gym, and discard', async () => {
    seed([two()], { gyms: [{ id: 'g1', name: 'Smartfit', lat: 50.45, lng: 30.52, radiusM: 150 }] });
    const { container } = mount();
    const d = await openOpts(container);
    await userEvent.click(tab(d, /Session/));
    const circuit = d.querySelector('.ss-circuit') as HTMLElement;
    expect(circuit.className).not.toContain(' on');
    await userEvent.click(circuit);
    expect(d.querySelector('.ss-circuit')!.className).toContain(' on');
    await userEvent.click(within(d).getByRole('button', { name: /Change gym/ }));
    await userEvent.click(await screen.findByText('Smartfit'));
    expect(mine().gymId).toBe('g1');
    const d2 = await openOpts(container);
    await userEvent.click(tab(d2, /Session/));
    await userEvent.click(within(d2).getByRole('button', { name: 'Discard session' }));
    expect(screen.getByRole('alertdialog').textContent).toContain('Discard session');
  });
});

// Sheets leave a 160 ms focus-settle timer behind; let it fire before the jsdom window goes away.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 250)));
