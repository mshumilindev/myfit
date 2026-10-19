import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Shell } from '../App';
import { COACH_DEFAULT } from '../atlas/types';
import { emptyCycleState } from '../cycle/cycleState';
import { __getStateForTests, __replaceStateForTests, exerciseRestSec } from '../store';
import type { Exercise, SetEntry, Workout } from '../types';
import { SessionView } from './SessionView';
import * as restTimer from '../restTimer';
import * as push from '../push';

// Wednesday 14 Oct 2026, 18:00 local — fixed wall clock; all timers are faked, so clicks go through a fireEvent shim.
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
    exerciseRest: {},
    restPrefs: { vibrate: true, sound: true, keepAwake: true, notify: false },
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
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
  document.querySelectorAll('.portal-layer').forEach((n) => n.remove());
});

// Boundaries: the alert (audio / vibration / notification), the wake lock and web push.
vi.mock('../restTimer', async (orig) => ({
  ...(await orig<typeof import('../restTimer')>()),
  restAlert: vi.fn(),
  primeRestAudio: vi.fn(),
  requestRestNotifications: vi.fn(async () => true),
  useWakeLock: vi.fn(),
}));
vi.mock('../push', async (orig) => ({
  ...(await orig<typeof import('../push')>()),
  pushState: vi.fn(() => 'off'),
  enablePush: vi.fn(async () => 'on'),
  scheduleRestPush: vi.fn(),
  cancelRestPush: vi.fn(),
}));

// userEvent hangs under vitest fake timers (RTL's async drain waits on a faked setTimeout).
const user = () => ({
  click: async (el: Element) => {
    fireEvent.click(el);
    await act(async () => {});
    await act(async () => {});
  },
});
const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
/** A bench session whose last set was logged `agoSec` seconds ago, rest pinned to 2:00. */
function resting(agoSec: number, sets: SetEntry[] | null = null): Workout {
  return wk('open', [
    ex('bench', 'Bench press', sets ?? [set('s1', { loggedAt: NOW - agoSec * 1000 })]),
  ]);
}
const pin = (sec: number) => seed([resting(30)], { exerciseRest: { 'bench press': sec } });
const clock = (c: HTMLElement) => c.querySelector('.rst-time')!.textContent;

beforeEach(() => {
  vi.mocked(restTimer.restAlert).mockClear();
  vi.mocked(push.scheduleRestPush).mockClear();
  vi.mocked(push.cancelRestPush).mockClear();
  vi.mocked(push.pushState).mockReturnValue('off');
});

