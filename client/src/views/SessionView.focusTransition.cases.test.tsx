import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  // jsdom has no Web Animations: a stub whose animation never finishes keeps the card mid-flight for the assertions.
  (Element.prototype as { animate?: unknown }).animate = vi.fn(
    () =>
      ({ cancel: vi.fn(), finished: new Promise<void>(() => undefined) }) as unknown as Animation,
  );
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  delete (Element.prototype as { animate?: unknown }).animate;
  vi.useRealTimers();
  cleanup();
});

// SPO-323 / SPO-326: Back/Next slide between lifts without ever blocking the member.
describe('SessionView · the step transition never blocks logging', () => {
  const three = () =>
    wk('open', [
      ex('a', 'Bench press', [set('s1', { loggedAt: NOW - 6 * MIN })], { position: 0 }),
      ex('b', 'Cable row', [], { position: 1 }),
      ex('c', 'Lat pulldown', [], { position: 2 }),
    ]);
  const current = () =>
    document.querySelector('.srail-dot[aria-current="true"]')!.getAttribute('aria-label');
  const ghosts = (c: HTMLElement) => c.querySelectorAll('.focus-ghost');

  it('Next lays an inert snapshot of the old lift over the live new one, and the new one is interactive at once', async () => {
    seed([three()]);
    const { container } = mount();
    await userEvent.click(container.querySelector('.focus-next') as HTMLElement);
    expect(current()).toBe('Cable row');
    const ghost = ghosts(container)[0] as HTMLElement;
    expect(ghost.getAttribute('aria-hidden')).toBe('true');
    expect(ghost.hasAttribute('inert')).toBe(true);
    expect(ghost.textContent).toMatch(/Bench press/);
    const live = container.querySelector('.focus-live') as HTMLElement;
    expect(live.textContent).toMatch(/Cable row/);
    // nothing in the live card is disabled or inert while the cards travel
    expect(live.hasAttribute('inert')).toBe(false);
    expect(container.querySelector('.focus-next')?.hasAttribute('disabled')).toBe(false);
  });

  it('rapid taps keep a single snapshot and land on the right lift', async () => {
    seed([three()]);
    const { container } = mount();
    const next = () => container.querySelector('.focus-next') as HTMLElement;
    await userEvent.click(next());
    await userEvent.click(next());
    expect(current()).toBe('Lat pulldown');
    expect(ghosts(container)).toHaveLength(1);
    expect(ghosts(container)[0].textContent).toMatch(/Cable row/);
    await userEvent.click(container.querySelector('.focus-back') as HTMLElement);
    expect(current()).toBe('Cable row');
    expect(ghosts(container)).toHaveLength(1);
  });

  it('nothing is written while moving: logged sets stay as they were', async () => {
    seed([three()]);
    const { container } = mount();
    const before = JSON.stringify(mine().exercises);
    await userEvent.click(container.querySelector('.focus-next') as HTMLElement);
    await userEvent.click(container.querySelector('.focus-back') as HTMLElement);
    expect(JSON.stringify(mine().exercises)).toBe(before);
  });
});
