import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { HealthView, type HealthViewProps } from './HealthView';
import { __getStateForTests, __replaceStateForTests } from '../store';
import { ymdToDay } from '../health';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import type { ChronicCondition, Injury, RestPeriod, SleepNight } from '../types';
import { fmtDay, typeName } from './health/parts';
import { freezeClock, makeShell, NOW, PRISTINE, setDesktop } from './__fixtures__/viewKit';

// Saturday 26 Sep 2026, noon
const D = (m: number, d: number) => ymdToDay(2026, m - 1, d);
const TODAY = D(9, 26);
const period = (over: Partial<RestPeriod>): RestPeriod => ({
  id: over.id ?? 'p',
  startDay: D(9, 1),
  endDay: D(9, 1),
  mode: 'off',
  createdAt: 1,
  ...over,
});
const knee = (over: Partial<Injury> = {}): Injury => ({
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
  ...over,
});
const night = (over: Partial<SleepNight> = {}): SleepNight => ({
  id: 'n1',
  date: '2026-09-26',
  bedtime: new Date(2026, 8, 25, 23, 0).getTime(),
  wake: new Date(2026, 8, 26, 7, 0).getTime(),
  source: 'backfill',
  ...over,
});
const base = () => ({
  ...structuredClone(PRISTINE),
  restPeriods: [] as RestPeriod[],
  injuries: [] as Injury[],
  workouts: [],
  sleeps: [] as SleepNight[],
  activities: [],
});
const seed = (over: Record<string, unknown> = {}) =>
  __replaceStateForTests({ ...base(), ...over } as never);
const view = (p: Partial<HealthViewProps> = {}) => {
  const shell = makeShell();
  const onClose = vi.fn();
  const out = render(<HealthView shell={shell} onClose={onClose} {...p} />);
  return { ...out, shell, onClose };
};
const back = () => fireEvent.click(screen.getAllByRole('button', { name: en.backAction })[0]);

beforeEach(() => {
  freezeClock(NOW);
  localStorage.clear();
  setLocale('en');
  setDesktop(false);
  seed();
});
afterEach(() => cleanup());

describe('Health home: sleep group', () => {
  it('shows last night and opens its details', () => {
    seed({ sleeps: [night()] });
    const { shell } = view();
    expect(screen.getByText('23:00–07:00')).toBeTruthy();
    expect(screen.getByText('8h 0m')).toBeTruthy();
    fireEvent.click(screen.getByText(en.hlLastNight));
    expect(shell.openOverlay).toHaveBeenCalledWith({
      screen: 'sleep',
      mode: 'edit',
      nightId: 'n1',
    });
  });

  it('with no night logged it says so and opens the sleep page', () => {
    const { shell } = view();
    expect(screen.getByText(en.sleepNoLastNight)).toBeTruthy();
    fireEvent.click(screen.getByText(en.hlLastNight));
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'sleep' });
  });

  it('Start sleep begins a live night and opens the sleep overlay', () => {
    const { shell } = view();
    fireEvent.click(screen.getByText(en.sleepStart));
    expect(__getStateForTests().sleeps.some((s) => s.wake === null)).toBe(true);
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'sleep' });
  });

  it('while asleep the row says since when and just opens the overlay', () => {
    seed({
      sleeps: [night({ id: 'live', wake: null, bedtime: new Date(2026, 8, 26, 2, 30).getTime() })],
    });
    const { shell } = view();
    fireEvent.click(screen.getByText(en.sleepAsleepSince('02:30')));
    expect(__getStateForTests().sleeps).toHaveLength(1);
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'sleep' });
  });

  it('"Sleep details" opens the sleep page', () => {
    const { shell } = view();
    fireEvent.click(screen.getByText(en.hlSleepDetails));
    expect(shell.openOverlay).toHaveBeenLastCalledWith({ screen: 'sleep' });
  });

  it.each([
    [
      'workout',
      { workouts: [{ id: 'w', startedAt: NOW - 3600_000, finishedAt: null, exercises: [] }] },
      en.slpBlockWorkout,
    ],
    [
      'live activity',
      {
        activities: [
          {
            id: 'a',
            type: 'run',
            category: 'conditioning',
            startedAt: NOW - 3600_000,
            finishedAt: null,
          },
        ],
      },
      en.slpBlockActivity,
    ],
    [
      'home set',
      {
        workouts: [
          { id: 'h', kind: 'home', startedAt: NOW - 3600_000, finishedAt: null, exercises: [] },
        ],
      },
      en.slpBlockHomeSet,
    ],
  ])('sleep cannot be started during a live %s, and says why', (_n, over, hint) => {
    seed(over);
    const { shell } = view();
    expect(screen.getByText(hint)).toBeTruthy();
    expect((screen.getByText(en.sleepStart).closest('button') as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.click(screen.getByText(en.sleepStart));
    expect(__getStateForTests().sleeps).toHaveLength(0);
    expect(shell.openOverlay).not.toHaveBeenCalledWith({ screen: 'sleep' });
  });
});

