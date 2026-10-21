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

const benchLive = (sets: SetEntry[] = [set('s1', { loggedAt: NOW - 10 * MIN })]) =>
  wk('open', [ex('bench', 'Bench press', sets)]);
const benchSets = () => mine().exercises[0].sets;

describe('SessionView · logging sets from the focus card', () => {
  it('shows the live header and logs the proposed set with the typed reps and weight', async () => {
    seed([benchLive()]);
    const { container } = mount();
    expect(screen.getByText('In session')).toBeTruthy();
    expect(container.querySelector('.live-timer')!.textContent).toBe('30:00');
    expect(container.querySelector('.cur-set')!.textContent).toBe('Set 2');

    const card = container.querySelector('.gset') as HTMLElement;
    const reps = within(card).getByRole('group', { name: 'Reps' });
    await userEvent.click(reps.querySelectorAll('button')[1]); // +1 rep
    const weight = within(card).getByRole('group', { name: 'Weight, kg' });
    await userEvent.click(weight.querySelectorAll('button')[1]); // +2.5 kg
    await userEvent.click(screen.getByRole('button', { name: 'Log' }));

    expect(benchSets()).toHaveLength(2);
    expect(benchSets()[1]).toMatchObject({ reps: 9, weight: 82.5, position: 1, loggedAt: NOW });
    // rest before the new set = gap to the previous one (10 min = 600 s)
    expect(benchSets()[1].restSec).toBe(600);
  });

  it('blocks logging a weighted lift with no weight until one is entered', async () => {
    seed([wk('open', [ex('lat', 'Lat pulldown', [])])]);
    const { container } = mount();
    const log = screen.getByRole('button', { name: 'Log' }) as HTMLButtonElement;
    const weight = within(container.querySelector('.gset') as HTMLElement).getByRole('group', {
      name: 'Weight, kg',
    });
    const buttons = weight.querySelectorAll('button');
    await userEvent.click(buttons[1]);
    expect(log.disabled).toBe(false);
    await userEvent.click(log);
    expect(mine().exercises[0].sets).toHaveLength(1);
    expect(mine().exercises[0].sets[0].reps).toBeGreaterThan(0);
  });

  it('marks failure by hand with the flame and shows the tag on the logged set', async () => {
    seed([benchLive()]);
    const { container } = mount();
    const flame = screen.getByRole('button', { name: 'To failure' });
    expect(flame.getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(flame);
    expect(flame.getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(screen.getByRole('button', { name: 'Log' }));
    expect(benchSets()[1].failure).toBe('manual');
    expect(container.querySelector('.tag-fail')).toBeTruthy();
  });

  it('flags a set that misses the card by two or more reps as automatic failure', async () => {
    seed([benchLive()]);
    const { container } = mount();
    const minus = within(container.querySelector('.gset') as HTMLElement)
      .getByRole('group', { name: 'Reps' })
      .querySelector('button') as HTMLElement;
    for (let i = 0; i < 3; i++) await userEvent.click(minus);
    await userEvent.click(screen.getByRole('button', { name: 'Log' }));
    expect(benchSets()[1]).toMatchObject({ reps: 5, failure: 'auto', failureWhy: 'missed' });
  });

  it('continues a drop set with the drops shifted and logs them together', async () => {
    seed([
      benchLive([
        set('d1', { type: 'drop', drops: [{ reps: 8, weight: 60 }], loggedAt: NOW - 5 * MIN }),
      ]),
    ]);
    const { container } = mount();
    expect(container.querySelectorAll('.gset-part')).toHaveLength(2);
    expect(screen.getByText('Drop 1')).toBeTruthy();
    // raising the start weight carries the drop along (80 -> 82.5, 60 -> 62.5)
    const start = container.querySelectorAll('.gset-part')[0] as HTMLElement;
    await userEvent.click(
      within(start).getByRole('group', { name: 'Weight, kg' }).querySelectorAll('button')[1],
    );
    await userEvent.click(screen.getByRole('button', { name: 'Log' }));
    expect(benchSets()[1]).toMatchObject({
      type: 'drop',
      weight: 82.5,
      drops: [{ reps: 8, weight: 62.5 }],
    });
  });

  it('logs a static-dynamic hold in minutes from the seconds field', async () => {
    seed([
      benchLive([
        set('sd1', {
          reps: 1,
          weight: 20,
          type: 'static-dynamic',
          durationMin: 0.5,
          loggedAt: NOW - 3 * MIN,
        }),
      ]),
    ]);
    const { container } = mount();
    const steppers = within(
      container.querySelector('.gset.kind-static-dynamic') as HTMLElement,
    ).getAllByRole('group');
    expect(steppers).toHaveLength(3);
    const plus = steppers[2].querySelectorAll('button');
    await userEvent.click(plus[plus.length - 1]);
    await userEvent.click(screen.getByRole('button', { name: 'Log' }));
    expect(benchSets()[1].type).toBe('static-dynamic');
    expect(Math.round((benchSets()[1].durationMin ?? 0) * 60)).toBe(35);
  });

  it('deletes a logged set only after confirming, and cancel keeps it', async () => {
    seed([benchLive()]);
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Delete set' }));
    expect(screen.getByText('Delete set 1?')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(benchSets()).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Delete set' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(benchSets()).toHaveLength(0);
  });

  it('opens a logged set in the editor and saves an edited weight', async () => {
    seed([benchLive()]);
    mount();
    await userEvent.click(screen.getByRole('button', { name: /^1880\.0/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Set 1 · Bench press')).toBeTruthy();
    const weight = within(dialog).getByRole('group', { name: 'Weight, kg' });
    await userEvent.click(weight.querySelectorAll('button')[1]);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(benchSets()[0].weight).toBe(82.5);
    expect(benchSets()).toHaveLength(1);
  });
});

// Sheets leave a 160 ms focus-settle timer behind; let it fire before the jsdom window goes away.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 250)));
