import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setLocale } from '../i18n';
import { __getStateForTests, __replaceStateForTests, dayKey } from '../store';
import type { Activity, RestPeriod, SleepNight, Workout } from '../types';

let rest: number | null = null;
let prescribed = new Set<number>();
let dayName: string | null = null;
vi.mock('../dayEnergy', () => ({ restingForDay: () => rest }));
vi.mock('../activities', async (orig) => ({
  ...(await orig<typeof import('../activities')>()),
  workoutCalories: () => 300,
  activityCalories: () => 150.4,
}));
vi.mock('../store', async (orig) => ({
  ...(await orig<typeof import('../store')>()),
  prescribedTrainingDays: () => prescribed,
  programDayNameForWeekday: () => dayName,
}));
vi.mock('./HistoryTimeline', () => ({
  WorkoutRow: ({ w, onOpen }: { w: Workout; onOpen: (id: string) => void }) => (
    <button onClick={() => onOpen(w.id)}>workout {w.id}</button>
  ),
  ActivityRow: ({ a, onOpen }: { a: Activity; onOpen?: (id: string) => void }) => (
    <button onClick={() => onOpen?.(a.id)}>activity {a.id}</button>
  ),
  SleepRow: ({ n, onOpen }: { n: SleepNight; onOpen?: (id: string) => void }) => (
    <button onClick={() => onOpen?.(n.id)}>sleep {n.id}</button>
  ),
}));

import { DayHistorySheet } from './DayHistorySheet';

const NOW = new Date(2026, 8, 30, 12).getTime(); // Wed 30 Sep 2026, local
const midnight = (d: number) => new Date(2026, 8, d).getTime();
const at = (d: number, h: number) => new Date(2026, 8, d, h).getTime();
const wo = (id: string, started: number, finished: number | null = started + 3600000): Workout => ({
  id,
  startedAt: started,
  finishedAt: finished,
  autoFinished: false,
  exercises: [],
});
const act = (id: string, started: number): Activity =>
  ({
    id,
    type: 'run',
    category: 'conditioning',
    startedAt: started,
    finishedAt: started + 1800000,
    durationMin: 30,
  }) as Activity;
const sleep = (id: string, wake: number | null): SleepNight =>
  ({
    id,
    date: '2026-09-28',
    bedtime: (wake ?? 0) - 8 * 3600000,
    wake,
    source: 'backfill',
  }) as SleepNight;
const restP = (over: Partial<RestPeriod>): RestPeriod =>
  ({ id: 'r', startDay: 0, endDay: 0, mode: 'off', createdAt: 1, ...over }) as RestPeriod;