describe('Health home: now group', () => {
  it('a running full rest shows its range, day count and ends after confirmation', () => {
    seed({ restPeriods: [period({ id: 'r', mode: 'off', startDay: D(9, 24), endDay: D(9, 28) })] });
    const { shell } = view();
    expect(screen.getByText(en.hlNowWhat(typeName('off', en)))).toBeTruthy();
    expect(screen.getByText(en.restDayOf(3, 5))).toBeTruthy();
    expect(screen.getByText(en.restCardOffNote)).toBeTruthy();
    fireEvent.click(screen.getByText(en.restDayOf(3, 5)));
    expect(shell.openOverlay).toHaveBeenCalledWith({
      screen: 'health',
      form: { kind: 'edit', periodId: 'r' },
    });
    fireEvent.click(screen.getByText(en.restEndNow));
    const d = document.querySelector('[role="alertdialog"], [role="dialog"]') as HTMLElement;
    expect(within(d).getByText(en.restEndBody)).toBeTruthy();
    fireEvent.click(within(d).getByText(en.cancel));
    expect(__getStateForTests().restPeriods[0].endDay).toBe(D(9, 28));
    fireEvent.click(screen.getByText(en.restEndNow));
    fireEvent.click(
      within(
        document.querySelector('[role="alertdialog"], [role="dialog"]') as HTMLElement,
      ).getByRole('button', { name: en.restEndNow }),
    );
    expect(__getStateForTests().restPeriods[0].endDay).toBe(TODAY - 1);
  });

  it('an open active-recovery period shows the open-ended line and the active note', () => {
    seed({
      restPeriods: [
        period({ id: 'a', mode: 'active', startDay: D(9, 25), endDay: D(9, 25), open: true }),
      ],
    });
    view();
    expect(screen.getByText(en.hlSinceNoEnd(fmtDay(D(9, 25), 'en', TODAY)))).toBeTruthy();
    expect(screen.getByText(en.hlDayN(2))).toBeTruthy();
    expect(screen.getByText(en.restCardActiveNote)).toBeTruthy();
  });

  it('an injury in a clinician no-load window shows Stage 0 with days left; otherwise the next check-in hint', () => {
    seed({ injuries: [knee({ stage: 'protect', fullRestUntil: TODAY + 5 })] });
    const { unmount } = view();
    expect(
      document.querySelector('.uirow-s, .uirow-sub')?.textContent ?? document.body.textContent,
    ).toContain(en.injStage0);
    expect(screen.getByText(en.injStage0Left(5))).toBeTruthy();
    unmount();
    seed({ injuries: [knee()] });
    view();
    expect(screen.getByText(en.hlAfterNextSession)).toBeTruthy();
    expect(screen.getByText(en.hlHowFelt)).toBeTruthy();
  });

  it('a recently ended illness shows the welcome-back card with the easing-back steps', () => {
    seed({
      restPeriods: [
        period({ id: 'f', mode: 'illness', startDay: D(9, 20), endDay: D(9, 24), name: 'Flu' }),
      ],
    });
    view();
    expect(screen.getByText(en.hlWelcomeBack)).toBeTruthy();
    expect(screen.getByText(en.hlStreakKept)).toBeTruthy();
    expect(screen.getByText(en.hlResumed)).toBeTruthy();
    expect(screen.queryByText(en.hlAllClear)).toBeNull();
  });

  it('upcoming periods are listed with a countdown and open their edit form', () => {
    seed({
      restPeriods: [period({ id: 'u', mode: 'off', startDay: TODAY + 4, endDay: TODAY + 6 })],
    });
    const { shell } = view();
    expect(screen.getByText(en.hlComingUp)).toBeTruthy();
    expect(screen.getByText(en.hlStartsIn(4))).toBeTruthy();
    fireEvent.click(screen.getByText(en.hlStartsIn(4)));
    expect(shell.openOverlay).toHaveBeenCalledWith({
      screen: 'health',
      form: { kind: 'edit', periodId: 'u' },
    });
  });

  it('the illness row opens its edit form', () => {
    seed({
      restPeriods: [
        period({ id: 'ill', mode: 'illness', startDay: D(9, 24), endDay: D(9, 24), open: true }),
      ],
    });
    const { shell } = view();
    fireEvent.click(screen.getByText(en.hlDayN(3)));
    expect(shell.openOverlay).toHaveBeenCalledWith({
      screen: 'health',
      form: { kind: 'edit', periodId: 'ill' },
    });
  });
});

