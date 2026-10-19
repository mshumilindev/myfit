import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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

const member = (
  id: string,
  name: string,
  order: number,
  sets: SetEntry[],
  o: Partial<Exercise> = {},
): Exercise =>
  ex(id, name, sets, {
    position: order,
    groupId: 'c1',
    groupOrder: order,
    groupKind: 'circuit',
    plannedSets: 2,
    ...o,
  });
const circuitLive = (a: SetEntry[] = [], b: SetEntry[] = []): Workout =>
  wk('open', [
    member('sq', 'Squat', 0, a),
    member('pu', 'Assisted Pull-up', 1, b, { primaryMuscle: 'lats' }),
  ]);
const sheet = () => document.querySelector('.circuit-run') as HTMLElement;
const logged = (id: string) => mine().exercises.find((e) => e.id === id)!.sets;

describe('SessionView · circuits', () => {
  it('shows the circuit as one focus step with its rounds and starts the run sheet', async () => {
    seed([circuitLive()]);
    const { container } = mount();
    expect(container.querySelector('.cb-name')!.textContent).toBe('Circuit A');
    expect(container.querySelector('.cb-meta')!.textContent).toBe('2 exercises · 2 rounds');
    expect([...container.querySelectorAll('.cb-rname')].map((e) => e.textContent)).toEqual([
      'Squat',
      'Assisted Pull-up',
    ]);
    expect(container.querySelectorAll('.cb-pips .pip.active')).toHaveLength(1);
    await userEvent.click(container.querySelector('.cb-cta') as HTMLElement);
    expect(sheet().querySelector('.cr-lh-tag')!.textContent).toBe('Circuit A');
    expect(sheet().querySelector('.cr-lh-round')!.textContent).toBe('Round 1 of 2');
    expect(sheet().querySelector('.cr-card-name')!.textContent).toBe('Squat');
  });

  it('logs each exercise of a round, advances through them, and rests between rounds', async () => {
    seed([circuitLive()]);
    const { container } = mount();
    await userEvent.click(container.querySelector('.cb-cta') as HTMLElement);
    // A1: bump reps and weight, then log
    const steps = sheet().querySelectorAll('.cr-step-ctl');
    await userEvent.click(within(steps[0] as HTMLElement).getByRole('button', { name: '+' }));
    await userEvent.click(within(steps[1] as HTMLElement).getByRole('button', { name: '+' }));
    await userEvent.click(sheet().querySelector('.cr-log') as HTMLElement);
    expect(logged('sq')).toHaveLength(1);
    expect(logged('sq')[0]).toMatchObject({ reps: 11, weight: 2.5, type: 'working' });
    // moved on to A2 (push-up has no load -> no kg stepper)
    expect(sheet().querySelector('.cr-card-name')!.textContent).toBe('Assisted Pull-up');
    expect(sheet().querySelector('.cr-noload')).toBeTruthy();
    await userEvent.click(sheet().querySelector('.cr-log') as HTMLElement);
    expect(logged('pu')[0]).toMatchObject({ reps: 10, weight: null });
    // finish round 1
    await userEvent.click(sheet().querySelector('.cr-complete') as HTMLElement);
    expect(sheet().className).toContain('cr-between');
    expect(sheet().querySelector('.crb-title')!.textContent).toBe('Round 1 complete');
    await userEvent.click(sheet().querySelector('.cr-log') as HTMLElement); // start round 2
    expect(sheet().querySelector('.cr-lh-round')!.textContent).toBe('Round 2 of 2');
    // the card is seeded from the previous round's set
    expect(sheet().querySelector('.cr-step .num')!.textContent).toBe('11');
  });

  it('adds a round when the last one is completed and Add round is pressed', async () => {
    seed([
      circuitLive(
        [set('a1', { loggedAt: NOW - 9 * MIN }), set('a2', { loggedAt: NOW - 5 * MIN })],
        [set('b1', { loggedAt: NOW - 8 * MIN }), set('b2', { loggedAt: NOW - 4 * MIN })],
      ),
    ]);
    const { container } = mount();
    // both rounds are done: the block summarises and offers no Continue
    expect(container.querySelector('.circuit-block.done')).toBeTruthy();
    cleanup();
    seed([
      circuitLive(
        [set('a1', { loggedAt: NOW - 9 * MIN })],
        [set('b1', { loggedAt: NOW - 8 * MIN })],
      ),
    ]);
    const again = mount();
    expect(again.container.querySelector('.cb-cta')!.textContent).toBe('Continue round 2');
    await userEvent.click(again.container.querySelector('.cb-cta') as HTMLElement);
    await userEvent.click(sheet().querySelector('.cr-complete') as HTMLElement);
    await userEvent.click(within(sheet()).getByRole('button', { name: 'Add a round' }));
    expect(mine().exercises.every((e) => e.plannedSets === 3)).toBe(true);
    await userEvent.click(within(sheet()).getByRole('button', { name: 'Finish circuit' }));
    expect(document.querySelector('.circuit-run')).toBeNull();
  });

  it('navigates between exercises with the arrows and shows a recorded one with Go to the next', async () => {
    seed([circuitLive([set('a1', { loggedAt: NOW - 9 * MIN })], [])]);
    const { container } = mount();
    await userEvent.click(container.querySelector('.cb-cta') as HTMLElement);
    // round 1 of A is recorded, B is next up
    expect(sheet().querySelector('.cr-card-name')!.textContent).toBe('Assisted Pull-up');
    await userEvent.click(within(sheet()).getByRole('button', { name: 'Previous' }));
    expect(sheet().querySelector('.cr-card.recorded .cr-rec-text')!.textContent).toContain(
      '8 × 80.0 kg',
    );
    expect(sheet().querySelector('.cr-next-name')!.textContent).toContain('Assisted Pull-up');
    await userEvent.click(sheet().querySelector('.cr-next-go') as HTMLElement);
    expect(sheet().querySelector('.cr-card-name')!.textContent).toBe('Assisted Pull-up');
    expect(
      (within(sheet()).getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('builds a circuit from the Circuit switch: add exercises, set rounds, then start', async () => {
    seed([wk('open', [ex('bench', 'Bench press', [set('s1', { loggedAt: NOW - 10 * MIN })])])]);
    const { container } = mount();
    await userEvent.click(
      within(container.querySelector('.focus-view') as HTMLElement).getByRole('button', {
        name: 'Set options',
      }),
    );
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('tab', { name: /Session/ }));
    await userEvent.click(document.querySelector('.ss-circuit') as HTMLElement);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // pick two lifts through the picker: they join one circuit group
    for (const q of ['squat', 'row']) {
      await userEvent.click(container.querySelector('.plan-segments .add') as HTMLElement);
      await userEvent.type(screen.getByPlaceholderText('Search by name, muscle or equipment'), q);
      await userEvent.click(document.querySelector('.xp-row .xp-row-main') as HTMLElement);
    }
    const members = mine().exercises.filter((e) => e.groupKind === 'circuit');
    expect(members.length).toBe(2);
    expect(new Set(members.map((m) => m.groupId)).size).toBe(1);
    expect(container.querySelector('.circuit-banner .cb-title')!.textContent).toContain('A');
    // the builder's rounds stepper changes the rounds of every member; Done leaves build mode
    const num = () => Number(container.querySelector('.cbld-stepper .num')!.textContent);
    const start = num();
    const stepper = container.querySelector('.cbld-stepper') as HTMLElement;
    await userEvent.click(within(stepper).getByRole('button', { name: '+' }));
    expect(num()).toBe(start + 1);
    expect(
      mine()
        .exercises.filter((e) => e.groupKind === 'circuit')
        .map((e) => e.plannedSets),
    ).toEqual([start + 1, start + 1]);
    await userEvent.click(within(stepper).getByRole('button', { name: '-' }));
    expect(num()).toBe(start);
    await userEvent.click(container.querySelector('.cbld-done') as HTMLElement);
    expect(container.querySelector('.cbld-rounds')).toBeNull();
  });

  it('minus steppers lower the reps, the arrows move between exercises, and the rest between rounds counts up', async () => {
    seed([circuitLive()]);
    const { container } = mount();
    await userEvent.click(container.querySelector('.cb-cta') as HTMLElement);
    await userEvent.click(
      within(sheet().querySelectorAll('.cr-step-ctl')[0] as HTMLElement).getByRole('button', {
        name: '-',
      }),
    );
    await userEvent.click(sheet().querySelector('.cr-log') as HTMLElement);
    expect(logged('sq')[0].reps).toBe(9);
    // back to A1 (recorded) and forward again with the arrows
    await userEvent.click(within(sheet()).getByRole('button', { name: 'Previous' }));
    expect(sheet().querySelector('.cr-card.recorded')!.textContent).toContain('Squat');
    await userEvent.click(within(sheet()).getByRole('button', { name: 'Next' }));
    expect(sheet().querySelector('.cr-card-name')!.textContent).toBe('Assisted Pull-up');
    await userEvent.click(sheet().querySelector('.cr-log') as HTMLElement);
    await userEvent.click(sheet().querySelector('.cr-complete') as HTMLElement);
    // round done: the rest clock between rounds ticks once a second
    const rest = () => sheet().querySelector('.crb-rest-num')!.textContent;
    const first = rest();
    await waitFor(() => expect(rest()).not.toBe(first), { timeout: 3000 });
  });
});

describe('SessionView · supersets', () => {
  const ss = (a: SetEntry[], b: SetEntry[]): Workout =>
    wk('open', [
      ex('bench', 'Bench press', a, {
        position: 0,
        groupId: 'g',
        groupKind: 'superset',
        groupOrder: 0,
        plannedSets: 3,
      }),
      ex('row', 'Cable row', b, {
        position: 1,
        groupId: 'g',
        groupKind: 'superset',
        groupOrder: 1,
        plannedSets: 3,
      }),
    ]);

  it('is one focus step: members take turns and logging hands the turn to the other', async () => {
    seed([ss([set('s1', { loggedAt: NOW - 8 * MIN })], [])]);
    const { container } = mount();
    expect(container.querySelector('.fss-round')!.textContent).toContain('Round 1 of 3');
    const pressed = () => container.querySelector('.fss-m[aria-pressed="true"]')!.textContent;
    expect(pressed()).toContain('Cable row');
    await userEvent.click(screen.getByRole('button', { name: 'Log' }));
    expect(logged('row')).toHaveLength(1);
    expect(pressed()).toContain('Bench press');
    // you can pick the other member by hand
    await userEvent.click(container.querySelectorAll('.fss-m')[1] as HTMLElement);
    expect(pressed()).toContain('Cable row');
  });

  it('the group menu ungroups, or adds an exercise into the superset', async () => {
    seed([ss([set('s1', { loggedAt: NOW - 8 * MIN })], [])]);
    const { container } = mount();
    await userEvent.click(container.querySelector('.fss-head .dots') as HTMLElement);
    const menu = screen.getByRole('dialog');
    expect(menu.textContent).toContain('Superset A');
    await userEvent.click(within(menu).getByRole('button', { name: 'Add exercise' }));
    await userEvent.type(
      screen.getByPlaceholderText('Search by name, muscle or equipment'),
      'curl',
    );
    await userEvent.click(document.querySelector('.xp-row .xp-row-main') as HTMLElement);
    expect(mine().exercises.filter((e) => e.groupId === 'g')).toHaveLength(3);
    await userEvent.click(container.querySelector('.fss-head .dots') as HTMLElement);
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Ungroup' }),
    );
    expect(mine().exercises.every((e) => !e.groupId)).toBe(true);
  });

  it('a past superset is collapsed into one card with its volume and opens on tap', async () => {
    const w = ss(
      [set('s1', { loggedAt: NOW - 20 * MIN }), set('s2', { loggedAt: NOW - 16 * MIN })],
      [
        set('r1', { weight: 50, loggedAt: NOW - 18 * MIN }),
        set('r2', { weight: 50, loggedAt: NOW - 14 * MIN }),
      ],
    );
    w.id = 'done';
    w.finishedAt = NOW - 5 * MIN;
    seed([w]);
    const { container } = mount('done', shell(), { past: true });
    const block = container.querySelector('.ss-block.past')!;
    expect(block.querySelector('.ss-rounds-meta')!.textContent).toMatch(/^3 rounds · 2.080 kg$/);
    expect([...block.querySelectorAll('.past-ex-row .n')].map((e) => e.textContent)).toEqual([
      'Bench press',
      'Cable row',
    ]);
    await userEvent.click(block.querySelector('.past-ex-card') as HTMLElement);
    expect(container.querySelector('.ss-block.past .ss-head .dots')).toBeTruthy();
  });

  it('an opened past superset takes another round from its ghost row, or opens it in the editor', async () => {
    const w = ss(
      [set('s1', { loggedAt: NOW - 20 * MIN })],
      [set('r1', { weight: 50, loggedAt: NOW - 18 * MIN })],
    );
    w.id = 'done';
    w.finishedAt = NOW - 5 * MIN;
    seed([w]);
    const { container } = mount('done', shell(), { past: true });
    await userEvent.click(container.querySelector('.ss-block.past .past-ex-card') as HTMLElement);
    const ghosts = container.querySelectorAll('.ss-block .ghost-row');
    expect(ghosts.length).toBeGreaterThan(0);
    await userEvent.click(ghosts[0].querySelector('.gval') as HTMLElement);
    expect(screen.getByRole('dialog')).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await userEvent.click(container.querySelector('.ss-block .ghost-row .log-btn') as HTMLElement);
    expect(mine('done').exercises.reduce((n, e) => n + e.sets.length, 0)).toBe(3);
  });

  it('a past circuit shows the rounds as plates and the volume', () => {
    const w = circuitLive(
      [set('a1', { loggedAt: NOW - 9 * MIN }), set('a2', { loggedAt: NOW - 5 * MIN })],
      [
        set('b1', { weight: null, reps: 12, loggedAt: NOW - 8 * MIN }),
        set('b2', { weight: null, reps: 10, loggedAt: NOW - 4 * MIN }),
      ],
    );
    w.id = 'done';
    w.finishedAt = NOW - 2 * MIN;
    seed([w]);
    const { container } = mount('done', shell(), { past: true });
    const rows = [...container.querySelectorAll('.cb-srow')].map((r) => r.textContent);
    expect(rows[0]).toContain('Squat');
    expect(rows[0]).toContain('R18×80');
    expect(rows[1]).toContain('R112');
    expect(container.querySelector('.cb-vol')!.textContent).toBe('1.3 t');
  });
});

// Sheets leave a 160 ms focus-settle timer behind; let it fire before the jsdom window goes away.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 250)));
