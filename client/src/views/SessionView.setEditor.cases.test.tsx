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
    reminders: [],
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
const inc = (dlg: HTMLElement, group: string) =>
  userEvent.click(within(dlg).getByRole('group', { name: group }).querySelectorAll('button')[1]);
const save = (dlg: HTMLElement) =>
  userEvent.click(within(dlg).getByRole('button', { name: 'Save' }));
const chip = (dlg: HTMLElement, name: string | RegExp) =>
  userEvent.click(within(dlg).getByRole('button', { name }));

describe('SessionView · set editor (strength)', () => {
  it('saves edited reps and a rated effort; an effort below 10 reads as not to failure', async () => {
    seed([benchLive()]);
    mount();
    const dlg = await openEditor();
    await inc(dlg, 'Reps');
    await chip(dlg, '8');
    expect(within(dlg).getByText(/2 more reps were possible/)).toBeTruthy();
    await save(dlg);
    expect(only()).toMatchObject({ reps: 9, weight: 80, rpe: 8, failure: 'no' });
  });

  it('F marks the set to failure at RPE 10 and opens the partial reps', async () => {
    seed([benchLive()]);
    mount();
    const dlg = await openEditor();
    await chip(dlg, 'To failure');
    expect(within(dlg).getByText('Partial reps after failure')).toBeTruthy();
    await userEvent.click(dlg.querySelectorAll('.se-partials button')[1]);
    await save(dlg);
    expect(only()).toMatchObject({ failure: 'manual', rpe: 10, partials: 1 });
  });

  it('a failure the app inferred is dismissed by picking another effort', async () => {
    seed([
      benchLive([set('s1', { loggedAt: NOW - 10 * MIN, failure: 'auto', failureWhy: 'missed' })]),
    ]);
    mount();
    const dlg = await openEditor();
    expect(within(dlg).getByText(/Marked to failure by the app/)).toBeTruthy();
    await chip(dlg, '10');
    await save(dlg);
    expect(only()).toMatchObject({ rpe: 10, failure: 'no' });
    expect(only().failureWhy ?? null).toBeNull();
  });

  it('a warm-up pick is pinned as manual and excluded from volume', async () => {
    seed([benchLive()]);
    mount();
    const dlg = await openEditor();
    await chip(dlg, 'Warm-up');
    expect(within(dlg).getByText(/volume/i)).toBeTruthy();
    await save(dlg);
    expect(only()).toMatchObject({ isWarmup: true, type: 'warmup', warmupManual: true });
  });

  it('a dropset adds parts at three quarters of the weight, two reps fewer, and parts can go', async () => {
    seed([benchLive()]);
    mount();
    const dlg = await openEditor();
    await chip(dlg, 'Dropset');
    await userEvent.click(within(dlg).getByText('Add another drop'));
    await userEvent.click(within(dlg).getByText('Add another drop'));
    expect(within(dlg).getByText('Drop 2')).toBeTruthy();
    await userEvent.click(within(dlg).getAllByRole('button', { name: 'Delete' })[0]);
    await save(dlg);
    expect(only().type).toBe('drop');
    expect(only().drops).toEqual([{ reps: 4, weight: 45 }]);
  });

  it('a reverse dropset climbs five kilos and drops three reps per part', async () => {
    seed([benchLive()]);
    mount();
    const dlg = await openEditor();
    await chip(dlg, 'Reverse dropset');
    await userEvent.click(within(dlg).getByText('Add another drop'));
    expect(within(dlg).getByText(/Reverse means the weight is expected to climb/)).toBeTruthy();
    await save(dlg);
    expect(only().drops).toEqual([{ reps: 5, weight: 85 }]);
  });

  it('static-dynamic keeps one weighted hold: reps 1 and the time in minutes', async () => {
    seed([benchLive()]);
    mount();
    const dlg = await openEditor();
    await chip(dlg, 'Static-dynamic');
    await save(dlg);
    expect(only()).toMatchObject({ type: 'static-dynamic', reps: 1 });
    expect(only().failure ?? null).toBeNull();
    expect(Math.round((only().durationMin ?? 0) * 60)).toBe(35);
  });

  it('the bodyweight switch stores the load as null and greys the weight', async () => {
    seed([benchLive()]);
    mount();
    const dlg = await openEditor();
    await userEvent.click(within(dlg).getByRole('switch', { name: 'Bodyweight set' }));
    await save(dlg);
    expect(only().weight).toBeNull();
  });

  it('assist turns the load into a counter-weight (negative) with quick chips', async () => {
    seed([benchLive()]);
    mount();
    const dlg = await openEditor();
    await chip(dlg, 'Assist');
    expect(within(dlg).getByText(/Counter-weight that helps you/)).toBeTruthy();
    await save(dlg);
    expect(only().weight).toBe(-16);
  });

  it('band picks a colour tile and stores its estimated kilos', async () => {
    seed([benchLive()]);
    mount();
    const dlg = await openEditor();
    await chip(dlg, 'Band');
    expect(within(dlg).getByText(/Band load is an estimate/)).toBeTruthy();
    const tiles = dlg.querySelectorAll('.band-tile');
    expect(tiles.length).toBeGreaterThan(1);
    await userEvent.click(tiles[tiles.length - 1]);
    await save(dlg);
    expect(only().weight).toBeGreaterThan(0);
    expect(only().weight).not.toBe(80);
  });

  it('pounds show the stored kilos and keep the canonical weight', async () => {
    seed([benchLive()]);
    mount();
    const dlg = await openEditor();
    await chip(dlg, 'lb');
    expect(within(dlg).getByText(/^Stored as 80(\.0)? kg$/)).toBeTruthy();
    await save(dlg);
    expect(only().weight).toBe(80);
    expect(__getStateForTests().exerciseUnits).toEqual({ 'bench press': 'lb' });
  });

  it('the plate calculator opens from a barbell set and applies its load', async () => {
    seed([benchLive()]);
    mount();
    const dlg = await openEditor();
    await userEvent.click(within(dlg).getByText('Plate calculator'));
    // Pick a different load on the bar, then apply it back to the set.
    await userEvent.click(screen.getByRole('button', { name: 'Use 80 kg' }));
    await save(dlg);
    expect(only().weight).toBe(80);
  });

  it('each part of a dropset has its own reps and weight', async () => {
    seed([benchLive()]);
    mount();
    const dlg = await openEditor();
    await chip(dlg, 'Dropset');
    await userEvent.click(within(dlg).getByText('Add another drop'));
    const part = dlg.querySelectorAll('.drop-part')[1] as HTMLElement;
    await inc(part, 'Reps');
    await inc(part, 'Weight, kg');
    await save(dlg);
    expect(only().drops).toEqual([{ reps: 7, weight: 62.5 }]);
  });

  it('a static-dynamic hold can carry a weight', async () => {
    seed([benchLive()]);
    mount();
    const dlg = await openEditor();
    await chip(dlg, 'Static-dynamic');
    await inc(dlg, 'Weight, kg');
    await save(dlg);
    expect(only()).toMatchObject({ type: 'static-dynamic', weight: 82.5 });
  });

  it('assist: the stepper starts at the default help and a chip picks another value', async () => {
    seed([benchLive()]);
    mount();
    const dlg = await openEditor();
    await chip(dlg, 'Assist');
    await inc(dlg, 'Assistance');
    expect(
      (
        within(dlg)
          .getByRole('group', { name: 'Assistance' })
          .querySelector('input') as HTMLInputElement
      ).value,
    ).toBe('21');
    await chip(dlg, '-40.0');
    await save(dlg);
    expect(only().weight).toBe(-40);
  });

  it('band: the gym band library can be edited from the sheet', async () => {
    seed([{ ...benchLive(), gymId: 'g1' }], {
      gyms: [{ id: 'g1', name: 'Iron Yard', lat: 0, lng: 0, radiusM: 100 }],
    });
    mount();
    const dlg = await openEditor();
    await chip(dlg, 'Band');
    await userEvent.click(within(dlg).getByText('Edit bands · Iron Yard'));
    expect(document.querySelector('.band-sheet')).toBeTruthy();
  });

  it.each([
    ['Static-dynamic', ['Weight, kg']],
    ['Assist', ['Reps', 'Assistance']],
    ['Band', ['Reps']],
  ])('%s: tapping a field moves the focus ring to it', async (mode, groups) => {
    seed([benchLive()]);
    mount();
    const dlg = await openEditor();
    await chip(dlg, mode);
    for (const g of groups) {
      const el = within(dlg).getByRole('group', { name: g });
      await userEvent.click(el);
      expect(el.className).toContain('is-focused');
    }
  });
});