describe('Health home: start, lifestyle, privacy and history rows', () => {
  it('the start rows open new forms; Unwell is disabled while ill', () => {
    const { shell } = view();
    fireEvent.click(screen.getByText(en.hlFullRest));
    expect(shell.openOverlay).toHaveBeenLastCalledWith({
      screen: 'health',
      form: { kind: 'new', ctx: 'start', type: 'off' },
    });
    fireEvent.click(screen.getByText(en.restModeActive));
    expect(shell.openOverlay).toHaveBeenLastCalledWith({
      screen: 'health',
      form: { kind: 'new', ctx: 'start', type: 'active' },
    });
    fireEvent.click(screen.getByText(en.hlTookBreak));
    expect(shell.openOverlay).toHaveBeenLastCalledWith({
      screen: 'health',
      form: { kind: 'new', ctx: 'past', type: 'off' },
    });
    fireEvent.click(screen.getByText(en.hlGotHurt));
    expect(shell.openOverlay).toHaveBeenLastCalledWith({
      screen: 'health',
      form: { kind: 'new', ctx: 'past', type: 'injury' },
    });
  });

  it('the conditions group opens a new condition or an existing one', () => {
    const c: ChronicCondition = {
      id: 'c1',
      key: 'back_lumbar_disc',
      severity: 2,
      share: 'off',
      createdAt: 1,
    };
    seed({ conditions: [c] });
    const { shell } = view();
    fireEvent.click(screen.getByText(en.cndAdd));
    expect(shell.openOverlay).toHaveBeenLastCalledWith({ screen: 'health', cond: 'new' });
    fireEvent.click(screen.getByText(en.cndShareOff));
    expect(shell.openOverlay).toHaveBeenLastCalledWith({ screen: 'health', cond: 'c1' });
  });

  it('nicotine, alcohol, cycle open their hubs; supplements open the quick start when empty', () => {
    const { shell } = view();
    fireEvent.click(screen.getByText(en.nicTitle));
    expect(shell.openOverlay).toHaveBeenLastCalledWith({ screen: 'health', nic: 'hub' });
    fireEvent.click(screen.getByText(en.alcTitle));
    expect(shell.openOverlay).toHaveBeenLastCalledWith({ screen: 'health', alc: 'hub' });
    fireEvent.click(screen.getByText(en.cycTitle));
    expect(shell.openOverlay).toHaveBeenLastCalledWith({ screen: 'health', cyc: 'hub' });
    fireEvent.click(screen.getByText(en.supTitle));
    expect(document.querySelector('[role="dialog"], [role="alertdialog"]')).toBeTruthy();
  });

  it('the supplement quick start can go to the full list', () => {
    const { shell } = view();
    fireEvent.click(screen.getByText(en.supTitle));
    const dlg = document.querySelector('[role="dialog"], [role="alertdialog"]') as HTMLElement;
    const more = [...dlg.querySelectorAll('button')].find((b) =>
      /more|all|list/i.test(b.textContent ?? ''),
    );
    expect(more).toBeTruthy();
    fireEvent.click(more!);
    expect(shell.openOverlay).toHaveBeenLastCalledWith({ screen: 'health', sup: 'products' });
  });

  it('the privacy row summarises the sharing level or says mixed, and opens the privacy page', () => {
    const a = base();
    const allOff = {
      conditionsShare: 'off',
      nicotine: { ...a.nicotine, settings: { ...a.nicotine.settings, sharing: 'off' } },
      alcohol: { ...a.alcohol, settings: { ...a.alcohol.settings, sharing: 'off' } },
      supplements: { ...a.supplements, settings: { ...a.supplements.settings, sharing: 'off' } },
    };
    seed(allOff);
    const { shell, unmount } = view();
    expect(screen.getByText(en.hlPrivCoach(en.nicPrivOff))).toBeTruthy();
    fireEvent.click(screen.getByText(en.hlPrivRow));
    expect(shell.openOverlay).toHaveBeenLastCalledWith({ screen: 'health', priv: true });
    unmount();
    seed({ ...allOff, conditionsShare: 'full' });
    view();
    expect(screen.getByText(en.hlPrivMixed)).toBeTruthy();
  });

  it('"see all" opens the history list; recent items open their editor or the injury plan', () => {
    seed({
      restPeriods: [period({ id: 'old', mode: 'off', startDay: D(8, 1), endDay: D(8, 3) })],
      injuries: [knee({ id: 'old-inj', healedDay: D(9, 10), startDay: D(9, 1) })],
    });
    const { shell } = view();
    fireEvent.click(screen.getByText(en.hlSeeAll));
    expect(shell.openOverlay).toHaveBeenLastCalledWith({
      screen: 'health',
      view: 'history',
      hist: 'list',
    });
    const group = screen
      .getByText(en.hlHistory, { selector: '.uigl-h' })
      .closest('section') as HTMLElement;
    const rows = [...group.querySelectorAll('button.uirow')];
    expect(rows).toHaveLength(3);
    fireEvent.click(rows[0]);
    expect(shell.openOverlay).toHaveBeenLastCalledWith({
      screen: 'health',
      form: { kind: 'edit-injury', injuryId: 'old-inj' },
    });
  });

  it('closing and the back arrow', () => {
    const { onClose } = view();
    back();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('the clock re-renders each minute (the covering period changes at midnight)', () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 26, 23, 59, 30));
    seed({
      restPeriods: [period({ id: 'r', mode: 'off', startDay: TODAY + 1, endDay: TODAY + 2 })],
    });
    view();
    expect(screen.getByText(en.hlComingUp)).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    // now it is the 27th: the period covers today
    expect(screen.queryByText(en.hlComingUp)).toBeNull();
  });
});