describe('SessionView · rest timer', () => {
  it('counts down to the pinned target, shows what is next, and ticks every second', () => {
    pin(120);
    const { container } = mount();
    expect(clock(container)).toBe('1:30');
    expect(container.querySelector('.rst-of')!.textContent).toBe('of 2:00');
    expect(container.querySelector('.rst-next')!.textContent).toBe('Next: Set 2 · 80 × 8');
    expect(container.querySelector('.rst-card.done')).toBeNull();
    tick(5000);
    expect(clock(container)).toBe('1:25');
  });

  it('±15 s moves the goal for this rest only', async () => {
    pin(120);
    const { container } = mount();
    const u = user();
    await u.click(screen.getByRole('button', { name: 'Rest 15 s more' }));
    expect(container.querySelector('.rst-of')!.textContent).toBe('of 2:15');
    expect(clock(container)).toBe('1:45');
    await u.click(screen.getByRole('button', { name: 'Rest 15 s less' }));
    await u.click(screen.getByRole('button', { name: 'Rest 15 s less' }));
    expect(container.querySelector('.rst-of')!.textContent).toBe('of 1:45');
  });

  it('turns to GO with the overtime once the target has passed, and hides after ten minutes of it', () => {
    pin(120);
    const { container } = mount();
    tick(100_000);
    expect(container.querySelector('.rst-card.done')).toBeTruthy();
    expect(container.querySelector('.rst-go')!.textContent).toBe('GO');
    expect(clock(container)).toBe('+0:10');
    expect(container.querySelector('.rst-btns')).toBeNull();
    tick(11 * 60_000);
    expect(container.querySelector('.rst-card')).toBeNull();
  });

  it('fires the end-of-rest alert once, at the due time, with the next set in the note', () => {
    pin(120);
    mount();
    const alert = vi.mocked(restTimer.restAlert);
    tick(89_000);
    expect(alert).not.toHaveBeenCalled();
    tick(2000);
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][1]).toEqual({ title: 'Rest done', body: 'Next: Set 2 · 80 × 8' });
    tick(60_000);
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it('keeps the screen awake while resting', () => {
    pin(120);
    mount();
    expect(vi.mocked(restTimer.useWakeLock)).toHaveBeenCalledWith(true);
  });

  it('with notifications on, schedules the push for the due time and cancels it near the end while visible', () => {
    seed([resting(30)], {
      exerciseRest: { 'bench press': 120 },
      restPrefs: { vibrate: true, sound: true, keepAwake: true, notify: true },
    });
    mount();
    expect(vi.mocked(push.scheduleRestPush)).toHaveBeenCalledWith(
      's1',
      NOW + 90_000,
      'Rest done',
      'Next: Set 2 · 80 × 8',
    );
    tick(88_000);
    expect(vi.mocked(push.cancelRestPush)).toHaveBeenCalledWith('s1');
  });

  it('cancels the push when the screen goes away before the end', () => {
    seed([resting(30)], {
      exerciseRest: { 'bench press': 120 },
      restPrefs: { vibrate: true, sound: true, keepAwake: true, notify: true },
    });
    const { unmount } = mount();
    unmount();
    expect(vi.mocked(push.cancelRestPush)).toHaveBeenCalledWith('s1');
  });

  it('logging the next set restarts the rest from that moment', async () => {
    pin(120);
    const { container } = mount();
    const u = user();
    tick(10_000);
    await u.click(screen.getByRole('button', { name: 'Log' }));
    expect(clock(container)).toBe('2:00');
    expect(mine().exercises[0].sets[1].restSec).toBe(40);
    expect(mine().exercises[0].sets[1].restTargetSec).toBe(120);
  });

  it('says a failure was read automatically, and "Not a failure" clears it', async () => {
    seed(
      [
        resting(5, [
          set('s1', { reps: 5, failure: 'auto', failureWhy: 'missed', loggedAt: NOW - 5000 }),
        ]),
      ],
      { exerciseRest: { 'bench press': 120 } },
    );
    const { container } = mount();
    expect(container.querySelector('.fail-note')!.textContent).toContain('Not failure');
    await user().click(
      within(container.querySelector('.fail-note') as HTMLElement).getByRole('button'),
    );
    expect(mine().exercises[0].sets[0].failure).toBe('no');
    expect(container.querySelector('.fail-note')).toBeNull();
  });

  it('calls a rest cut short only when it fell under 80% of the plan', () => {
    // plan 2:00, so the line is 1:36; the work time of 30 s is taken off each gap
    seed([
      wk('open', [
        ex('bench', 'Bench press', [
          set('s1', { loggedAt: NOW - 40 * MIN }),
          set('s2', { loggedAt: NOW - 40 * MIN + 100_000, restTargetSec: 120 }),
          set('s3', { loggedAt: NOW - 40 * MIN + 100_000 + 126_000, restTargetSec: 120 }),
        ]),
      ]),
    ]);
    const { container } = mount();
    expect([...container.querySelectorAll('.set-rest')].map((e) => e.textContent)).toEqual([
      'Rest 1:10 of 2:00 · cut short',
      'Rest 1:36',
    ]);
  });

  it('flags a long rest only once it is also a full minute past the plan', () => {
    // plan 0:40: 1:30 is over 150% but only 50 s late, 1:40 is a full minute late
    seed([
      wk('open', [
        ex('bench', 'Bench press', [
          set('s1', { loggedAt: NOW - 40 * MIN }),
          set('s2', { loggedAt: NOW - 40 * MIN + 120_000, restTargetSec: 40 }),
          set('s3', { loggedAt: NOW - 40 * MIN + 120_000 + 130_000, restTargetSec: 40 }),
        ]),
      ]),
    ]);
    const { container } = mount();
    const lines = [...container.querySelectorAll('.set-rest')].map((e) => [
      e.className.replace('set-rest', '').trim(),
      e.textContent,
    ]);
    expect(lines).toEqual([
      ['', 'Rest 1:30'],
      ['long', 'Rest 1:40 of 0:40 · ran long'],
    ]);
  });

  it('marks a rest cut short and one that ran long in the set table', () => {
    seed([
      wk('open', [
        ex('bench', 'Bench press', [
          set('s1', { loggedAt: NOW - 40 * MIN }),
          set('s2', { loggedAt: NOW - 40 * MIN + 70_000, restTargetSec: 120 }),
          set('s3', { loggedAt: NOW - 40 * MIN + 500_000, restTargetSec: 120 }),
          set('s4', { loggedAt: NOW - 40 * MIN + 630_000, restTargetSec: 120 }),
        ]),
      ]),
    ]);
    const { container } = mount();
    const lines = [...container.querySelectorAll('.set-rest')].map((e) => [
      e.className.replace('set-rest', '').trim(),
      e.textContent,
    ]);
    expect(lines).toEqual([
      ['short', 'Rest 0:40 of 2:00 · cut short'],
      ['long', 'Rest 6:40 of 2:00 · ran long'],
      ['', 'Rest 1:40'],
    ]);
  });
});

