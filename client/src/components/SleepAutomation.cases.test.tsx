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

import { SleepAutomation, planFor } from './SleepAutomation';

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

describe('planFor', () => {
  it('prefers the schedule, then the learned weekday pattern, else null', () => {
    clockAt(at(30, 12));
    setState({});
    expect(planFor(__getStateForTests(), 3, Date.now())).toEqual({ bedMin: 1380, wakeMin: 420 });
    setState({ sleepSchedule: null });
    expect(planFor(__getStateForTests(), 3, Date.now())).toBeNull();
    setState({ sleepSchedule: null, sleeps: regular(10) });
    const p = planFor(__getStateForTests(), new Date(at(29, 23)).getDay(), Date.now());
    expect(p).toEqual({ bedMin: 23 * 60, wakeMin: 7 * 60 });
  });
});

describe('SleepAutomation · auto-dim (SL-08)', () => {
  it('offers to start sleep at the usual bedtime, with the moon and the bedtime clock', () => {
    clockAt(at(30, 23, 30));
    render(<SleepAutomation onOpenSchedule={() => undefined} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('It’s your bedtime')).toBeTruthy();
    expect(screen.getByText(/23:00/)).toBeTruthy();
    expect(screen.getByTestId('moon')).toBeTruthy();
    expect(document.querySelector('.sad-foot')!.textContent).toMatch(/Auto-dim follows/);
  });

  it('"Start sleep" records the night as handled and starts sleep', async () => {
    clockAt(at(30, 23, 30));
    render(<SleepAutomation onOpenSchedule={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start sleep' }));
    expect(setSleepSettings).toHaveBeenCalledWith({ lastDimDay: dayId(30) });
    await flush();
    expect(startSleep).toHaveBeenCalledTimes(1);
  });

  it('is blocked by a running workout: button disabled with the reason', () => {
    clockAt(at(30, 23, 30));
    setState({
      workouts: [
        { id: 'w', startedAt: at(30, 22), finishedAt: null, autoFinished: false, exercises: [] },
      ],
    });
    render(<SleepAutomation onOpenSchedule={() => undefined} />);
    expect(
      (screen.getByRole('button', { name: 'Start sleep' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(document.querySelector('.sad-foot')!.textContent).toBe(
      'Finish your workout before starting sleep.',
    );
  });

  it('"Not yet" hides it for 15 minutes, then it comes back', () => {
    clockAt(at(30, 23, 30));
    render(<SleepAutomation onOpenSchedule={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Not yet — 15 min' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => void vi.advanceTimersByTime(14 * MIN + 1000));
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => void vi.advanceTimersByTime(2 * MIN));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('"Keep app lit" dismisses it for the night and remembers it', () => {
    clockAt(at(30, 23, 30));
    render(<SleepAutomation onOpenSchedule={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Keep app lit' }));
    expect(setSleepSettings).toHaveBeenCalledWith({ lastDimDay: dayId(30) });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each([
    ['outside the 3h window', at(30, 3, 30), {}],
    ['before bedtime', at(30, 21), {}],
    ['already handled tonight', at(30, 23, 30), { lastDimDay: dayId(30) }],
    ['auto-dim off', at(30, 23, 30), { autoDim: false }],
    ['auto-log on', at(30, 23, 30), { autoLog: true }],
  ] as const)('stays quiet: %s', (_n, ts, over) => {
    clockAt(ts);
    setState({ sleepSettings: settings(over as Partial<SleepSettings>) });
    render(<SleepAutomation onOpenSchedule={() => undefined} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('stays quiet with no plan at all, or with a night already running', () => {
    clockAt(at(30, 23, 30));
    setState({ sleepSchedule: null });
    const a = render(<SleepAutomation onOpenSchedule={() => undefined} />);
    expect(a.container.firstChild).toBeNull();
    a.unmount();
    setState({ sleeps: [night('live', dayId(30), at(30, 23), null)] });
    render(<SleepAutomation onOpenSchedule={() => undefined} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('SleepAutomation · auto-log offer (SL-09)', () => {
  const offerState = (over: Partial<SleepSettings> = {}) => {
    setState({
      sleepSchedule: null,
      sleeps: regular(45),
      sleepSettings: settings({ autoDim: false, ...over }),
    });
  };

  it('offers auto-log once 6+ weeks of consistent history earn it', () => {
    clockAt(at(30, 12));
    offerState();
    render(<SleepAutomation onOpenSchedule={() => undefined} />);
    expect(screen.getByText('Turn on auto-log')).toBeTruthy();
    expect(document.querySelectorAll('.sao-rcol')).toHaveLength(7);
    expect(document.querySelectorAll('.sao-rbar.wk')).toHaveLength(2);
  });

  it('accepting turns auto-log on and closes the offer', () => {
    clockAt(at(30, 12));
    offerState();
    render(<SleepAutomation onOpenSchedule={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Turn on auto-log/ }));
    expect(setSleepSettings).toHaveBeenCalledWith({ autoLog: true, patternOffer: 'accepted' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('declining remembers the choice', () => {
    clockAt(at(30, 12));
    offerState();
    render(<SleepAutomation onOpenSchedule={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(setSleepSettings).toHaveBeenCalledWith({ patternOffer: 'declined' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('"Manage sleep" opens the schedule and closes the offer', () => {
    clockAt(at(30, 12));
    offerState();
    const onOpenSchedule = vi.fn();
    render(<SleepAutomation onOpenSchedule={onOpenSchedule} />);
    fireEvent.click(screen.getByRole('button', { name: 'Manage sleep' }));
    expect(onOpenSchedule).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each([
    ['already declined', { patternOffer: 'declined' as const }],
    ['already accepted', { patternOffer: 'accepted' as const }],
    ['auto-log already on', { autoLog: true }],
  ])('is not offered when %s', (_n, over) => {
    clockAt(at(30, 12));
    offerState(over);
    render(<SleepAutomation onOpenSchedule={() => undefined} />);
    expect(screen.queryByText('Manage sleep')).toBeNull();
  });

  it('is not offered with too little history', () => {
    clockAt(at(30, 12));
    setState({
      sleepSchedule: null,
      sleeps: regular(10),
      sleepSettings: settings({ autoDim: false }),
    });
    render(<SleepAutomation onOpenSchedule={() => undefined} />);
    expect(screen.queryByText('Manage sleep')).toBeNull();
  });
});

describe('SleepAutomation · auto-fill & full auto (SL-10)', () => {
  const on = (over: Partial<SleepSettings> = {}) =>
    settings({ autoLog: true, autoDim: false, ...over });

  it('fills the missing mornings of the last three days from the schedule', async () => {
    clockAt(at(30, 9));
    setState({ sleepSettings: on() });
    render(<SleepAutomation onOpenSchedule={() => undefined} />);
    await flush();
    const logged = logSleepNight.mock.calls.map((c) => c[0]);
    expect(logged.map((n) => n.date)).toEqual([dayId(30), dayId(29), dayId(28)]);
    expect(logged[0]).toEqual({
      date: dayId(30),
      bedtime: at(29, 23),
      wake: at(30, 7),
      source: 'auto',
    });
  });

  it('skips mornings already logged, explicitly discarded, or whose wake time has not come', async () => {
    clockAt(at(30, 6));
    setState({
      sleepSettings: on({ skippedAutoSleepDates: [dayId(29)] }),
      sleeps: [night('n28', dayId(28), at(27, 23), at(28, 7))],
    });
    render(<SleepAutomation onOpenSchedule={() => undefined} />);
    await flush();
    // 30th: wake 07:00 not reached; 29th: skipped; 28th: exists
    expect(logSleepNight).not.toHaveBeenCalled();
  });

  it('does not log a sleep it already has under another date', async () => {
    clockAt(at(30, 9));
    setState({
      sleepSettings: on(),
      sleeps: [night('dup', 'other-key', at(29, 23), at(30, 7))],
    });
    render(<SleepAutomation onOpenSchedule={() => undefined} />);
    await flush();
    expect(logSleepNight.mock.calls.map((c) => c[0].date)).not.toContain(dayId(30));
  });

  it('does nothing when auto-log is off', async () => {
    clockAt(at(30, 9));
    setState({ sleepSettings: settings({ autoDim: false }) });
    render(<SleepAutomation onOpenSchedule={() => undefined} />);
    await flush();
    expect(logSleepNight).not.toHaveBeenCalled();
    expect(startSleep).not.toHaveBeenCalled();
  });

  it("starts tonight's night at the scheduled bedtime and remembers the evening", async () => {
    clockAt(at(30, 23, 10));
    setState({ sleepSettings: on(), sleeps: [night('n29', dayId(30), at(29, 23), at(30, 7))] });
    render(<SleepAutomation onOpenSchedule={() => undefined} />);
    await flush();
    expect(startSleep).toHaveBeenCalledWith(at(30, 23), 'auto', at(30, 23) + 8 * 60 * MIN);
    expect(setSleepSettings).toHaveBeenCalledWith({ lastAutoNight: '2026-10-01' });
  });

  it('retries next tick when sleep could not start (blocked), without recording it', async () => {
    clockAt(at(30, 23, 10));
    startSleep.mockReturnValue(false);
    setState({ sleepSettings: on(), sleeps: [night('n29', dayId(30), at(29, 23), at(30, 7))] });
    render(<SleepAutomation onOpenSchedule={() => undefined} />);
    await flush();
    expect(startSleep).toHaveBeenCalledTimes(1);
    expect(setSleepSettings).not.toHaveBeenCalled();
    startSleep.mockReturnValue(true);
    act(() => void vi.advanceTimersByTime(61 * 1000));
    await flush();
    expect(startSleep).toHaveBeenCalledTimes(2);
    expect(setSleepSettings).toHaveBeenCalledWith({ lastAutoNight: '2026-10-01' });
  });

  it('does not start twice for the same evening', async () => {
    clockAt(at(30, 23, 10));
    setState({
      sleepSettings: on({ lastAutoNight: '2026-10-01' }),
      sleeps: [night('n29', dayId(30), at(29, 23), at(30, 7))],
    });
    render(<SleepAutomation onOpenSchedule={() => undefined} />);
    await flush();
    expect(startSleep).not.toHaveBeenCalled();
  });

  it('does not auto-start outside the bedtime window', async () => {
    clockAt(at(30, 15));
    setState({ sleepSettings: on(), sleeps: [night('n', dayId(30), at(29, 23), at(30, 7))] });
    render(<SleepAutomation onOpenSchedule={() => undefined} />);
    await flush();
    expect(startSleep).not.toHaveBeenCalled();
  });

  it('ends a live night at the scheduled wake time', async () => {
    clockAt(at(30, 7, 30));
    const live = night('live', dayId(30), at(29, 23), null, { autoWakeAt: at(30, 7) });
    setState({ sleepSettings: on(), sleeps: [live] });
    render(<SleepAutomation onOpenSchedule={() => undefined} />);
    await flush();
    expect(stopSleep).toHaveBeenCalledWith(at(30, 7), 'auto');
    expect(updateSleepNight).not.toHaveBeenCalled();
  });

  it('keeps a live night running before the wake time, syncing autoWakeAt', async () => {
    clockAt(at(30, 3));
    const live = night('live', dayId(30), at(29, 23), null);
    setState({ sleepSettings: on(), sleeps: [live] });
    render(<SleepAutomation onOpenSchedule={() => undefined} />);
    await flush();
    expect(updateSleepNight).toHaveBeenCalledWith('live', { autoWakeAt: at(30, 7) });
    expect(stopSleep).not.toHaveBeenCalled();
  });

  it('does not touch a live night when auto-log is off or there is no plan', async () => {
    clockAt(at(30, 9));
    setState({
      sleepSettings: settings({ autoDim: false }),
      sleeps: [night('live', dayId(30), at(30, 1), null)],
    });
    render(<SleepAutomation onOpenSchedule={() => undefined} />);
    await flush();
    expect(stopSleep).not.toHaveBeenCalled();
    expect(updateSleepNight).not.toHaveBeenCalled();
  });

  it('force-closes a night left open for more than 16 hours, at a normal length', async () => {
    clockAt(at(30, 20));
    const live = night('old', dayId(29), at(29, 23), null);
    setState({ sleepSettings: settings({ autoDim: false }), sleeps: [live] });
    render(<SleepAutomation onOpenSchedule={() => undefined} />);
    await flush();
    expect(stopSleep).toHaveBeenCalledWith(at(29, 23) + 8 * 60 * MIN, 'auto');
  });

  it('uses 8h for the forced close when there is no plan', async () => {
    clockAt(at(30, 20));
    setState({
      sleepSchedule: null,
      sleepSettings: settings({ autoDim: false }),
      sleeps: [night('old', dayId(29), at(29, 23), null)],
    });
    render(<SleepAutomation onOpenSchedule={() => undefined} />);
    await flush();
    expect(stopSleep).toHaveBeenCalledWith(at(29, 23) + 8 * 60 * MIN, 'auto');
  });
});
