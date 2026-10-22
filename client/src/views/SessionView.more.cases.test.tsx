import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Shell } from '../App';
import { COACH_DEFAULT } from '../atlas/types';
import { emptyCycleState } from '../cycle/cycleState';
import { __getStateForTests, __replaceStateForTests } from '../store';
import type { Exercise, SetEntry, Workout } from '../types';
import { SessionView } from './SessionView';
import { clearSummaryReturn } from './sessionSummary/NextUp';

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
  sessionStorage.clear();
  clearSummaryReturn();
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
const fin = (id: string, daysAgo: number, exs: Exercise[]): Workout =>
  wk(id, exs, { startedAt: NOW - daysAgo * DAY, finishedAt: NOW - daysAgo * DAY + 50 * MIN });
const upperChestDone = () => {
  const sets = Array.from({ length: 9 }, (_, i) =>
    set(`s${i + 1}`, { loggedAt: NOW - (120 - i * 10) * 1000 }),
  );
  return [
    wk('open', [ex('inc', 'Incline Dumbbell Press', sets)]),
    fin('h1', 3, [
      ex('b0', 'Bench press', [set('x1'), set('x2')]),
      ex('c0', 'Decline Dumbbell Flyes', [set('x3')], { position: 1 }),
    ]),
  ];
};

describe('SessionView · one part of a muscle is done', () => {
  it('names the part that had enough and points to the part that still has room', () => {
    seed(upperChestDone());
    const { container } = mount();
    const banner = container.querySelector('.tired-banner') as HTMLElement;
    expect(within(banner).getByText('Upper chest: had enough')).toBeTruthy();
    expect(within(banner).getByText('Lower chest still has room')).toBeTruthy();
    expect(banner.querySelector('.tb-why')!.textContent).toContain('your upper chest got about');
    expect(banner.querySelector('.tb-kicker')!.textContent).toBe('SAME MUSCLE · LOWER CHEST');
    expect(banner.querySelector('.tb-name')!.textContent).toBe('Decline Dumbbell Flyes');
  });

  it('tapping the suggestion adds it once; tapping again goes to the one already added', async () => {
    seed(upperChestDone());
    const { container } = mount();
    await userEvent.click(container.querySelector('.tb-tile-main') as HTMLElement);
    expect(mine().exercises.map((e) => e.name)).toEqual([
      'Incline Dumbbell Press',
      'Decline Dumbbell Flyes',
    ]);
    // back on the incline press: the suggestion is still there, now it points at the added one
    await userEvent.click(screen.getByRole('button', { name: 'Previous exercise' }));
    expect(screen.getByRole('button', { name: 'Next · Decline Dumbbell Flyes' })).toBeTruthy();
    await userEvent.click(container.querySelector('.tb-tile-main') as HTMLElement);
    expect(mine().exercises).toHaveLength(2);
    // jumped to the added one: the rail marks it as the current step
    expect(
      document.querySelector('.srail-dot[aria-current="true"]')!.getAttribute('aria-label'),
    ).toBe('Decline Dumbbell Flyes');
  });
});

describe('SessionView · reordering by drag in a finished session', () => {
  const two = () => ({
    ...wk('open', [
      ex('a', 'Bench press', [set('s1')], { position: 0 }),
      ex('b', 'Cable row', [set('s2')], { position: 1 }),
    ]),
    finishedAt: NOW - 5 * MIN,
  });

  it('on a wide screen, dropping one exercise onto another moves it there and the target lights up while hovered', () => {
    const wide = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (q: string) => ({ ...wide(q), matches: q.includes('min-width: 720px') }),
    });
    seed([two()]);
    mount('open', shell(), { past: true });
    const cards = [...document.querySelectorAll('.past-ex-card.is-draggable')] as HTMLElement[];
    expect(cards).toHaveLength(2);
    const dt = { effectAllowed: '', dropEffect: '', setData: vi.fn(), getData: vi.fn() };
    fireEvent.dragStart(cards[1], { dataTransfer: dt });
    fireEvent.dragOver(cards[0], { dataTransfer: dt });
    expect(cards[0].className).toContain('drop-over');
    fireEvent.drop(cards[0], { dataTransfer: dt });
    const order = [...mine().exercises].sort((x, y) => x.position - y.position).map((e) => e.name);
    expect(order).toEqual(['Cable row', 'Bench press']);
  });
});

describe('SessionView · deleting a cardio entry', () => {
  it('the snack reads the entry back: minutes, distance, speed', async () => {
    const tm = wk('open', [
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
            inclinePct: 1,
            calories: 200,
            rpe: 6,
            loggedAt: NOW - 10 * MIN,
          }),
        ],
        {
          kind: 'cardio',
          equipmentItems: ['cardio-treadmill'],
        },
      ),
    ]);
    seed([tm]);
    const { sh } = mount();
    await userEvent.click(screen.getByRole('button', { name: /^120/ }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete set' }),
    );
    expect(vi.mocked(sh.snack).mock.calls[0][0]).toMatchObject({
      text: 'Set deleted · 20 min · 3 km · 9 km/h · 1% · 200 kcal · RPE 6',
    });
  });
});

