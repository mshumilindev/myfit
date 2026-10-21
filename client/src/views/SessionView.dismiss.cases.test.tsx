import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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

describe('SessionView · every sheet can be dismissed without changing anything', () => {
  const one = () => wk('open', [ex('a', 'Bench press', [set('s1', { loggedAt: NOW - 6 * MIN })])]);
  const gone = () => waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  const snapshot = () => JSON.stringify(mine().exercises);

  it('add exercise', async () => {
    seed([one()]);
    mount();
    const before = snapshot();
    await userEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
    await userEvent.keyboard('{Escape}');
    await gone();
    expect(snapshot()).toBe(before);
  });

  it('replace exercise, from the Exercise tab', async () => {
    seed([one()]);
    const { container } = mount();
    const before = snapshot();
    await userEvent.click(
      within(container.querySelector('.focus-view') as HTMLElement).getByRole('button', {
        name: 'Set options',
      }),
    );
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('tab', { name: /Exercise/ }),
    );
    await userEvent.click(within(screen.getByRole('dialog')).getByText('Replace exercise'));
    await userEvent.keyboard('{Escape}');
    await gone();
    expect(snapshot()).toBe(before);
  });

  it('the set editor: its Exercise settings link opens the Exercise tab, Cancel closes', async () => {
    seed([one()]);
    mount();
    await userEvent.click(screen.getByRole('button', { name: /^1880\.0/ }));
    await userEvent.click(within(screen.getByRole('dialog')).getByText('Exercise settings'));
    expect(
      within(screen.getByRole('dialog'))
        .getByRole('tab', { name: /Exercise/ })
        .getAttribute('aria-selected'),
    ).toBe('true');
    await userEvent.keyboard('{Escape}');
    await gone();
    await userEvent.click(screen.getByRole('button', { name: /^1880\.0/ }));
    await userEvent.click(
      within(screen.getByRole('dialog').querySelector('.sheet-actions') as HTMLElement).getByRole(
        'button',
        { name: 'Cancel' },
      ),
    );
    await gone();
  });

  it('the coach, the gym picker and the cardio machine list', async () => {
    const wed = (id: string, d: number): Workout =>
      wk(id, [ex(id + 'e', 'Bench press', [set(id + 's')])], {
        startedAt: NOW - d * 86400000,
        finishedAt: NOW - d * 86400000 + 3600000,
      });
    seed([
      wk('open', [
        ex('tm', 'Treadmill', [], { kind: 'cardio', equipmentItems: ['cardio-treadmill'] }),
      ]),
      wed('a', 7),
      wed('b', 1),
    ]);
    const { container } = mount();
    await userEvent.click(screen.getByRole('button', { name: 'Attach a gym' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    await gone();
    await userEvent.click(screen.getByRole('button', { name: 'Change machine' }));
    await userEvent.keyboard('{Escape}');
    await gone();
    expect(mine().exercises[0].name).toBe('Treadmill');
    await userEvent.click(
      within(container.querySelector('.focus-view') as HTMLElement).getByRole('button', {
        name: 'Set options',
      }),
    );
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('tab', { name: /Session/ }));
    await userEvent.click(within(screen.getByRole('dialog')).getByText('Today’s readiness'));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.querySelector('.coach-sheet')).toBeNull());
  });

  it('the exercise details sheet opened from a suggestion goes back, or adds that lift', async () => {
    const sets = Array.from({ length: 12 }, (_, i) =>
      set(`s${i + 1}`, { loggedAt: NOW - (120 - i * 10) * 1000 }),
    );
    const hist = wk(
      'h',
      [
        ex('b0', 'Bench press', [set('x1'), set('x2')]),
        ex('i0', 'Incline press', [set('x3')], { position: 1 }),
      ],
      {
        startedAt: NOW - 3 * 86400000,
        finishedAt: NOW - 3 * 86400000 + 3000000,
      },
    );
    seed([wk('open', [ex('bench', 'Bench press', sets)]), hist]);
    const { container } = mount();
    const info = () =>
      within(container.querySelector('.tired-banner') as HTMLElement).getByRole('button', {
        name: 'Details',
      });
    await userEvent.click(info());
    const sheet = () => document.querySelector('.xp-detail-sheet') as HTMLElement;
    expect(sheet()).toBeTruthy();
    await userEvent.click(within(sheet()).getAllByRole('button', { name: /Back/ })[0]);
    await waitFor(() => expect(document.querySelector('.xp-detail-sheet')).toBeNull());
    await userEvent.click(info());
    await userEvent.click(within(sheet()).getByRole('button', { name: /^Add/ }));
    expect(mine().exercises.map((e) => e.name)).toEqual(['Bench press', 'Incline press']);
  });
});

describe('SessionView · moving through the focus view', () => {
  const twoLifts = () =>
    wk('open', [
      ex('a', 'Bench press', [set('s1', { loggedAt: NOW - 6 * MIN })], { position: 0 }),
      ex('b', 'Cable row', [], { position: 1 }),
    ]);
  const current = () =>
    document.querySelector('.srail-dot[aria-current="true"]')!.getAttribute('aria-label');

  it('Next goes to the next lift; on the last one it offers to add another', async () => {
    seed([twoLifts()]);
    const { container } = mount();
    expect(current()).toBe('Bench press');
    await userEvent.click(container.querySelector('.focus-next') as HTMLElement);
    expect(current()).toBe('Cable row');
    await userEvent.click(container.querySelector('.focus-next') as HTMLElement);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(document.querySelector('.xp-search, [role="searchbox"]')).toBeTruthy();
  });

  it('the lift photos open full size and close again', async () => {
    // jsdom has no layout: the slider scrolls to the tapped photo with scrollTo.
    Element.prototype.scrollTo = vi.fn() as never;
    seed([twoLifts()]);
    const { container } = mount();
    await userEvent.click(container.querySelector('.ex-photos') as HTMLElement);
    const slider = document.querySelector('.photo-slider') as HTMLElement;
    expect(slider.getAttribute('aria-label')).toBe('Bench press');
    await userEvent.click(slider.querySelector('.ps-close') as HTMLElement);
    expect(document.querySelector('.photo-slider')).toBeNull();
  });

  it('a muscle chip opens how that muscle stands today: sets so far and recovery', async () => {
    seed([twoLifts()]);
    const { container } = mount();
    await userEvent.click(
      within(container.querySelector('.focus-view') as HTMLElement).getAllByRole('button', {
        name: /Chest/,
      })[0],
    );
    const info = document.querySelector('.muscle-info') as HTMLElement;
    expect(info).toBeTruthy();
    expect(info.textContent).toMatch(/Chest/);
  });
});

// Sheets leave a 160 ms focus-settle timer behind; let it fire before the jsdom window goes away.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 250)));
