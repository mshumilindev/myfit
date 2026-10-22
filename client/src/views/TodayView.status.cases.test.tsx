import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { __getStateForTests, dayKey } from '../store';
import { REHAB_STAGES } from '../injury';
import { DOCTOR_HINT_DAYS } from '../illness';
import type { StoreState } from '../store';
import type { Injury, RestPeriod } from '../types';
import { openToday, resetTodayMocks } from './__fixtures__/todayMocks';
import {
  DAY,
  freezeClock,
  installIntersectionObserver,
  NOW,
  richState,
} from './__fixtures__/viewKit';

const dk = dayKey(NOW);
const rest = (over: Partial<RestPeriod>): RestPeriod =>
  ({
    id: 'r1',
    startDay: dk - 1,
    endDay: dk + 2,
    mode: 'active',
    createdAt: NOW - DAY,
    name: null,
    ...over,
  }) as RestPeriod;
const injury = (over: Partial<Injury>): Injury =>
  ({
    id: 'inj',
    reason: 'injury',
    bodyPart: 'knee',
    muscles: ['quads', 'glutes'],
    stage: 'reintroduce',
    startDay: dk - 3,
    createdAt: NOW - 3 * DAY,
    checkins: [],
    healedDay: null,
    ...over,
  }) as Injury;
const withRest = (r: RestPeriod): StoreState => ({
  ...richState(),
  injuries: [],
  restPeriods: [r],
});
const withInjury = (i: Injury): StoreState => ({ ...richState(), injuries: [i], restPeriods: [] });
const banner = () => document.querySelector('.tr-banner') as HTMLElement;
const btn = (root: ParentNode, name: string | RegExp) =>
  within(root as HTMLElement).getByRole('button', { name });