describe('Health sub-screens by props', () => {
  it.each([
    ['nic', { nic: 'hub' as const }],
    ['alc', { alc: 'hub' as const }],
    ['sup', { sup: 'hub' as const }],
    ['cyc', { cyc: 'hub' as const }],
    ['priv', { priv: true }],
  ])('%s replaces the whole overview and its back closes', (_n, props) => {
    const { onClose } = view(props);
    expect(screen.queryByText(en.startHealthTitle)).toBeNull();
    back();
    expect(onClose).toHaveBeenCalled();
  });

  it('a condition page opens in place of the overview on a phone', () => {
    view({ cond: 'new' });
    expect(screen.queryByText(en.hlNow)).toBeNull();
    expect(screen.getByText(en.cndAdd, { exact: false })).toBeTruthy();
  });

  it('a form for a period that no longer exists falls back to the overview', () => {
    view({ form: { kind: 'edit', periodId: 'gone' } });
    expect(screen.getByText(en.startHealthTitle)).toBeTruthy();
  });

  it('a form for an injury that no longer exists falls back as well', () => {
    view({ form: { kind: 'edit-injury', injuryId: 'gone' } });
    expect(screen.getByText(en.startHealthTitle)).toBeTruthy();
  });

  it('history on a phone: list mode has the log-past action; timeline links to the sleep history', () => {
    const { shell, unmount } = view({ view: 'history', hist: 'list' });
    expect(screen.getByText(en.hlHistoryTitle)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.hlLogPast }));
    expect(shell.openOverlay).toHaveBeenLastCalledWith({
      screen: 'health',
      view: 'history',
      hist: 'list',
      form: { kind: 'new', ctx: 'past', type: 'illness' },
    });
    unmount();
    const t = view({ view: 'history', hist: 'timeline' });
    expect(screen.getByText(en.hlNotOnTimeline)).toBeTruthy();
    fireEvent.click(screen.getByText(en.hlSleepOwnHistory));
    expect(t.shell.openOverlay).toHaveBeenLastCalledWith({ screen: 'sleep' });
    expect(screen.queryByRole('button', { name: en.hlLogPast })).toBeNull();
  });

  it('switching the history mode replaces the current overlay', () => {
    const { shell } = view({ view: 'history', hist: 'list' });
    fireEvent.click(screen.getByRole('button', { name: 'Timeline' }));
    expect(shell.replaceOverlay).toHaveBeenCalledWith({
      screen: 'health',
      view: 'history',
      hist: 'timeline',
    });
  });
});