describe('SessionView · set options from the focus card', () => {
  it('the Set tab logs a typed set straight from the sheet', async () => {
    seed([wk('open', [ex('bench', 'Bench press', [set('s1', { loggedAt: NOW - 10 * MIN })])])]);
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Set options' }));
    const dlg = screen.getByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: '9' }));
    await userEvent.click(within(dlg).getByRole('button', { name: 'Log' }));
    const sets = mine().exercises[0].sets;
    expect(sets).toHaveLength(2);
    expect(sets[1]).toMatchObject({ reps: 8, weight: 80, rpe: 9, failure: 'no' });
  });

  it('the Equipment chip opens the equipment picker for the lift', async () => {
    seed([wk('open', [ex('bench', 'Bench press', [set('s1', { loggedAt: NOW - 10 * MIN })])])]);
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Equipment' }));
    expect(screen.getByText('Barbells')).toBeTruthy();
    expect(screen.getByText('Plates')).toBeTruthy();
  });
});

describe('SessionView · exercise menu in a finished session', () => {
  const pastBench = () => ({
    ...wk('open', [
      ex('a', 'Bench press', [set('s1', { weight: 80 }), set('s2', { weight: 80 })]),
      ex('b', 'Dumbbell curl', [set('s3', { weight: 20, reps: 10 })], {
        position: 1,
        equipment: ['dumbbell'],
      }),
    ]),
    finishedAt: NOW - 5 * MIN,
  });
  const openMenu = async (row: RegExp) => {
    await userEvent.click(screen.getByRole('button', { name: row }));
    const card = screen
      .getByRole('button', { name: 'Collapse' })
      .closest('[data-exid]') as HTMLElement;
    await userEvent.click(within(card).getByRole('button', { name: 'Menu' }));
    return screen.getByRole('dialog');
  };

  it('shows the Sides choice for dumbbell work and saves it for the lift', async () => {
    seed([pastBench()]);
    mount('open', shell(), { past: true });
    const d = await openMenu(/^Dumbbell curl1 × 10/);
    await userEvent.click(within(d).getByText('One side'));
    expect(within(d).getByText('Log one side · counts ×2 in volume')).toBeTruthy();
    expect(__getStateForTests().exerciseSides).toEqual({ 'dumbbell curl': 'one' });
  });

  it('Move up puts the lift ahead of the one above it', async () => {
    seed([pastBench()]);
    mount('open', shell(), { past: true });
    const d = await openMenu(/^Dumbbell curl1 × 10/);
    await userEvent.click(within(d).getByText('Move up'));
    const order = [...mine().exercises].sort((x, y) => x.position - y.position).map((e) => e.name);
    expect(order).toEqual(['Dumbbell curl', 'Bench press']);
  });

  it('Delete exercise asks first, removes the lift, and the snack restores it with its sets', async () => {
    seed([pastBench()]);
    const { sh } = mount('open', shell(), { past: true });
    const d = await openMenu(/^Bench press2 × 8/);
    await userEvent.click(within(d).getByText('Delete exercise'));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    expect(mine().exercises.map((e) => e.name)).toEqual(['Dumbbell curl']);
    const snack = vi.mocked(sh.snack).mock.calls.at(-1)![0] as { onUndo: () => void };
    act(() => snack.onUndo());
    expect(
      mine()
        .exercises.map((e) => e.name)
        .sort(),
    ).toEqual(['Bench press', 'Dumbbell curl']);
    expect(mine().exercises.find((e) => e.name === 'Bench press')!.sets).toHaveLength(2);
  });

  it('tapping an opened exercise name folds it back to its row', async () => {
    seed([pastBench()]);
    mount('open', shell(), { past: true });
    await userEvent.click(screen.getByRole('button', { name: /^Bench press2 × 8/ }));
    expect(screen.getByRole('button', { name: 'Collapse' })).toBeTruthy();
    await userEvent.click(screen.getAllByRole('button', { name: 'Bench press' })[0]);
    expect(screen.queryByRole('button', { name: 'Collapse' })).toBeNull();
  });

  it('Clear all sets empties the exercise and the snack brings the sets back', async () => {
    seed([pastBench()]);
    const { sh } = mount('open', shell(), { past: true });
    const d = await openMenu(/^Bench press2 × 8/);
    await userEvent.click(within(d).getByText('Clear all sets'));
    expect(mine().exercises[0].sets).toHaveLength(0);
    const snack = vi.mocked(sh.snack).mock.calls[0][0] as { onUndo: () => void };
    act(() => snack.onUndo());
    expect(
      mine()
        .exercises[0].sets.map((x) => x.id)
        .sort(),
    ).toEqual(['s1', 's2']);
  });
});