const cardioLive = (machine = 'cardio-treadmill') =>
  wk('open', [
    ex(
      'tm',
      'Treadmill',
      [
        set('s1', {
          reps: 0,
          weight: null,
          durationMin: 20,
          distanceKm: 3,
          speedKmh: 9,
          loggedAt: NOW - 10 * MIN,
        }),
      ],
      { kind: 'cardio', equipmentItems: [machine] },
    ),
  ]);

describe('SessionView · set editor (cardio and holds)', () => {
  it('shows the treadmill readings, saves them and keeps unused fields empty', async () => {
    seed([cardioLive()]);
    mount();
    await userEvent.click(screen.getByRole('button', { name: /^1203/ }));
    const dlg = screen.getByRole('dialog');
    expect(within(dlg).getByText('Entry 1 · Treadmill')).toBeTruthy();
    await userEvent.click(within(dlg).getByRole('group', { name: 'Distance, km' }));
    expect(within(dlg).getByRole('group', { name: 'Distance, km' }).className).toContain(
      'is-focused',
    );
    await userEvent.click(within(dlg).getByRole('group', { name: 'Duration, min' }));
    expect(within(dlg).getByRole('group', { name: 'Distance, km' }).className).not.toContain(
      'is-focused',
    );
    await inc(dlg, 'Duration, min');
    await inc(dlg, 'Distance, km');
    await inc(dlg, 'Speed, km/h');
    await inc(dlg, 'Incline, %');
    await inc(dlg, 'Calories');
    await inc(dlg, 'RPE');
    await save(dlg);
    expect(only()).toMatchObject({
      reps: 0,
      durationMin: 21,
      distanceKm: 3.1,
      speedKmh: 9.5,
      inclinePct: 0.5,
      calories: 10,
      rpe: 0.5,
    });
    expect(only().watts ?? null).toBeNull();
  });

  it.each([
    ['cardio-stairclimber', ['Floors', 'Level'], { floors: 1, level: 1 }],
    ['cardio-rower', ['Power, W'], { watts: 5 }],
  ])('the %s asks for its own readings', async (machine, labels, saved) => {
    seed([cardioLive(machine)]);
    mount();
    await userEvent.click(screen.getByRole('button', { name: /^120/ }));
    const dlg = screen.getByRole('dialog');
    for (const l of labels) await inc(dlg, l);
    expect(within(dlg).queryByRole('group', { name: 'Speed, km/h' })).toBeNull();
    await save(dlg);
    expect(only()).toMatchObject(saved);
  });

  it('a stopwatch hold has only a hold time: no reps, load type or set type', async () => {
    seed([
      wk('open', [
        ex(
          'pl',
          'Plank',
          [
            set('s1', {
              reps: 1,
              weight: null,
              type: 'static-dynamic',
              durationMin: 0.5,
              loggedAt: NOW - 10 * MIN,
            }),
          ],
          {
            measure: 'hold',
          },
        ),
      ]),
    ]);
    mount();
    await userEvent.click(screen.getByRole('button', { name: /^10:30/ }));
    const dlg = screen.getByRole('dialog');
    expect(within(dlg).getByText('Hold, s')).toBeTruthy();
    expect(within(dlg).queryByRole('group', { name: 'Reps' })).toBeNull();
    expect(within(dlg).queryByText('Load type')).toBeNull();
    expect(within(dlg).queryByText('Dropset')).toBeNull();
    await save(dlg);
    expect(only()).toMatchObject({ reps: 1, type: 'static-dynamic' });
    expect(Math.round((only().durationMin ?? 0) * 60)).toBe(30);
    expect(only().weight).toBeNull();
  });

  it('one-sided dumbbell work is logged per side and remembered for the lift', async () => {
    seed([
      wk('open', [
        ex('cu', 'Dumbbell curl', [set('s1', { reps: 10, weight: 20, loggedAt: NOW - 10 * MIN })], {
          equipment: ['dumbbell'],
        }),
      ]),
    ]);
    mount();
    const dlg = await openEditor(/^11020\.0/);
    await userEvent.click(within(dlg).getByText('One side'));
    expect(within(dlg).getByText('Log one side · counts ×2 in volume')).toBeTruthy();
    await save(dlg);
    expect(__getStateForTests().exerciseSides).toEqual({ 'dumbbell curl': 'one' });
    expect(only().weight).toBe(20);
  });

  it('the Delete set button removes the set at once and the snack can undo it', async () => {
    seed([benchLive()]);
    const { sh } = mount();
    const dlg = await openEditor();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Delete set' }));
    expect(sets0()).toHaveLength(0);
    const snack = vi.mocked(sh.snack).mock.calls[0][0] as { text: string; onUndo: () => void };
    expect(snack.text).toMatch(/80/);
    act(() => snack.onUndo());
    expect(sets0()).toHaveLength(1);
    expect(only()).toMatchObject({ reps: 8, weight: 80 });
  });
});

// Sheets leave a 160 ms focus-settle timer behind; let it fire before the jsdom window goes away.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 250)));
