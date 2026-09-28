import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { HealthView, type HealthViewProps } from './HealthView';
import { __getStateForTests, __replaceStateForTests } from '../store';
import { ymdToDay } from '../health';
import { setLocale } from '../i18n';
import type { Shell } from '../App';
import type { Injury, RestPeriod, Workout } from '../types';

// Saturday 26 Sep 2026, noon — the design's "today".
const NOW = new Date(2026, 8, 26, 12, 0).getTime();
const D = (m: number, d: number) => ymdToDay(2026, m - 1, d);

const period = (over: Partial<RestPeriod>): RestPeriod => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  startDay: D(9, 1),
  endDay: D(9, 1),
  mode: 'off',
  createdAt: 1,
  ...over,
});

const knee: Injury = {
  id: 'knee',
  reason: 'injury',
  bodyPart: 'knee',
  side: 'left',
  muscles: ['quads'],
  stage: 'reintroduce',
  startDay: D(9, 20),
  createdAt: 1,
  checkins: [],
  healedDay: null,
};

const workout = (id: string, m: number, d: number): Workout => ({
  id,
  startedAt: new Date(2026, m - 1, d, 18, 0).getTime(),
  finishedAt: new Date(2026, m - 1, d, 18, 52).getTime(),
  autoFinished: false,
  dayName: 'Upper body',
  exercises: [],
});

function seed(restPeriods: RestPeriod[], injuries: Injury[] = [], workouts: Workout[] = []) {
  __replaceStateForTests({
    ...__getStateForTests(),
    restPeriods,
    injuries,
    workouts,
    sleeps: [],
    activities: [],
  });
}

function shellMock(): Shell {
  return {
    openOverlay: vi.fn(),
    replaceOverlay: vi.fn(),
    goTab: vi.fn(),
    goPlaybook: vi.fn(),
    openStart: vi.fn(),
    toast: vi.fn(),
    snack: vi.fn(),
    signOut: vi.fn(),
    queueLength: 0,
  };
}

function setDesktop(on: boolean): void {
  window.matchMedia = ((q: string) => ({
    matches: on && q.includes('min-width'),
    media: q,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function view(p: Partial<HealthViewProps> = {}, shell = shellMock()) {
  const onClose = vi.fn();
  render(<HealthView shell={shell} onClose={onClose} {...p} />);
  return { shell, onClose };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  localStorage.clear();
  setLocale('en');
  setDesktop(false);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Health home (mobile)', () => {
  it('f01: nothing active — status, sleep, start, log the past, history', () => {
    seed([
      period({ id: 'flu', mode: 'illness', startDay: D(9, 12), endDay: D(9, 18), name: 'Flu' }),
    ]);
    const { shell } = view();
    expect(screen.getByText('All clear')).toBeTruthy();
    expect(screen.getByText('Sleep details & schedule')).toBeTruthy();
    expect(screen.getByText('Start sleep')).toBeTruthy();
    expect(screen.getByText('Full rest')).toBeTruthy();
    expect(screen.getByText('Injury rehab')).toBeTruthy();
    expect(screen.getByText('I was unwell')).toBeTruthy();
    expect(screen.getByText('I took a break')).toBeTruthy();
    expect(screen.getByText('I got hurt')).toBeTruthy();
    expect(screen.getByText('Flu')).toBeTruthy();
    expect(screen.getByText('12–18 Sep')).toBeTruthy();
    fireEvent.click(screen.getByText('Sleep details & schedule'));
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'sleep' });
    fireEvent.click(screen.getByText('Injury rehab'));
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'injury' });
    fireEvent.click(screen.getByText('I was unwell'));
    expect(shell.openOverlay).toHaveBeenCalledWith({
      screen: 'health',
      form: { kind: 'new', ctx: 'past', type: 'illness' },
    });
  });

  it('f02: illness since Thu (day 3) and a knee in rehab side by side', () => {
    seed(
      [period({ id: 'ill', mode: 'illness', startDay: D(9, 24), endDay: D(9, 24), open: true })],
      [knee],
    );
    const { shell } = view();
    expect(screen.getByText('Now · Unwell')).toBeTruthy();
    expect(screen.getByText('Since Thu 24 Sep · no end date')).toBeTruthy();
    expect(screen.getByText('Day 3')).toBeTruthy();
    expect(screen.getByText('Streak protected · Program paused')).toBeTruthy();
    expect(screen.getByText('Now · Left knee')).toBeTruthy();
    expect(screen.getByText(/Stage 2 of 4/)).toBeTruthy();
    expect(screen.getByText('Reintroduce')).toBeTruthy();
    // Unwell can't be started twice.
    expect(screen.getByText('Active')).toBeTruthy();
    fireEvent.click(screen.getByText('Rehab plan'));
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'injury', injuryId: 'knee' });
  });

  it('f10: I’m recovered → sheet → Welcome back', () => {
    seed([
      period({ id: 'ill', mode: 'illness', startDay: D(9, 23), endDay: D(9, 23), open: true }),
    ]);
    view();
    fireEvent.click(screen.getByText("I'm recovered"));
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText('Come back from illness?')).toBeTruthy();
    expect(within(sheet).getByText(/Wed 23 – Fri 25 Sep, 3 days/)).toBeTruthy();
    fireEvent.click(within(sheet).getByText("Yes, I'm recovered"));
    const [p] = __getStateForTests().restPeriods;
    expect(p.open).toBe(false);
    expect(p.endDay).toBe(D(9, 25));
    expect(screen.getByText('Welcome back')).toBeTruthy();
    expect(screen.getByText('You were out 3 days')).toBeTruthy();
    expect(screen.getByText('Unwell 23–25 Sep is now in your history.')).toBeTruthy();
  });

  it('f10: Still unwell keeps the illness running', () => {
    seed([
      period({ id: 'ill', mode: 'illness', startDay: D(9, 24), endDay: D(9, 24), open: true }),
    ]);
    view();
    fireEvent.click(screen.getByText("I'm recovered"));
    fireEvent.click(screen.getByText('Still unwell'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(__getStateForTests().restPeriods[0].open).toBe(true);
  });
});