describe('SessionView · entry points and shortcuts', () => {
  it('opens the add-exercise picker straight away when started from "Add exercise"', () => {
    seed([wk('open', [])]);
    const r = render(<SessionView workoutId="open" shell={shell()} onClose={vi.fn()} startAdd />);
    expect(r.container).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(
      document.querySelector('.xp-search, input[type="search"], [role="searchbox"]'),
    ).toBeTruthy();
  });

  it('the Session tab opens the readiness coach when earlier sessions give it something to say', async () => {
    const wed = (id: string, d: number): Workout =>
      wk(id, [ex(id + 'e', 'Bench press', [set(id + 's')])], {
        startedAt: NOW - d * 86400000,
        finishedAt: NOW - d * 86400000 + 3600000,
      });
    seed([
      wk('open', [ex('bench', 'Bench press', [set('s1', { loggedAt: NOW - 6 * MIN })])]),
      wed('a', 7),
      wed('b', 1),
    ]);
    const { container } = mount();
    await userEvent.click(
      within(container.querySelector('.focus-view') as HTMLElement).getByRole('button', {
        name: 'Set options',
      }),
    );
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('tab', { name: /Session/ }));
    await userEvent.click(within(screen.getByRole('dialog')).getByText('Today’s readiness'));
    expect(document.querySelector('.coach-sheet')).toBeTruthy();
    expect(document.querySelector('.coach-sheet')!.textContent).toContain(
      'Some muscles are ready, some are still recovering.',
    );
  });
});

describe('SessionView · sheets and dialogs close cleanly', () => {
  const liveTwo = () =>
    wk('open', [
      ex('a', 'Bench press', [set('s1', { loggedAt: NOW - 6 * MIN })], { position: 0 }),
      ex('b', 'Cable row', [], { position: 1 }),
    ]);
  const closed = () => waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

  it('the equipment picker closes with Escape', async () => {
    seed([liveTwo()]);
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Equipment' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    await closed();
  });

  it('the superset drawer picks and unpicks partners, and closes with Escape', async () => {
    seed([liveTwo()]);
    const { container } = mount();
    await userEvent.click(
      within(container.querySelector('.focus-view') as HTMLElement).getByRole('button', {
        name: 'Set options',
      }),
    );
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('tab', { name: /Exercise/ }),
    );
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /Superset with/ }),
    );
    const drawer = screen.getByText('Superset with…').closest('.sheet') as HTMLElement;
    const row = within(drawer).getByText('Cable row');
    await userEvent.click(row);
    await userEvent.click(row);
    expect(
      within(drawer)
        .getByRole('button', { name: /Group as/ })
        .hasAttribute('disabled'),
    ).toBe(true);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByText('Superset with…')).toBeNull());
    expect(mine().exercises.every((e) => !e.groupId)).toBe(true);
  });

  it('tapping outside the delete-set question dismisses it and keeps the set', async () => {
    seed([liveTwo()]);
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Delete set' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    await userEvent.click(document.querySelector('.dialog-scrim') as HTMLElement);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(mine().exercises[0].sets).toHaveLength(1);
  });

  it('the new-exercise form toggles secondary muscles and equipment on and off', async () => {
    seed([liveTwo()]);
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
    await userEvent.type(within(screen.getByRole('dialog')).getByRole('searchbox'), 'Zxq pulldown');
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Create “Zxq pulldown”' }),
    );
    const sheet = document.querySelector('.new-exercise-sheet') as HTMLElement;
    await userEvent.click(within(sheet).getAllByRole('button', { name: /Lats/ })[0]);
    const sec = () => within(sheet).getAllByRole('button', { name: /Biceps/ })[1];
    await userEvent.click(sec());
    expect(sec().getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(sec());
    expect(sec().getAttribute('aria-pressed')).toBe('false');
    const cable = within(sheet).getByRole('button', { name: /Cable/ });
    await userEvent.click(cable);
    await userEvent.click(cable);
    await userEvent.click(within(sheet).getByRole('button', { name: 'Create “Zxq pulldown”' }));
    const made = mine().exercises.find((e) => e.name === 'Zxq pulldown')!;
    expect(made).toMatchObject({ primaryMuscle: 'lats', secondaryMuscles: [], equipment: [] });
  });
});

describe('SessionView · recap shortcuts', () => {
  const finishRun = async (container: HTMLElement) => {
    await userEvent.click(container.querySelector('.focus-finish') as HTMLElement);
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Finish' }),
    );
  };
  const lift = () =>
    wk('open', [
      ex('a', 'Bench press', [
        set('s1', { loggedAt: NOW - 6 * MIN }),
        set('s2', { loggedAt: NOW - 3 * MIN }),
      ]),
    ]);

  it("a muscle in the worked list opens that muscle's history", async () => {
    seed([lift()]);
    const { container, sh } = mount();
    await finishRun(container);
    await userEvent.click(
      document.querySelector(
        '.muscles-worked button, .muscles-worked [role="button"]',
      ) as HTMLElement,
    );
    expect(sh.openOverlay).toHaveBeenCalledWith({ screen: 'muscle-history', muscle: 'chest' });
  });
});

// Sheets leave a 160 ms focus-settle timer behind; let it fire before the jsdom window goes away.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 250)));
