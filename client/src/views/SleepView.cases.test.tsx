import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import type { SleepNight } from '../types';
import { __getStateForTests } from '../store';
import {
  DAY,
  emptyState,
  freezeClock,
  NOW,
  richState,
  seed,
  setDesktop,
} from './__fixtures__/viewKit';

const m = vi.hoisted(() => ({
  stop: vi.fn(),
  cancel: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  quality: vi.fn(),
  log: vi.fn(),
  schedule: vi.fn(),
  settings: vi.fn(),
  name: null as string | null,
}));
vi.mock('../store', async (orig) => ({
  ...(await orig<typeof import('../store')>()),
  stopSleep: (...a: unknown[]) => m.stop(...a),
  cancelSleep: (...a: unknown[]) => m.cancel(...a),
  updateSleepNight: (...a: unknown[]) => m.update(...a),
  removeSleepNight: (...a: unknown[]) => m.remove(...a),
  setSleepQuality: (...a: unknown[]) => m.quality(...a),
  logSleepNight: (...a: unknown[]) => m.log(...a),
  setSleepSchedule: (...a: unknown[]) => m.schedule(...a),
  setSleepSettings: (...a: unknown[]) => m.settings(...a),
}));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  getUsername: () => m.name,
}));

import { SleepView } from './SleepView';

const BED = NOW - 8 * 3600_000; // 04:00 on the fixed day
const live = (over: Partial<SleepNight> = {}): SleepNight => ({
  id: 'live-1',
  date: 'x',
  bedtime: BED,
  wake: null,
  source: 'live',
  ...over,
});
const withLive = (l: SleepNight = live()) =>
  seed({ ...richState(), sleeps: [l, ...richState().sleeps] });
const open = (props: Partial<React.ComponentProps<typeof SleepView>> = {}) => {
  const onClose = vi.fn();
  const out = render(<SleepView onClose={onClose} {...props} />);
  return { ...out, onClose };
};
const dlg = () => document.querySelector('[role="alertdialog"], [role="dialog"]') as HTMLElement;
const plan = (over = {}) =>
  seed({
    ...emptyState(),
    sleepSchedule: {
      sameEveryNight: true,
      every: { bedMin: 1380, wakeMin: 420 },
      byDay: {},
      ...over,
    },
  });
const cls = (c: string) => document.querySelector(c) as HTMLElement;
const hh = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

