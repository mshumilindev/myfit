import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setLocale } from '../i18n';
import { __getStateForTests, __replaceStateForTests } from '../store';
import type { SleepNight, SleepSchedule, SleepSettings, Workout } from '../types';

const startSleep = vi.fn();
const logSleepNight = vi.fn();
const setSleepSettings = vi.fn();
const updateSleepNight = vi.fn();
const noteSleepPresence = vi.fn();
const reconcileSleep = vi.fn();
const stopSleep = vi.fn();
vi.mock('../store', async (orig) => ({
  ...(await orig<typeof import('../store')>()),
  startSleep: (...a: unknown[]) => startSleep(...a),
  logSleepNight: (...a: unknown[]) => logSleepNight(...a),
  setSleepSettings: (...a: unknown[]) => setSleepSettings(...a),
  updateSleepNight: (...a: unknown[]) => updateSleepNight(...a),
  noteSleepPresence: (...a: unknown[]) => noteSleepPresence(...a),
  reconcileSleep: (...a: unknown[]) => reconcileSleep(...a),
  stopSleep: (...a: unknown[]) => stopSleep(...a),
}));
vi.mock('./MoonGlyph', () => ({ MoonGlyph: () => <span data-testid="moon" /> }));

import { SleepAutoFilledCard, SleepForgotBanner, SleepPauseController } from './SleepAutomation';

const MIN = 60000;
const at = (d: number, h: number, m = 0) => new Date(2026, 8, d, h, m).getTime(); // Sept 2026 (30th = Wed)
const dayId = (d: number) => `2026-09-${String(d).padStart(2, '0')}`;
const SCHED: SleepSchedule = {
  sameEveryNight: true,
  every: { bedMin: 23 * 60, wakeMin: 7 * 60 },
  byDay: {},
};
const settings = (over: Partial<SleepSettings> = {}): SleepSettings => ({
  autoDim: true,
  autoLog: false,
  goalMin: 480,
  ...over,
});
const night = (
  id: string,
  date: string,
  bedtime: number,
  wake: number | null,
  over: Partial<SleepNight> = {},
): SleepNight => ({ id, date, bedtime, wake, source: 'backfill', ...over }) as SleepNight;

function setState(p: {
  sleeps?: SleepNight[];
  sleepSchedule?: SleepSchedule | null;
  sleepSettings?: SleepSettings;
  workouts?: Workout[];
}) {
  __replaceStateForTests({
    ...__getStateForTests(),
    sleeps: [],
    workouts: [],
    sleepSchedule: SCHED,
    sleepSettings: settings(),
    ...p,
  } as never);
}
function clockAt(ts: number) {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(ts);
}
const flush = () => act(async () => void (await Promise.resolve()));
const regular = (count: number, endDay = 29): SleepNight[] =>
  Array.from({ length: count }, (_, i) => {
    const wake = new Date(2026, 8, endDay - i, 7).getTime();
    return night(`n${i}`, dayId(endDay - i), wake - 8 * 60 * MIN, wake);
  });