describe('Health forms (mobile)', () => {
  it('f03: schedule full rest with the shared calendar and presets', () => {
    seed([]);
    const { onClose } = view({ form: { kind: 'new', ctx: 'start', type: 'off' } });
    expect(screen.getByRole('heading', { name: 'Full rest' })).toBeTruthy();
    expect(screen.getByText('What it does')).toBeTruthy();
    expect(screen.getByText('Reminders')).toBeTruthy();
    // Starts row → pick Thu 1 Oct, then the 10-days preset.
    fireEvent.click(screen.getByText('Starts'));
    fireEvent.click(screen.getByLabelText('Next month'));
    fireEvent.click(screen.getByLabelText('Thu 1 Oct'));
    fireEvent.click(screen.getByRole('button', { name: '10 days' }));
    expect(
      screen.getByText('10 days, starts in 5 days. Your plan picks up on Sun 11 Oct.'),
    ).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('e.g. Vacation'), {
      target: { value: 'Vacation' },
    });
    fireEvent.click(screen.getByText('Schedule full rest'));
    const [p] = __getStateForTests().restPeriods;
    expect(p).toMatchObject({
      mode: 'off',
      startDay: D(10, 1),
      endDay: D(10, 10),
      name: 'Vacation',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('f04: backfill a past illness over a logged workout — remove the session', () => {
    seed([], [], [workout('w14', 9, 14)]);
    view({ form: { kind: 'new', ctx: 'past', type: 'illness' } });
    expect(screen.getByRole('heading', { name: 'I was unwell' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Sat 12 Sep'));
    fireEvent.click(screen.getByText('Ended'));
    fireEvent.click(screen.getByLabelText('Fri 18 Sep'));
    expect(screen.getByText('Overlap · 1 workout')).toBeTruthy();
    expect(screen.getByText('You trained on Mon 14 Sep')).toBeTruthy();
    expect(screen.getByText('Upper body · 52 min')).toBeTruthy();
    expect(
      screen.getByText('Unwell 12–13 Sep and 15–18 Sep. Your streak stays as it was.'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Mon 14 Sep, workout kept — skipped')).toBeTruthy();
    expect(screen.getByText('7 days, already over. Gold dot = a workout you logged.')).toBeTruthy();
    // Future days can't be picked when logging the past.
    expect((screen.getByLabelText('Sun 27 Sep') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText('Remove the session'));
    fireEvent.click(screen.getByText('Save illness'));
    expect(__getStateForTests().workouts).toHaveLength(0);
    expect(__getStateForTests().restPeriods[0]).toMatchObject({
      mode: 'illness',
      startDay: D(9, 12),
      endDay: D(9, 18),
    });
  });

  it('f04: keep the session (default) — the workout stays logged', () => {
    seed([], [], [workout('w14', 9, 14)]);
    view({ form: { kind: 'new', ctx: 'past', type: 'illness' } });
    fireEvent.click(screen.getByLabelText('Sat 12 Sep'));
    fireEvent.click(screen.getByText('Ended'));
    fireEvent.click(screen.getByLabelText('Fri 18 Sep'));
    fireEvent.click(screen.getByText('Save illness'));
    expect(__getStateForTests().workouts).toHaveLength(1);
    expect(__getStateForTests().restPeriods).toHaveLength(1);
  });

  it('f05: unwell since an earlier day, still ongoing', () => {
    seed([]);
    view({ form: { kind: 'new', ctx: 'start', type: 'illness' } });
    const sw = screen.getByRole('switch') as HTMLInputElement;
    expect(sw.checked).toBe(true);
    expect(screen.getByText('When you tap “I’m recovered”')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Last 3 days' }));
    expect(screen.getByText('Day 3 so far. No missed days — your plan waits.')).toBeTruthy();
    expect(screen.getByLabelText('Sat 26 Sep, today — still ongoing')).toBeTruthy();
    fireEvent.click(screen.getByText('Start from Thu 24 Sep'));
    expect(__getStateForTests().restPeriods[0]).toMatchObject({
      mode: 'illness',
      startDay: D(9, 24),
      open: true,
    });
  });

  it('f06: past injury — still healing continues into the rehab plan', () => {
    seed([]);
    const { shell } = view({ form: { kind: 'new', ctx: 'past', type: 'injury' } });
    expect(screen.getByRole('heading', { name: 'I got hurt' })).toBeTruthy();
    const cont = screen.getByText('Continue to rehab plan').closest('button') as HTMLButtonElement;
    expect(cont.disabled).toBe(true); // no body part yet
    fireEvent.click(screen.getByRole('button', { name: 'Knee' }));
    fireEvent.click(screen.getByLabelText('Sun 20 Sep'));
    expect(screen.getByText(/Left knee since Sun 20 Sep/)).toBeTruthy();
    fireEvent.click(cont);
    expect(shell.replaceOverlay).toHaveBeenCalledWith({
      screen: 'injury',
      prefill: { bodyPart: 'knee', side: 'left', startDay: D(9, 20) },
    });
  });

  it('f06: past injury — healed on a day', () => {
    seed([]);
    view({ form: { kind: 'new', ctx: 'past', type: 'injury' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ankle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Right' }));
    fireEvent.click(screen.getByLabelText('Sun 20 Sep'));
    fireEvent.click(screen.getByText('Healed'));
    const cals = document.querySelectorAll('[role="grid"]');
    fireEvent.click(within(cals[cals.length - 1] as HTMLElement).getByLabelText('Wed 23 Sep'));
    fireEvent.click(screen.getByText('Save injury'));
    const [inj] = __getStateForTests().injuries;
    expect(inj).toMatchObject({ bodyPart: 'ankle', side: 'right', startDay: D(9, 20) });
    expect(inj.healedDay).toBe(D(9, 23));
  });

  it('overlap with another period blocks until merge / replace is picked', () => {
    seed([period({ id: 'vac', startDay: D(9, 1), endDay: D(9, 10), name: 'Vacation' })]);
    view({ form: { kind: 'new', ctx: 'past', type: 'off' } });
    fireEvent.click(screen.getByLabelText('Sat 5 Sep'));
    fireEvent.click(screen.getByText('Ended'));
    fireEvent.click(screen.getByLabelText('Sat 12 Sep'));
    expect(screen.getByText('Overlap · Vacation')).toBeTruthy();
    const save = screen.getByText('Save break').closest('button') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(screen.getByText('Merge into one period'));
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    const list = __getStateForTests().restPeriods;
    expect(list).toHaveLength(1);
    expect([list[0].startDay, list[0].endDay]).toEqual([D(9, 1), D(9, 12)]);
  });

  it('f09: edit a period, then delete it with confirmation', () => {
    seed(
      [period({ id: 'flu', mode: 'illness', startDay: D(9, 12), endDay: D(9, 18), name: 'Flu' })],
      [],
      [workout('w14', 9, 14)],
    );
    view({ form: { kind: 'edit', periodId: 'flu' } });
    expect(screen.getByRole('heading', { name: 'Edit period' })).toBeTruthy();
    expect((screen.getByPlaceholderText('e.g. Flu') as HTMLInputElement).value).toBe('Flu');
    expect(screen.getByText('7 days. Tap a date to open the calendar.')).toBeTruthy();
    expect(screen.getByText(/Mon 14 Sep · Upper body/)).toBeTruthy();
    expect(screen.getByText('Kept')).toBeTruthy();
    fireEvent.click(screen.getByText('Delete period'));
    expect(
      screen.getByText(
        'Delete Flu (12–18 Sep)? Those 7 days go back to normal days. Your streak stays as it is and the 14 Sep workout stays logged.',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByText('Keep it'));
    expect(__getStateForTests().restPeriods).toHaveLength(1);
    fireEvent.click(screen.getByText('Delete period'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(__getStateForTests().restPeriods).toHaveLength(0);
    expect(__getStateForTests().workouts).toHaveLength(1);
  });

  it('f09: save changes to the dates', () => {
    seed([
      period({ id: 'flu', mode: 'illness', startDay: D(9, 12), endDay: D(9, 18), name: 'Flu' }),
    ]);
    view({ form: { kind: 'edit', periodId: 'flu' } });
    fireEvent.click(screen.getByText('Ended'));
    fireEvent.click(screen.getByLabelText('Sat 19 Sep'));
    fireEvent.click(screen.getByText('Save changes'));
    expect(__getStateForTests().restPeriods[0]).toMatchObject({ id: 'flu', endDay: D(9, 19) });
  });
});

describe('Health history (mobile)', () => {
  const history = () => {
    seed(
      [
        period({ id: 'ill', mode: 'illness', startDay: D(9, 24), endDay: D(9, 24), open: true }),
        period({ id: 'flu', mode: 'illness', startDay: D(9, 12), endDay: D(9, 18), name: 'Flu' }),
        period({ id: 'vac', startDay: D(8, 1), endDay: D(8, 10), name: 'Vacation' }),
        period({ id: 'del', mode: 'active', startDay: D(7, 2), endDay: D(7, 4), name: 'Deload' }),
      ],
      [knee],
    );
  };

  it('f07: list with month groups, filters and edit on tap', () => {
    history();
    const { shell } = view({ view: 'history', hist: 'list' });
    expect(screen.getByText('September 2026')).toBeTruthy();
    expect(screen.getByText('August 2026')).toBeTruthy();
    expect(screen.getByText('Unwell · day 3')).toBeTruthy();
    expect(screen.getByText('Rehab · stage 2 of 4')).toBeTruthy();
    expect(screen.getByText('Full rest · 10 days')).toBeTruthy();
    expect(screen.getByText('Active recovery · 3 days')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Injury/ }));
    expect(screen.queryByText('Vacation')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    fireEvent.click(screen.getByText('Flu'));
    expect(shell.openOverlay).toHaveBeenCalledWith({
      screen: 'health',
      view: 'history',
      hist: 'list',
      form: { kind: 'edit', periodId: 'flu' },
    });
    fireEvent.click(screen.getByText('Left knee'));
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'injury', injuryId: 'knee' });
  });

  it('f07: swipe-left Delete asks first', () => {
    history();
    view({ view: 'history', hist: 'list' });
    fireEvent.click(screen.getByLabelText('Delete Vacation'));
    expect(screen.getByText(/Those 10 days go back to normal days/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(__getStateForTests().restPeriods.find((p) => p.id === 'vac')).toBeUndefined();
  });

  it('f08: the timeline is view-only with Now, lanes and free gaps', () => {
    history();
    view({ view: 'history', hist: 'timeline' });
    expect(screen.getByText('Nothing planned')).toBeTruthy();
    expect(screen.getByText('2 active')).toBeTruthy();
    expect(screen.getByText('Day 3 · no end date')).toBeTruthy();
    expect(screen.getByText('Rehab · Reintroduce')).toBeTruthy();
    expect(screen.getByText('Free day')).toBeTruthy();
    expect(screen.getByText('11 Aug – 11 Sep · free')).toBeTruthy();
    expect(screen.getByText('Not on the timeline')).toBeTruthy();
    // View-only: no edit affordances on timeline rows.
    expect(screen.queryByText('Log the past')).toBeNull();
    expect(document.querySelectorAll('.uitl button')).toHaveLength(0);
  });
});

describe('Health (web)', () => {
  beforeEach(() => setDesktop(true));

  it('w01: lists left, history timeline right', () => {
    seed([
      period({ id: 'flu', mode: 'illness', startDay: D(9, 12), endDay: D(9, 18), name: 'Flu' }),
    ]);
    view();
    expect(screen.getByText('Today · Sat 26 Sep')).toBeTruthy();
    expect(document.querySelector('.hl-cols')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'History' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Timeline' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(document.querySelector('.uitl')).toBeTruthy();
  });

  it('w02: a form opens in the right panel with two months', () => {
    seed([]);
    view({ form: { kind: 'new', ctx: 'past', type: 'illness' } });
    const panel = screen.getByRole('dialog');
    expect(within(panel).getByText('Log an illness that already happened')).toBeTruthy();
    expect(panel.querySelectorAll('[role="grid"]')).toHaveLength(2);
    expect(document.querySelector('[aria-current="true"]')).toBeTruthy();
  });

  it('w03: history list left, edit panel right', () => {
    seed([
      period({ id: 'flu', mode: 'illness', startDay: D(9, 12), endDay: D(9, 18), name: 'Flu' }),
    ]);
    view({ view: 'history', hist: 'list', form: { kind: 'edit', periodId: 'flu' } });
    const panel = screen.getByRole('dialog');
    expect(within(panel).getByText('Edit period')).toBeTruthy();
    expect(within(panel).getByText('Flu · Unwell · 12–18 Sep')).toBeTruthy();
    expect(document.querySelector('[aria-current="true"]')?.textContent).toContain('Flu');
  });
});

describe('Health: planning ahead', () => {
  it('schedules a full rest for next week → Coming up, Later, editable', () => {
    seed([]);
    view({ form: { kind: 'new', ctx: 'start', type: 'off' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Vacation'), {
      target: { value: 'Vacation' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(
      screen.getByText('7 days, starts in 2 days. Your plan picks up on Mon 5 Oct.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByText('Schedule full rest'));
    const [p] = __getStateForTests().restPeriods;
    expect(p).toMatchObject({ mode: 'off', startDay: D(9, 28), endDay: D(10, 4) });
    cleanup();

    view();
    expect(screen.getByText('Coming up')).toBeTruthy();
    expect(screen.getByText('In 2 days')).toBeTruthy();
    expect(screen.queryByText('All clear')).toBeNull();
    cleanup();

    view({ view: 'history', hist: 'timeline' });
    expect(screen.queryByText('Nothing planned')).toBeNull();
    expect(screen.getByText('Vacation')).toBeTruthy();
    cleanup();

    // Editable before it starts: move the end to Fri 2 Oct.
    view({ form: { kind: 'edit', periodId: p.id } });
    fireEvent.click(screen.getByText('Ends'));
    fireEvent.click(screen.getByLabelText('Fri 2 Oct'));
    fireEvent.click(screen.getByText('Save changes'));
    expect(__getStateForTests().restPeriods[0].endDay).toBe(D(10, 2));
  });

  it('schedules active recovery for the next 7 days in its own teal tone', () => {
    seed([]);
    view({ form: { kind: 'new', ctx: 'start', type: 'active' } });
    expect(document.querySelector('.uitile.uit--active')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next 7 days' }));
    const primary = screen.getByText('Schedule active recovery');
    expect(primary.className).toContain('p-act');
    fireEvent.click(primary);
    expect(__getStateForTests().restPeriods[0]).toMatchObject({
      mode: 'active',
      startDay: D(9, 27),
      endDay: D(10, 3),
    });
    cleanup();
    view({ view: 'history', hist: 'list' });
    expect(document.querySelector('.uitile.uit--active')).toBeTruthy();
    expect(document.querySelector('.uitile.uit--rest')).toBeNull();
  });

  it('a scheduled period becomes active on its start day', () => {
    seed([period({ id: 'vac', startDay: D(9, 28), endDay: D(10, 4), name: 'Vacation' })]);
    view();
    expect(screen.getByText('Coming up')).toBeTruthy();
    expect(screen.queryByText('Now · Full rest')).toBeNull();
    cleanup();
    vi.setSystemTime(new Date(2026, 8, 28, 9, 0).getTime());
    view();
    expect(screen.getByText('Now · Full rest')).toBeTruthy();
    expect(screen.getByText('Day 1/7')).toBeTruthy();
    expect(screen.queryByText('Coming up')).toBeNull();
  });

  it('illness cannot be planned ahead (and says why)', () => {
    seed([]);
    view({ form: { kind: 'new', ctx: 'start', type: 'illness' } });
    expect((screen.getByLabelText('Sun 27 Sep') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Illness can’t be planned ahead/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Next week' })).toBeNull();
  });
});
