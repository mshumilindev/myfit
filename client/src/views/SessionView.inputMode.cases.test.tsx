import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Shell } from '../App';
import { COACH_DEFAULT } from '../atlas/types';
import { emptyCycleState } from '../cycle/cycleState';
import { __getStateForTests, __replaceStateForTests } from '../store';
import type { Exercise, SetEntry, Workout } from '../types';
import { SessionView } from './SessionView';
import { loadInputMode, resetInputModeForTests } from '../inputModeStore';
import { fireEvent } from '@testing-library/react';

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
    exerciseLoadTypes: {},
    exerciseUnits: {},
    exerciseSides: {},
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
  resetInputModeForTests();
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

const benchLive = (sets: SetEntry[] = [set('s1', { loggedAt: NOW - 10 * MIN })]) =>
  wk('open', [ex('bench', 'Bench press', sets)]);
const sets0 = () => mine().exercises[0].sets;
const only = () => sets0()[0];

/** Opens the bench set 1 (80 kg x 8) in the editor sheet. */
async function openEditor(name: RegExp = /^1880\.0/) {
  await userEvent.click(screen.getByRole('button', { name }));
  return screen.getByRole('dialog');
}
const save = (dlg: HTMLElement) =>
  userEvent.click(within(dlg).getByRole('button', { name: 'Save' }));

const wheelMode = () => {
  localStorage.setItem('spotter.inputMode', 'wheel');
  resetInputModeForTests();
};
const drum = (dlg: HTMLElement, name: string) => within(dlg).getByRole('spinbutton', { name });

describe('SessionView · set entry mode (wheel | − / +, SPO-318)', () => {
  it('starts on − / + and offers the Input row in More', async () => {
    seed([benchLive()]);
    mount();
    const dlg = await openEditor();
    expect(
      within(dlg).getByRole('group', { name: 'Reps' }).querySelectorAll('button'),
    ).toHaveLength(2);
    expect(within(dlg).queryByRole('spinbutton')).toBeNull();
    const row = within(dlg).getByRole('group', { name: 'Input' });
    expect(within(row).getByRole('button', { name: 'Wheel' })).toBeTruthy();
    expect(within(row).getByRole('button', { name: '−/+', pressed: true })).toBeTruthy();
  });

  it('switching to Wheel swaps the steppers for drums and remembers the choice', async () => {
    seed([benchLive()]);
    mount();
    const dlg = await openEditor();
    await userEvent.click(
      within(within(dlg).getByRole('group', { name: 'Input' })).getByRole('button', {
        name: 'Wheel',
      }),
    );
    expect(loadInputMode()).toBe('wheel');
    expect(localStorage.getItem('spotter.inputMode')).toBe('wheel');
    expect(drum(dlg, 'Reps').getAttribute('aria-valuetext')).toBe('8');
    expect(drum(dlg, 'Weight').getAttribute('aria-valuetext')).toBe('80 kg');
    expect(within(dlg).queryByRole('button', { name: '+' })).toBeNull();
    // and back
    await userEvent.click(
      within(within(dlg).getByRole('group', { name: 'Input' })).getByRole('button', {
        name: '−/+',
      }),
    );
    expect(loadInputMode()).toBe('stepper');
    expect(
      within(dlg).getByRole('group', { name: 'Reps' }).querySelectorAll('button'),
    ).toHaveLength(2);
  });

  it('a drum edits the set: keys move reps, a typed weight lands on the grid, Save stores both', async () => {
    wheelMode();
    seed([benchLive()]);
    mount();
    const dlg = await openEditor();
    fireEvent.keyDown(drum(dlg, 'Reps'), { key: 'ArrowDown' });
    const typed = within(dlg).getByLabelText('Weight (type)');
    fireEvent.focus(typed);
    fireEvent.change(typed, { target: { value: '82,3' } });
    fireEvent.blur(typed);
    await save(dlg);
    expect(only()).toMatchObject({ reps: 9, weight: 82.5 });
  });

  it('opening and saving in wheel mode changes nothing (a stored 80 kg is not re-rounded)', async () => {
    wheelMode();
    seed([benchLive([set('s1', { loggedAt: NOW - 10 * MIN, weight: 81.25 })])]);
    mount();
    const dlg = await openEditor(/^1881/);
    expect(drum(dlg, 'Weight').getAttribute('aria-valuetext')).toBe('81.25 kg');
    await save(dlg);
    expect(only()).toMatchObject({ reps: 8, weight: 81.25 });
  });

  it('pounds: the drum shows the converted weight with lb and saves the canonical kilos', async () => {
    wheelMode();
    seed([benchLive()], { exerciseUnits: { 'bench press': 'lb' } });
    mount();
    const dlg = await openEditor();
    expect(drum(dlg, 'Weight').getAttribute('aria-valuetext')).toBe('176.4 lb');
    await save(dlg);
    expect(only().weight).toBe(80);
  });

  it('a bodyweight set greys the weight drum into BW', async () => {
    wheelMode();
    seed([benchLive()]);
    mount();
    const dlg = await openEditor();
    await userEvent.click(within(dlg).getByRole('switch', { name: 'Bodyweight set' }));
    expect(within(dlg).getByText('BW')).toBeTruthy();
    expect(within(dlg).queryByRole('spinbutton', { name: 'Weight' })).toBeNull();
  });
});