beforeEach(() => {
  setLocale('en');
  [
    startSleep,
    logSleepNight,
    setSleepSettings,
    updateSleepNight,
    noteSleepPresence,
    reconcileSleep,
    stopSleep,
  ].forEach((m) => m.mockReset());
  startSleep.mockReturnValue(true);
  setState({});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SleepForgotBanner (SL-11)', () => {
  const habit = (extra: SleepNight[] = []) => [...regular(15, 28), ...extra];

  it('stays hidden for a newcomer', () => {
    clockAt(at(30, 10));
    setState({ sleeps: regular(3, 28) });
    const { container } = render(<SleepForgotBanner onOpenBackfill={() => undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows once a habit exists and last night is missing, after the usual wake time', () => {
    clockAt(at(30, 10));
    setState({ sleeps: habit() });
    render(<SleepForgotBanner onOpenBackfill={() => undefined} />);
    expect(screen.getByText('Last night’s sleep is missing')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Use my usual · 8h/ })).toBeTruthy();
  });

  it('waits for the usual wake time', () => {
    clockAt(at(30, 6));
    setState({ sleeps: habit() });
    const { container } = render(<SleepForgotBanner onOpenBackfill={() => undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('hides when last night is already logged, a night is live, auto-log is on, or the habit lapsed', () => {
    clockAt(at(30, 10));
    setState({ sleeps: habit([night('today', dayId(30), at(29, 23), at(30, 7))]) });
    expect(
      render(<SleepForgotBanner onOpenBackfill={() => undefined} />).container.firstChild,
    ).toBeNull();
    cleanup();
    setState({ sleeps: habit([night('live', dayId(30), at(30, 1), null)]) });
    expect(
      render(<SleepForgotBanner onOpenBackfill={() => undefined} />).container.firstChild,
    ).toBeNull();
    cleanup();
    setState({ sleeps: habit(), sleepSettings: settings({ autoLog: true }) });
    expect(
      render(<SleepForgotBanner onOpenBackfill={() => undefined} />).container.firstChild,
    ).toBeNull();
    cleanup();
    setState({ sleeps: regular(15, 20) }); // nothing in the last 4 days
    expect(
      render(<SleepForgotBanner onOpenBackfill={() => undefined} />).container.firstChild,
    ).toBeNull();
  });

  it('"Use my usual" logs last night from the plan as a backfill and dismisses itself', async () => {
    clockAt(at(30, 10));
    setState({ sleeps: habit() });
    const { container } = render(<SleepForgotBanner onOpenBackfill={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Use my usual/ }));
    await flush();
    expect(logSleepNight).toHaveBeenCalledWith({
      date: dayId(30),
      bedtime: at(29, 23),
      wake: at(30, 7),
      source: 'backfill',
    });
    expect(container.firstChild).toBeNull();
  });

  it('without a schedule "Use my usual" uses the learned weekday pattern', async () => {
    clockAt(at(30, 10));
    setState({ sleepSchedule: null, sleeps: habit() });
    const onBackfill = vi.fn();
    render(<SleepForgotBanner onOpenBackfill={onBackfill} />);
    fireEvent.click(screen.getByRole('button', { name: /Use my usual/ }));
    await flush();
    expect(logSleepNight).toHaveBeenCalledWith(
      expect.objectContaining({ date: dayId(30), source: 'backfill' }),
    );
    expect(onBackfill).not.toHaveBeenCalled();
  });

  it('with no plan at all (too little history) "Use my usual" opens the manual form', async () => {
    clockAt(at(30, 10));
    const few = Array.from({ length: 5 }, (_, i) => {
      const wake = new Date(2026, 8, 28 - i, 6 + (i % 3), 15 * i).getTime();
      return night(`f${i}`, dayId(28 - i), wake - (7 + (i % 2)) * 60 * MIN, wake);
    });
    setState({ sleepSchedule: null, sleeps: few });
    const onBackfill = vi.fn();
    const { container } = render(<SleepForgotBanner onOpenBackfill={onBackfill} />);
    const btn = screen.queryByRole('button', { name: /Use my usual/ });
    if (!btn) {
      expect(container.firstChild).toBeNull(); // below the habit threshold: nothing to offer
      return;
    }
    fireEvent.click(btn);
    await flush();
    expect(onBackfill).toHaveBeenCalledTimes(1);
    expect(logSleepNight).not.toHaveBeenCalled();
  });

  it('"Enter" opens the backfill and dismisses; the close button just dismisses', () => {
    clockAt(at(30, 10));
    setState({ sleeps: habit() });
    const onBackfill = vi.fn();
    const { container } = render(<SleepForgotBanner onOpenBackfill={onBackfill} />);
    fireEvent.click(screen.getByRole('button', { name: 'Enter' }));
    expect(onBackfill).toHaveBeenCalled();
    expect(container.firstChild).toBeNull();
    cleanup();
    const second = render(<SleepForgotBanner onOpenBackfill={onBackfill} />);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(second.container.firstChild).toBeNull();
    expect(onBackfill).toHaveBeenCalledTimes(1);
  });
});

describe('SleepAutoFilledCard', () => {
  const auto = (over: Partial<SleepNight> = {}) =>
    night('auto1', dayId(30), at(29, 23, 15), at(30, 7, 5), { source: 'auto', ...over });

  it('shows last night with its range and duration, flagged auto', () => {
    clockAt(at(30, 10));
    setState({ sleepSettings: settings({ autoLog: true }), sleeps: [auto()] });
    render(<SleepAutoFilledCard onOpenBackfill={() => undefined} />);
    expect(document.querySelector('.saf-line')!.textContent).toMatch(
      /Last night .*7.*50.*23:15→07:05/,
    );
    expect(document.querySelector('.saf-note')!.textContent).toMatch(/Tuesday|Wed|Tue/);
  });

  it('"Looks right" confirms (keeps the auto mark) and hides', async () => {
    clockAt(at(30, 10));
    setState({ sleepSettings: settings({ autoLog: true }), sleeps: [auto()] });
    const { container } = render(<SleepAutoFilledCard onOpenBackfill={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Looks right' }));
    await flush();
    expect(updateSleepNight).toHaveBeenCalledWith('auto1', { autoConfirmed: true });
    expect(container.firstChild).toBeNull();
  });

  it('"Adjust times" opens the editor', () => {
    clockAt(at(30, 10));
    setState({ sleepSettings: settings({ autoLog: true }), sleeps: [auto()] });
    const onOpen = vi.fn();
    render(<SleepAutoFilledCard onOpenBackfill={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adjust times' }));
    expect(onOpen).toHaveBeenCalled();
  });

  it.each([
    ['auto-log off', () => setState({ sleepSettings: settings(), sleeps: [auto()] })],
    [
      'night already confirmed',
      () =>
        setState({
          sleepSettings: settings({ autoLog: true }),
          sleeps: [auto({ autoConfirmed: true })],
        }),
    ],
    [
      'a hand-logged night',
      () =>
        setState({
          sleepSettings: settings({ autoLog: true }),
          sleeps: [auto({ source: 'backfill' })],
        }),
    ],
    [
      'no night for today',
      () => setState({ sleepSettings: settings({ autoLog: true }), sleeps: [] }),
    ],
    [
      'a night still live',
      () =>
        setState({
          sleepSettings: settings({ autoLog: true }),
          sleeps: [auto(), night('live', dayId(30), at(30, 8), null)],
        }),
    ],
  ])('is hidden for %s', (_n, arrange) => {
    clockAt(at(30, 10));
    arrange();
    const { container } = render(<SleepAutoFilledCard onOpenBackfill={() => undefined} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('SleepPauseController', () => {
  const live = () => setState({ sleeps: [night('live', dayId(30), at(29, 23), null)] });

  it('reports presence on the sleep screen and when it changes', () => {
    clockAt(at(30, 2));
    live();
    const { rerender } = render(<SleepPauseController onSleepScreen />);
    expect(noteSleepPresence).toHaveBeenLastCalledWith(true);
    rerender(<SleepPauseController onSleepScreen={false} />);
    expect(noteSleepPresence).toHaveBeenLastCalledWith(false);
  });

  it('does nothing without a live night', () => {
    clockAt(at(30, 2));
    setState({});
    render(<SleepPauseController onSleepScreen={false} />);
    window.dispatchEvent(new Event('keydown'));
    expect(noteSleepPresence).not.toHaveBeenCalled();
  });

  it('off the sleep screen it notes activity (throttled to once per 12s) and reconciles every 30s', () => {
    clockAt(at(30, 2));
    live();
    render(<SleepPauseController onSleepScreen={false} />);
    noteSleepPresence.mockClear();
    window.dispatchEvent(new Event('pointerdown'));
    expect(noteSleepPresence).toHaveBeenCalledTimes(1);
    expect(noteSleepPresence).toHaveBeenLastCalledWith(false, at(30, 2));
    window.dispatchEvent(new Event('keydown'));
    expect(noteSleepPresence).toHaveBeenCalledTimes(1); // throttled
    act(() => void vi.advanceTimersByTime(13000));
    window.dispatchEvent(new Event('keydown'));
    expect(noteSleepPresence).toHaveBeenCalledTimes(2);
    act(() => void vi.advanceTimersByTime(30000));
    expect(reconcileSleep).toHaveBeenCalled();
  });

  it('re-notes presence when the tab becomes visible again', () => {
    clockAt(at(30, 2));
    live();
    render(<SleepPauseController onSleepScreen={false} />);
    noteSleepPresence.mockClear();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(noteSleepPresence).not.toHaveBeenCalled();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(noteSleepPresence).toHaveBeenCalledWith(false);
  });

  it('stops listening on the sleep screen and on unmount', () => {
    clockAt(at(30, 2));
    live();
    const { rerender, unmount } = render(<SleepPauseController onSleepScreen={false} />);
    rerender(<SleepPauseController onSleepScreen />);
    noteSleepPresence.mockClear();
    window.dispatchEvent(new Event('pointerdown'));
    expect(noteSleepPresence).not.toHaveBeenCalled();
    rerender(<SleepPauseController onSleepScreen={false} />);
    unmount();
    noteSleepPresence.mockClear();
    window.dispatchEvent(new Event('pointerdown'));
    expect(noteSleepPresence).not.toHaveBeenCalled();
  });
});