beforeEach(() => {
  freezeClock(NOW);
  setLocale('en');
  Object.values(m).forEach((f) => typeof f === 'function' && 'mockReset' in f && f.mockReset());
  m.name = null;
  setDesktop(false);
  seed(richState());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SleepView: the hub', () => {
  it('shows average, consistency, last-14 bars and the weekday rhythm', () => {
    open();
    expect(screen.getByText(en.sleepTitle)).toBeTruthy();
    const stats = [...document.querySelectorAll('.slh-stat')];
    expect(stats).toHaveLength(2);
    expect(stats[0].querySelector('.slh-stat-l')?.textContent).toMatch(/\d+/);
    expect(stats[1].querySelector('.slh-stat-v')?.textContent).toMatch(/^\d+%$/);
    expect(stats[1].textContent).toContain(en.sleepBedWithin(30));
    expect(document.querySelectorAll('.slh-bar-col').length).toBeLessThanOrEqual(14);
    expect(document.querySelectorAll('.slh-bar-col').length).toBeGreaterThan(5);
    expect(document.querySelectorAll('.slh-rcol')).toHaveLength(7);
    expect([...document.querySelectorAll('.slh-rwd')].map((x) => x.textContent)).toEqual(
      en.weekDayLetters,
    );
    expect(document.querySelectorAll('.slh-rwd.wk')).toHaveLength(2);
  });

  it('highlights nights that met the goal', () => {
    open();
    const met = document.querySelectorAll('.slh-bars .slh-bar.met').length;
    expect(met).toBeGreaterThan(0);
    expect(cls('.slh-goalmet').textContent).toBe(
      en.sleepGoalMet(met, document.querySelectorAll('.slh-bars .slh-bar').length, '8h 0m'),
    );
    expect(document.querySelectorAll('.slh-bars .slh-bar').length).toBeGreaterThan(met);
  });

  it('empty history shows the empty hint and no stats', () => {
    seed(emptyState());
    open();
    expect(screen.getByText(en.sleepEmptyHistory)).toBeTruthy();
    expect(document.querySelector('.slh-stats')).toBeNull();
  });

  it('the back arrow closes', () => {
    const { onClose } = open();
    fireEvent.click(screen.getByRole('button', { name: en.cancel }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('the two preference switches write the opposite value', () => {
    const s = __getStateForTests().sleepSettings;
    open();
    const dim = screen.getByRole('switch', { name: en.sleepAutoDimLabel });
    expect((dim as HTMLInputElement).checked ?? dim.getAttribute('aria-checked') === 'true').toBe(
      s.autoDim,
    );
    fireEvent.click(dim);
    expect(m.settings).toHaveBeenCalledWith({ autoDim: !s.autoDim });
    fireEvent.click(screen.getByRole('switch', { name: en.sleepAutoLogLabel }));
    expect(m.settings).toHaveBeenCalledWith({ autoLog: !s.autoLog });
  });

  it('uses the stored goal for the goal line', () => {
    seed({ ...richState(), sleepSettings: { ...richState().sleepSettings, goalMin: 600 } });
    open();
    expect(cls('.slh-goalmet').textContent).toContain('10h 0m');
  });
});

describe('SleepView: backfill', () => {
  const toBackfill = () => {
    const o = open();
    fireEvent.click(screen.getByText(en.sleepAddPastNight));
    return o;
  };

  it('starts as a full night from yesterday evening to this morning and shows the duration', () => {
    toBackfill();
    expect(screen.getByText(en.sleepBackfillHint)).toBeTruthy();
    expect(cls('.sleep-dur-big').textContent).toBe('7h 20m');
    expect((screen.getByLabelText(en.sleepFellAsleep) as HTMLInputElement).value).toBe('23:20');
    expect((screen.getByLabelText(en.sleepWokeUp) as HTMLInputElement).value).toBe('06:40');
  });

  it('saves a night: day-aware bedtime and wake, quality and kind', () => {
    toBackfill();
    fireEvent.click(screen.getByText(en.sleepQuality.good));
    fireEvent.click(screen.getByText(en.sleepSaveNight));
    expect(m.log).toHaveBeenCalledTimes(1);
    const arg = m.log.mock.calls[0][0];
    const bed = new Date(arg.bedtime);
    const wake = new Date(arg.wake);
    expect([bed.getDate(), bed.getHours(), bed.getMinutes()]).toEqual([
      new Date(NOW - DAY).getDate(),
      23,
      20,
    ]);
    expect([wake.getDate(), wake.getHours(), wake.getMinutes()]).toEqual([
      new Date(NOW).getDate(),
      6,
      40,
    ]);
    expect(arg).toMatchObject({ source: 'backfill', quality: 'good', kind: 'sleep' });
    // back on the hub
    expect(screen.getByText(en.sleepTitle)).toBeTruthy();
  });

  it('clicking the chosen quality twice clears it', () => {
    toBackfill();
    fireEvent.click(screen.getByText(en.sleepQuality.ok));
    fireEvent.click(screen.getByText(en.sleepQuality.ok));
    fireEvent.click(screen.getByText(en.sleepSaveNight));
    expect(m.log.mock.calls[0][0].quality).toBeNull();
  });

  it('switching to a nap presets today 14:00-14:45 and saves it as a nap', () => {
    toBackfill();
    fireEvent.click(screen.getByText(en.sleepKindNap));
    expect(cls('.sleep-dur-big').textContent).toBe('45m');
    fireEvent.click(screen.getByText(en.sleepSaveNight));
    expect(m.log.mock.calls[0][0].kind).toBe('nap');
    expect(hh(m.log.mock.calls[0][0].bedtime)).toBe('14:00');
  });

  it('switching back from nap to sleep restores the overnight preset', () => {
    toBackfill();
    fireEvent.click(screen.getByText(en.sleepKindNap));
    fireEvent.click(screen.getByText(en.sleepKindSleep));
    expect((screen.getByLabelText(en.sleepFellAsleep) as HTMLInputElement).value).toBe('23:20');
    expect(cls('.sleep-dur-big').textContent).toBe('7h 20m');
  });

  it('an inverted range is flagged and cannot be saved', () => {
    toBackfill();
    fireEvent.change(screen.getByLabelText(en.sleepWokeUp), { target: { value: '22:00' } });
    // wake 22:00 today is in the future, bed 23:20 yesterday: valid. Make wake earlier than bed instead.
    const days = document.querySelectorAll('.sleep-dayseg');
    const bedDays = days[0].querySelectorAll('button');
    fireEvent.click(bedDays[0]); // fell asleep today
    fireEvent.change(screen.getByLabelText(en.sleepWokeUp), { target: { value: '06:40' } });
    expect(screen.getByText(en.sleepRangeInvalid)).toBeTruthy();
    const save = screen.getByText(en.sleepSaveNight).closest('button') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(save);
    expect(m.log).not.toHaveBeenCalled();
  });

  it('the day strips list today and the six days before it', () => {
    toBackfill();
    const strip = document.querySelectorAll('.sleep-dayseg')[0];
    const btns = strip.querySelectorAll('button');
    expect(btns).toHaveLength(7);
    expect(btns[0].textContent).toContain(en.sleepTodayTag);
    expect(btns[1].querySelector('.dc-day')?.textContent).toBe(
      String(new Date(NOW - DAY).getDate()),
    );
  });

  it('back returns to the hub without saving', () => {
    toBackfill();
    fireEvent.click(screen.getByRole('button', { name: en.cancel }));
    expect(screen.getByText(en.sleepAddPastNight)).toBeTruthy();
    expect(m.log).not.toHaveBeenCalled();
  });

  it('deep link mode=backfill opens it directly', () => {
    open({ mode: 'backfill' });
    expect(screen.getByText(en.sleepBackfillHint)).toBeTruthy();
  });
});

describe('SleepView: schedule editor', () => {
  const toSchedule = () => {
    const o = open();
    fireEvent.click(screen.getByText(en.sleepScheduleTitle));
    return o;
  };

  it('same-every-night shows two time fields seeded from the saved plan; saving writes it', () => {
    plan();
    toSchedule();
    expect(screen.getByText(en.sleepScheduleCap)).toBeTruthy();
    expect((screen.getByLabelText(en.sleepBedtimeLabel) as HTMLInputElement).value).toBe('23:00');
    expect((screen.getByLabelText(en.sleepWokeLabel) as HTMLInputElement).value).toBe('07:00');
    fireEvent.change(screen.getByLabelText(en.sleepBedtimeLabel), { target: { value: '22:30' } });
    fireEvent.change(screen.getByLabelText(en.sleepWokeLabel), { target: { value: '06:15' } });
    fireEvent.click(screen.getByText(en.sleepSaveSchedule));
    expect(m.schedule).toHaveBeenCalledWith({
      sameEveryNight: true,
      every: { bedMin: 22 * 60 + 30, wakeMin: 6 * 60 + 15 },
      byDay: {},
    });
    expect(screen.getByText(en.sleepAddPastNight)).toBeTruthy();
  });

  it('turning off "same every night" lists one row per weekday with its duration; editing one day keeps the rest', () => {
    plan();
    toSchedule();
    fireEvent.click(screen.getByRole('switch', { name: en.sleepSameMostNights }));
    const rows = document.querySelectorAll('.slh-sched-row');
    expect(rows).toHaveLength(7);
    expect(rows[0].querySelector('.slh-sched-dur')?.textContent).toBe('8h 0m');
    const wedBed = rows[2].querySelectorAll('input')[0];
    fireEvent.change(wedBed, { target: { value: '01:00' } });
    expect(
      document.querySelectorAll('.slh-sched-row')[2].querySelector('.slh-sched-dur')?.textContent,
    ).toBe('6h 0m');
    fireEvent.click(screen.getByText(en.sleepSaveSchedule));
    const saved = m.schedule.mock.calls[0][0];
    expect(saved.sameEveryNight).toBe(false);
    expect(saved.byDay[3]).toEqual({ bedMin: 60, wakeMin: 420 });
    expect(saved.byDay[1]).toBeUndefined();
  });

  it('wake edit on a weekday row changes its length', () => {
    plan();
    toSchedule();
    fireEvent.click(screen.getByRole('switch', { name: en.sleepSameMostNights }));
    const row = document.querySelectorAll('.slh-sched-row')[6];
    fireEvent.change(row.querySelectorAll('input')[1], { target: { value: '09:00' } });
    expect(
      document.querySelectorAll('.slh-sched-row')[6].querySelector('.slh-sched-dur')?.textContent,
    ).toBe('10h 0m');
  });

  it('without a saved plan it seeds from the learned rhythm and else from 23:00-07:00', () => {
    seed({
      ...richState(),
      sleepSchedule: { sameEveryNight: true, every: null, byDay: {} } as never,
    });
    open({ mode: 'schedule' });
    const bed = (screen.getByLabelText(en.sleepBedtimeLabel) as HTMLInputElement).value;
    expect(bed).toMatch(/^\d\d:\d\d$/);
    cleanup();
    seed({
      ...emptyState(),
      sleepSchedule: { sameEveryNight: true, every: null, byDay: {} } as never,
    });
    open({ mode: 'schedule' });
    expect((screen.getByLabelText(en.sleepBedtimeLabel) as HTMLInputElement).value).toBe('23:00');
    expect((screen.getByLabelText(en.sleepWokeLabel) as HTMLInputElement).value).toBe('07:00');
  });

  it('existing per-weekday plans are used as stored', () => {
    seed({
      ...emptyState(),
      sleepSchedule: {
        sameEveryNight: false,
        every: { bedMin: 1380, wakeMin: 420 },
        byDay: { 1: { bedMin: 1320, wakeMin: 360 } },
      },
    });
    open({ mode: 'schedule' });
    const rows = document.querySelectorAll('.slh-sched-row');
    expect((rows[0].querySelectorAll('input')[0] as HTMLInputElement).value).toBe('22:00');
    expect(rows[0].querySelector('.slh-sched-dur')?.textContent).toBe('8h 0m');
    expect((rows[1].querySelectorAll('input')[0] as HTMLInputElement).value).toBe('23:00');
  });

  it('back returns to the hub; while a night is live it closes the overlay instead', () => {
    toSchedule();
    fireEvent.click(screen.getByRole('button', { name: en.cancel }));
    expect(screen.getByText(en.sleepAddPastNight)).toBeTruthy();
    cleanup();
    withLive();
    const { onClose } = open({ mode: 'schedule' });
    fireEvent.click(screen.getByRole('button', { name: en.cancel }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('saving while a night is live returns to the night screen', () => {
    withLive();
    open({ mode: 'schedule' });
    fireEvent.click(screen.getByText(en.sleepSaveSchedule));
    expect(screen.getByText(en.sleepAsleepLabel)).toBeTruthy();
  });

  it('backfill while a night is live: save returns to the night, back closes', () => {
    withLive();
    const { onClose } = open({ mode: 'backfill' });
    fireEvent.click(screen.getByRole('button', { name: en.cancel }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText(en.sleepSaveNight));
    expect(screen.getByText(en.sleepAsleepLabel)).toBeTruthy();
  });
});

describe('SleepView: a live night', () => {
  it('shows the elapsed time, the bedtime and the night-mode note', () => {
    withLive();
    open();
    expect(screen.getByText(en.sleepAsleepLabel)).toBeTruthy();
    expect(cls('.sleep-elapsed').textContent).toBe('8h 0m');
    expect(screen.getByText(en.sleepSinceClock(hh(BED)))).toBeTruthy();
    expect(screen.getByText(en.sleepNightModeNote)).toBeTruthy();
    expect(cls('.sleep-night-foot').textContent).toMatch(/\d+/);
  });

  it('ticks the elapsed clock every 30 seconds', () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    withLive();
    open();
    expect(cls('.sleep-elapsed').textContent).toBe('8h 0m');
    act(() => {
      vi.advanceTimersByTime(30 * 60_000);
    });
    expect(cls('.sleep-elapsed').textContent).toBe('8h 30m');
  });

  it('"return to app" closes the overlay', () => {
    withLive();
    const { onClose } = open();
    fireEvent.click(cls('.sleep-night-back'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('discarding asks first; cancel keeps the night, confirm cancels it and closes', () => {
    withLive();
    const { onClose } = open();
    fireEvent.click(cls('.sleep-discard'));
    const d = dlg();
    expect(within(d).getByText(en.sleepDiscardConfirm)).toBeTruthy();
    fireEvent.click(within(d).getByText(en.cancel));
    expect(m.cancel).not.toHaveBeenCalled();
    expect(dlg()).toBeNull();
    fireEvent.click(cls('.sleep-discard'));
    fireEvent.click(within(dlg()).getByRole('button', { name: en.sleepDiscard }));
    expect(m.cancel).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('wake=true opens the honest-wake screen with the bedtime-to-now duration', () => {
    withLive();
    open({ wake: true });
    expect(screen.getByText(en.sleepWakeTitle)).toBeTruthy();
    expect(cls('.sleep-wake-dur').textContent).toBe('8h 0m');
    expect(cls('.sleep-wake-about').textContent).toBe(en.sleepWakeAbout(`${hh(BED)} → ${hh(NOW)}`));
  });

  it('Stop leads to wake; Cancel goes back to the night', () => {
    withLive();
    open();
    fireEvent.click(screen.getByText(en.sleepStopAction));
    expect(screen.getByText(en.sleepWakeCap)).toBeTruthy();
    fireEvent.click(screen.getByText(en.cancel));
    expect(screen.getByText(en.sleepAsleepLabel)).toBeTruthy();
  });

  it('typing an earlier wake time updates the duration; confirm stops at that time', () => {
    withLive();
    open({ wake: true });
    const input = screen.getByPlaceholderText(en.timePlaceholder);
    fireEvent.change(input, { target: { value: '10:30' } });
    expect(cls('.sleep-wake-dur').textContent).toBe('6h 30m');
    expect(cls('.sleep-wake-about').textContent).toContain(`${hh(BED)} → 10:30`);
    m.stop.mockReturnValue({ ...live(), id: 'live-1', wake: NOW - 90 * 60_000 });
    fireEvent.click(screen.getByText(en.sleepLogAndWake('6h 30m')));
    expect(hh(m.stop.mock.calls[0][0])).toBe('10:30');
  });

  it('a wake clock earlier than bedtime lands on the next morning when that is within half a day', () => {
    vi.setSystemTime(NOW + 11.5 * 3600_000); // 23:30
    withLive(live({ bedtime: NOW + 10.5 * 3600_000 })); // bed 22:30
    open({ wake: true });
    fireEvent.change(screen.getByPlaceholderText(en.timePlaceholder), {
      target: { value: '06:00' },
    });
    expect(cls('.sleep-wake-dur').textContent).toBe('7h 30m');
  });

  it('a clock later than now (but within half a day) stays today', () => {
    withLive(live({ bedtime: NOW - 3 * 3600_000 })); // bed 09:00
    open({ wake: true });
    fireEvent.change(screen.getByPlaceholderText(en.timePlaceholder), {
      target: { value: '23:30' },
    });
    expect(cls('.sleep-wake-dur').textContent).toBe('14h 30m');
  });
});

describe('SleepView: logged card', () => {
  // The real stopSleep finishes the live night in the store; mimic that so the card reads the finished night.
  const finishNight = (over: Partial<SleepNight> = {}) => {
    const night: SleepNight = { ...live(), wake: NOW, quality: null, ...over };
    m.stop.mockImplementation(() => {
      seed({ ...richState(), sleeps: [night, ...richState().sleeps] });
      return night;
    });
    return night;
  };
  const wakeUp = (l: SleepNight = live()) => {
    withLive(l);
    return open({ wake: true });
  };

  it('confirming the wake shows the logged night with duration, range, goal and rhythm', () => {
    m.name = 'Ola';
    const night = finishNight();
    wakeUp();
    fireEvent.click(screen.getByText(en.sleepLogAndWake('8h 0m')));
    expect(m.stop).toHaveBeenCalledWith(NOW);
    expect(screen.getByText(en.sleepLogged)).toBeTruthy();
    expect(screen.getByText(en.sleepGoodMorningName('Ola'))).toBeTruthy();
    expect(cls('.sleep-bignum').textContent).toBe('8h 0m');
    expect(cls('.sleep-range').textContent).toBe(`${hh(night.bedtime)} → ${hh(NOW)}`);
    expect(screen.getByText(en.sleepYourGoal('8h 0m'))).toBeTruthy();
    expect(screen.getByText(en.sleepOnRhythm(100))).toBeTruthy();
    expect(screen.getByText(en.sleepAlreadyFeeding)).toBeTruthy();
  });

  it('without a username the greeting is the plain wake title', () => {
    finishNight();
    wakeUp();
    fireEvent.click(screen.getByText(en.sleepLogAndWake('8h 0m')));
    expect(cls('.sleep-h1').textContent).toBe(en.sleepWakeTitle);
  });

  it('setting quality writes it; the selected one is toggled off', () => {
    finishNight({ quality: 'ok' });
    wakeUp();
    fireEvent.click(screen.getByText(en.sleepLogAndWake('8h 0m')));
    fireEvent.click(screen.getByText(en.sleepQuality.good));
    expect(m.quality).toHaveBeenLastCalledWith('live-1', 'good');
    fireEvent.click(screen.getByText(en.sleepQuality.ok));
    expect(m.quality).toHaveBeenLastCalledWith('live-1', null);
  });

  it('Done closes the overlay', () => {
    finishNight();
    const { onClose } = wakeUp();
    fireEvent.click(screen.getByText(en.sleepLogAndWake('8h 0m')));
    fireEvent.click(screen.getByText(en.done));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a nap is logged without the goal row and with the nap wording', () => {
    const bed = NOW - 40 * 60_000;
    finishNight({ kind: 'nap', bedtime: bed });
    wakeUp(live({ bedtime: bed, kind: 'nap' }));
    fireEvent.click(screen.getByText(en.sleepLogAndWake('40m')));
    expect(screen.getByText(en.sleepNapLogged)).toBeTruthy();
    expect(cls('.sleep-h1').textContent).toBe(en.sleepKindNap);
    expect(document.querySelector('.sleep-goalrow')).toBeNull();
  });

  it('shows the most recent finished night when stop returns nothing', () => {
    m.stop.mockImplementation(() => {
      seed({ ...richState() });
      return null;
    });
    const { container } = wakeUp();
    fireEvent.click(screen.getByText(en.sleepLogAndWake('8h 0m')));
    expect(screen.getByText(en.sleepLogged)).toBeTruthy();
    expect(container.querySelector('.sleep-range')?.textContent).toMatch(/^\d\d:\d\d → \d\d:\d\d$/);
  });
});