describe('Health on the web', () => {
  beforeEach(() => setDesktop(true));

  it('two columns on the left, the history on the right; list/timeline switch', () => {
    view();
    expect(document.querySelectorAll('.hl-col')).toHaveLength(2);
    expect(screen.getByText(en.hlTodayIs(fmtDay(TODAY, 'en', TODAY)))).toBeTruthy();
    expect(document.querySelector('.hl-hist')).toBeTruthy();
  });

  it('opening a form replaces the previous form in the right panel instead of stacking', () => {
    const { shell } = view({ form: { kind: 'new', ctx: 'start', type: 'off' } });
    fireEvent.click(screen.getByText(en.restModeActive));
    expect(shell.replaceOverlay).toHaveBeenCalledWith({
      screen: 'health',
      form: { kind: 'new', ctx: 'start', type: 'active' },
    });
    expect(shell.openOverlay).not.toHaveBeenCalled();
  });

  it('the row of the open form is marked current', () => {
    view({ form: { kind: 'new', ctx: 'start', type: 'off' } });
    const cur = document.querySelector('[aria-current="true"]') as HTMLElement;
    expect(cur.textContent).toContain(en.hlFullRest);
  });

  it('a condition page shows in the right panel with the overview staying left', () => {
    view({ cond: 'new' });
    expect(document.querySelector('.hl-hist')).toBeNull();
    expect(screen.getByText(en.hlStart)).toBeTruthy();
  });

  it('picking a condition type replaces the overlay with the chosen key', () => {
    const { shell } = view({ cond: 'new' });
    const pane = document.querySelectorAll('.hl-wbody > *')[1] as HTMLElement;
    fireEvent.click(pane.querySelector('button.uirow') as HTMLElement); // a body area
    fireEvent.click(pane.querySelector('button.uirow') as HTMLElement); // first condition in it
    expect(shell.replaceOverlay).toHaveBeenCalledWith({
      screen: 'health',
      cond: 'new',
      condKey: expect.any(String),
    });
  });

  it('back closes', () => {
    const { onClose } = view();
    back();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