function setState(p: Partial<ReturnType<typeof __getStateForTests>>) {
  __replaceStateForTests({
    ...__getStateForTests(),
    workouts: [],
    activities: [],
    sleeps: [],
    restPeriods: [],
    ...p,
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  setLocale('en');
  rest = null;
  prescribed = new Set();
  dayName = null;
  setState({});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const sheet = (
  props: Partial<React.ComponentProps<typeof DayHistorySheet>> = {},
  day = midnight(28),
) => render(<DayHistorySheet day={day} onClose={() => undefined} {...props} />);

describe('DayHistorySheet', () => {
  it('titles the sheet with the weekday and date, and is empty for a quiet day', () => {
    sheet();
    expect(document.querySelector('.day-sheet-head .t')!.textContent).toMatch(/Mon.*28/);
    expect(document.querySelector('.hist-timeline')).toBeNull();
    expect(document.querySelector('.day-energy')).toBeNull();
    expect(document.querySelector('.day-sheet-note')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start session' })).toBeNull();
  });

  it('merges workouts, activities and sleep in chronological order, only for that day', () => {
    setState({
      workouts: [
        wo('late', at(28, 18)),
        wo('unfinished', at(28, 9), null),
        wo('other-day', at(27, 10)),
      ],
      activities: [act('early', at(28, 7)), act('tomorrow', at(29, 7))],
      sleeps: [sleep('night', at(28, 6)), sleep('live', null)],
    });
    sheet();
    expect(
      [...document.querySelectorAll('.hist-timeline button')].map((b) => b.textContent),
    ).toEqual(['sleep night', 'activity early', 'workout late']);
  });

  it('includes the first and excludes the last instant of the day boundary', () => {
    setState({ workouts: [wo('edge-in', midnight(28)), wo('edge-out', midnight(29))] });
    sheet();
    expect(
      [...document.querySelectorAll('.hist-timeline button')].map((b) => b.textContent),
    ).toEqual(['workout edge-in']);
  });

  it('closes the sheet before opening an item', () => {
    const calls: string[] = [];
    setState({
      workouts: [wo('w1', at(28, 9))],
      activities: [act('a1', at(28, 10))],
      sleeps: [sleep('s1', at(28, 6))],
    });
    sheet({
      onClose: () => calls.push('close'),
      onOpenWorkout: (id) => calls.push(`w:${id}`),
      onOpenActivity: (id) => calls.push(`a:${id}`),
      onOpenSleep: (id) => calls.push(`s:${id}`),
    });
    fireEvent.click(screen.getByText('workout w1'));
    fireEvent.click(screen.getByText('activity a1'));
    fireEvent.click(screen.getByText('sleep s1'));
    expect(calls).toEqual(['close', 'w:w1', 'close', 'a:a1', 'close', 's:s1']);
  });

  it('shows the energy summary: passive + active, and totals', () => {
    rest = 1800;
    setState({ workouts: [wo('w1', at(28, 9))], activities: [act('a1', at(28, 10))] });
    sheet();
    const el = document.querySelector('.day-energy')!;
    expect(el.querySelector('.de-total')!.textContent).toContain('~2,250');
    expect(el.querySelector('.de-break')!.textContent).toBe('1800 passive · 450 active');
  });

  it('shows only the active burn when the resting burn is unknown (and only passive when idle)', () => {
    setState({ workouts: [wo('w1', at(28, 9))] });
    sheet();
    expect(document.querySelector('.de-break')!.textContent).toBe('300 active');
    cleanup();
    rest = 1700;
    setState({});
    sheet();
    expect(document.querySelector('.de-break')!.textContent).toBe('1700 passive');
    expect(document.querySelector('.de-total')!.textContent).toContain('~1,700');
  });

  it("starts today's session from the drawer", () => {
    const onStart = vi.fn();
    sheet({ onStart }, midnight(30));
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    expect(onStart).toHaveBeenCalled();
  });

  describe('day state notes', () => {
    it('a skipped program day reads "Missed session" with the day name', () => {
      prescribed = new Set([1]); // Monday
      dayName = 'Push day';
      sheet();
      expect(document.querySelector('.dsm-title')!.textContent).toBe('Missed session');
      expect(document.querySelector('.dsm-body')!.textContent).toContain('Push day');
    });

    it('falls back to the generic missed text without a day name', () => {
      prescribed = new Set([1]);
      sheet();
      expect(document.querySelector('.dsm-body')!.textContent).toBe(
        'A gym day was on your plan for this day — but nothing was logged.',
      );
    });

    it('is not "missed" when a session was done, when not planned, or when the day is today/future', () => {
      prescribed = new Set([1]);
      setState({ workouts: [wo('w1', at(28, 9))] });
      sheet();
      expect(document.querySelector('.day-sheet-note')).toBeNull();
      cleanup();
      setState({});
      prescribed = new Set([2]);
      sheet();
      expect(document.querySelector('.day-sheet-note')).toBeNull();
      cleanup();
      prescribed = new Set([3]); // Wednesday = today
      sheet({}, midnight(30));
      expect(document.querySelector('.day-sheet-note')).toBeNull();
    });

    it('a short rest period is a rest day; four or more days is time off', () => {
      const d = dayKey(midnight(28));
      setState({ restPeriods: [restP({ startDay: d, endDay: d + 2, mode: 'off' })] });
      sheet();
      expect(document.querySelector('.dsm-title')!.textContent).toBe('Rest day');
      expect(document.querySelector('.dsm-body')!.textContent).toBe(
        'Rest day — recovery, no training planned.',
      );
      cleanup();
      setState({ restPeriods: [restP({ startDay: d, endDay: d + 3, mode: 'off' })] });
      sheet();
      expect(document.querySelector('.dsm-title')!.textContent).toBe('Full rest');
      expect(document.querySelector('.dsm-body')!.textContent).toBe(
        'Time off — away from the gym.',
      );
    });

    it('illness wins regardless of length', () => {
      const d = dayKey(midnight(28));
      setState({ restPeriods: [restP({ startDay: d, endDay: d, mode: 'illness' })] });
      sheet();
      expect(document.querySelector('.dsm-title')!.textContent).toBe('Sick day');
    });

    it('an open period runs up to today', () => {
      const d = dayKey(midnight(20));
      setState({ restPeriods: [restP({ startDay: d, endDay: d, open: true, mode: 'illness' })] });
      sheet({}, midnight(28));
      expect(document.querySelector('.dsm-title')!.textContent).toBe('Sick day');
      cleanup();
      sheet({}, midnight(19)); // before the period
      expect(document.querySelector('.day-sheet-note')).toBeNull();
    });

    it('a rest note outranks a missed session', () => {
      const d = dayKey(midnight(28));
      prescribed = new Set([1]);
      setState({ restPeriods: [restP({ startDay: d, endDay: d })] });
      sheet();
      expect(document.querySelector('.dsm-title')!.textContent).toBe('Rest day');
    });
  });
});