beforeEach(() => {
  freezeClock(NOW);
  setLocale('en');
  resetTodayMocks();
  installIntersectionObserver();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('TodayView status: injury banners', () => {
  it('full rest: counts the days left, pauses the program and opens the plan', async () => {
    const { shell } = await openToday(
      withInjury(injury({ stage: 'protect', fullRestUntil: dk + 4 })),
    );
    expect(banner().classList.contains('tr-banner--rest')).toBe(true);
    expect(banner().querySelector('.prog-banner-kicker')?.textContent).toBe(en.injStage0);
    expect(banner().querySelector('.prog-banner-title')?.textContent).toBe(en.injStage0Left(4));
    expect(banner().textContent).toContain(en.illnessProgramPill);
    fireEvent.click(btn(banner(), new RegExp(en.injViewPlan)));
    expect(shell.calls.openOverlay).toHaveBeenCalledWith({ screen: 'injury', injuryId: 'inj' });
  });

  it('rehab stage: shows the stage counter, the protected muscles and a check-in shortcut', async () => {
    const { shell } = await openToday(withInjury(injury({})));
    const b = banner();
    expect(b.classList.contains('rehab')).toBe(true);
    expect(b.querySelector('.prog-banner-title')?.textContent).toBe(
      en.injBannerTitle(en.injBodyParts.knee),
    );
    expect(b.querySelector('.prog-banner-kicker')?.textContent).toBe(
      en.injBannerStage(2, REHAB_STAGES.length, en.injStage.reintroduce),
    );
    expect([...b.querySelectorAll('.tr-pills .uitag')].map((t) => t.textContent)).toEqual([
      en.muscleGroups.quads,
      en.muscleGroups.glutes,
    ]);
    fireEvent.click(btn(b, new RegExp(en.injBannerCheckin)));
    expect(shell.calls.openOverlay).toHaveBeenCalledWith({
      screen: 'injury',
      injuryId: 'inj',
      checkin: true,
    });
  });

  it('the first (protect) stage has no check-in shortcut', async () => {
    await openToday(withInjury(injury({ stage: 'protect' })));
    expect(
      within(banner()).queryByRole('button', { name: new RegExp(en.injBannerCheckin) }),
    ).toBeNull();
  });

  it('a general reason is named by the reason, not a body part', async () => {
    await openToday(withInjury(injury({ reason: 'surgery' as never, bodyPart: '' })));
    expect(banner().querySelector('.prog-banner-title')?.textContent).toBe(
      en.injBannerTitle(en.injReason.surgery),
    );
  });

  it('ready to advance: Move up advances the stage, Stay longer dismisses the offer', async () => {
    await openToday(withInjury(injury({ pendingAdvance: true })));
    expect(banner().querySelector('.prog-banner-kicker')?.textContent).toBe(en.injReadyKicker);
    expect(banner().querySelector('.prog-banner-title')?.textContent).toBe(
      en.injReadyTitle(en.injStage.rebuild),
    );
    fireEvent.click(btn(banner(), new RegExp(en.injMoveUpShort)));
    expect(__getStateForTests().injuries[0].stage).toBe('rebuild');
    cleanup();
    await openToday(withInjury(injury({ pendingAdvance: true })));
    fireEvent.click(btn(banner(), en.injStayLonger));
    expect(__getStateForTests().injuries[0].pendingAdvance).toBeFalsy();
    expect(__getStateForTests().injuries[0].stage).toBe('reintroduce');
  });

  it('back-to-program stage: celebrates and heals the injury on tap', async () => {
    await openToday(withInjury(injury({ stage: 'return' })));
    expect(banner().querySelector('.tr-done-title')?.textContent).toBe(en.injDoneTitle);
    expect(banner().querySelectorAll('.tr-done-dot')).toHaveLength(REHAB_STAGES.length);
    fireEvent.click(btn(banner(), new RegExp(en.injBackToProgram)));
    expect(__getStateForTests().injuries[0].healedDay).not.toBeNull();
  });
});

describe('TodayView status: rest periods', () => {
  it('a deload ("active") period shows the day count, progress and a light-session start', async () => {
    const { shell } = await openToday(withRest(rest({})));
    const b = banner();
    expect(b.querySelector('.prog-banner-kicker')?.textContent).toBe(en.restModeActive);
    expect(b.querySelector('.tr-day')?.textContent).toBe(en.restDayOf(2, 4));
    expect(b.querySelector('.prog-banner-title')?.textContent).toBe(en.restCardActiveTitle);
    expect((b.querySelector('.tr-fill') as HTMLElement).style.width).toBe('50%');
    fireEvent.click(btn(b, new RegExp(en.restStartLight)));
    expect(shell.calls.openStart).toHaveBeenCalledTimes(1);
  });

  it('a vacation ("off") period only offers to end it', async () => {
    await openToday(withRest(rest({ mode: 'off' })));
    const b = banner();
    expect(b.querySelector('.prog-banner-kicker')?.textContent).toBe(en.restModeOff);
    expect(b.querySelector('.prog-banner-title')?.textContent).toBe(en.restCardOffTitle);
    expect(within(b).queryByRole('button', { name: new RegExp(en.restStartLight) })).toBeNull();
  });

  it('ending a period asks first; confirming ends it, Cancel keeps it', async () => {
    await openToday(withRest(rest({ mode: 'off' })));
    fireEvent.click(btn(banner(), en.restEndNow));
    const dlg = () =>
      document.querySelector('[role="alertdialog"], [role="dialog"]') as HTMLElement;
    expect(dlg().textContent).toContain(en.restEndBody);
    fireEvent.click(btn(dlg(), en.cancel));
    expect(__getStateForTests().restPeriods[0].endDay).toBe(dk + 2);
    fireEvent.click(btn(banner(), en.restEndNow));
    fireEvent.click(btn(dlg(), en.restEndNow));
    expect(__getStateForTests().restPeriods[0].endDay).toBeLessThan(dk + 2);
    expect(banner()).toBeNull();
  });

  it('an open illness shows its kind, the streak promise, the program pause and a Recovered flow', async () => {
    await openToday(
      withRest(rest({ mode: 'illness', open: true, startDay: dk - 2, illnessKind: 'virus' })),
    );
    const b = banner();
    expect(b.querySelector('.prog-banner-title')?.textContent).toBe(en.restCardIllnessTitle(3));
    expect(b.querySelector('.prog-banner-kicker')?.textContent).toContain(en.restCardIllnessKicker);
    expect(b.textContent).toContain(en.illnessStreakPill);
    expect(b.textContent).toContain(en.illnessProgramPill);
    expect(b.textContent).toContain(en.restCardIllnessNote);
    fireEvent.click(btn(b, new RegExp(en.illnessRecovered)));
    const dlg = document.querySelector('[role="alertdialog"], [role="dialog"]') as HTMLElement;
    expect(dlg.textContent).toContain(en.illnessRecoveredBody);
    fireEvent.click(btn(dlg, en.illnessRecoveredConfirm));
    expect(__getStateForTests().restPeriods[0].open).toBeFalsy();
  });

  it('a long illness adds the doctor hint after four weeks; an unspecified kind has no kind suffix', async () => {
    await openToday(
      withRest(
        rest({
          mode: 'illness',
          open: true,
          startDay: dk - DOCTOR_HINT_DAYS,
          illnessKind: undefined,
        }),
      ),
    );
    expect(banner().querySelector('.prog-banner-kicker')?.textContent).toBe(
      en.restCardIllnessKicker,
    );
    expect(banner().querySelector('.prog-banner-body')?.textContent).toContain(en.illDoctor);
  });

  it('a mental-health period keeps the pause pill off and shows the gentler note', async () => {
    await openToday(
      withRest(rest({ mode: 'illness', open: true, startDay: dk, illnessKind: 'mental' })),
    );
    expect(banner().textContent).toContain(en.illMentalNote);
    expect(banner().textContent).not.toContain(en.illnessProgramPill);
  });

  it('coming back from an illness shows the easing-in plan, Start light and Dismiss', async () => {
    const { shell } = await openToday(
      withRest(rest({ mode: 'illness', startDay: dk - 6, endDay: dk - 1, illnessKind: 'virus' })),
    );
    const b = banner();
    expect(b.querySelector('.prog-banner-kicker')?.textContent).toContain(en.illnessReturnKicker);
    expect(b.querySelector('.prog-banner-title')?.textContent).toMatch(/\d/);
    fireEvent.click(btn(b, new RegExp(en.restStartLight)));
    expect(shell.calls.openStart).toHaveBeenCalledTimes(1);
    fireEvent.click(btn(b, en.illnessReturnDismiss));
    expect(banner()).toBeNull();
  });

  it('a running session turns "start light" into resuming it', async () => {
    const r = richState();
    const live = { ...r.workouts[0], id: 'live', finishedAt: null };
    const { shell } = await openToday({
      ...r,
      workouts: [...r.workouts, live],
      injuries: [],
      restPeriods: [rest({})],
    });
    expect((btn(banner(), new RegExp(en.restStartLight)) as HTMLButtonElement).disabled).toBe(true);
    void shell;
  });
});

describe('TodayView status: nothing to report', () => {
  it('shows no banner for a healthy account', async () => {
    await openToday({ ...richState(), injuries: [], restPeriods: [] });
    expect(document.querySelector('.tr-banner')).toBeNull();
    expect(screen.queryByText(en.servedFromCache)).toBeNull();
  });
});