describe('SessionView · rest settings sheet', () => {
  const openSheet = async (c: HTMLElement) => {
    await user().click(c.querySelector('.rst-ring') as HTMLElement);
    return [...document.querySelectorAll('.rest-sheet')].at(-1) as HTMLElement;
  };

  it('opens from the ring with the automatic plan and the reasons behind it', async () => {
    seed([resting(30)]);
    const { container } = mount();
    const s = await openSheet(container);
    expect(s.querySelector('.rest-auto')!.className).toContain('is-selected');
    expect(s.querySelector('.rest-why-box')).toBeTruthy();
    expect(s.querySelectorAll('.rest-why-chips > *').length).toBeGreaterThan(0);
    expect(s.querySelectorAll('.rest-presets > *')).toHaveLength(8);
  });

  it('pins a preset for the lift on Save and the card follows it', async () => {
    seed([resting(30)]);
    const { container } = mount();
    const s = await openSheet(container);
    await user().click(within(s).getByRole('button', { name: '3:00' }));
    await user().click(
      within(s.querySelector('.sheet-actions') as HTMLElement).getByRole('button', {
        name: 'Save',
      }),
    );
    expect(exerciseRestSec('Bench press')).toBe(180);
    expect(container.querySelector('.rst-of')!.textContent).toBe('of 3:00');
  });

  it('Auto after a pin hands the choice back to the plan', async () => {
    pin(90);
    const { container } = mount();
    const s = await openSheet(container);
    expect(s.querySelector('.rest-auto')!.className).not.toContain('is-selected');
    await user().click(s.querySelector('.rest-auto') as HTMLElement);
    await user().click(
      within(s.querySelector('.sheet-actions') as HTMLElement).getByRole('button', {
        name: 'Save',
      }),
    );
    expect(exerciseRestSec('Bench press')).toBeNull();
  });

  it('Cancel changes nothing; the alert preferences save with Save', async () => {
    seed([resting(30)]);
    const { container } = mount();
    let s = await openSheet(container);
    await user().click(within(s).getByRole('switch', { name: /Vibrat/ }));
    await user().click(
      within(s.querySelector('.sheet-actions') as HTMLElement).getByRole('button', {
        name: 'Cancel',
      }),
    );
    expect(__getStateForTests().restPrefs).toMatchObject({ vibrate: true });
    tick(400);
    s = await openSheet(container);
    await user().click(within(s).getByRole('switch', { name: /Vibrat/ }));
    await user().click(
      within(s.querySelector('.sheet-actions') as HTMLElement).getByRole('button', {
        name: 'Save',
      }),
    );
    expect(__getStateForTests().restPrefs).toMatchObject({ vibrate: false });
  });

  it('turning notifications on asks the browser (push when supported) and reports a refusal', async () => {
    seed([resting(30)]);
    const { container } = mount();
    const s = await openSheet(container);
    const sw = () => within(s).getByRole('switch', { name: /notif/i });
    vi.mocked(push.enablePush).mockResolvedValueOnce('denied');
    await user().click(sw());
    expect(s.querySelector('.rest-push-hint')).toBeTruthy();
    expect((sw() as HTMLInputElement).checked).toBe(false);
    await user().click(sw());
    expect(s.querySelector('.rest-push-hint')).toBeNull();
    expect((sw() as HTMLInputElement).checked).toBe(true);
  });

  it('on an iPhone not yet installed, notifications point to installing the app', async () => {
    vi.mocked(push.pushState).mockReturnValue('needs-install');
    seed([resting(30)]);
    const { container } = mount();
    const s = await openSheet(container);
    await user().click(within(s).getByRole('switch', { name: /notif/i }));
    expect(s.querySelector('.rest-push-hint')!.textContent).toMatch(/home screen|install/i);
  });

  it('where push is unsupported it falls back to the plain notification permission, and Test plays the alert', async () => {
    vi.mocked(push.pushState).mockReturnValue('unsupported');
    seed([resting(30)]);
    const { container } = mount();
    const s = await openSheet(container);
    await user().click(within(s).getByRole('switch', { name: /notif/i }));
    expect(vi.mocked(restTimer.requestRestNotifications)).toHaveBeenCalled();
    await user().click(s.querySelector('.rest-test') as HTMLElement);
    expect(vi.mocked(restTimer.restAlert)).toHaveBeenCalledTimes(1);
  });
});

// Sheets leave a 160 ms focus-settle timer behind; let it fire before the jsdom window goes away.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 250)));
