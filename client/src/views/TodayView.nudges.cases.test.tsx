import { currentHash } from '../route';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { setRole } from '../api';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import type { StoreState } from '../store';
import type { Workout } from '../types';
import { assignment, m, openToday, resetTodayMocks } from './__fixtures__/todayMocks';
import {
  DAY,
  freezeClock,
  history,
  installIntersectionObserver,
  NOW,
  richState,
} from './__fixtures__/viewKit';

const SUGGEST_KEY = 'spotter.progSuggest.dismissedAt';

/** Weigh-ins on Saturdays at noon, none today -> the reminder is due (it is Saturday 12:00). */
const weighDue = (): StoreState => {
  const r = richState();
  return { ...r, bodyMetrics: { ...r.bodyMetrics, weights: r.bodyMetrics.weights.slice(0, 11) } };
};
const saturday = (): Workout => {
  const base = history(1)[0];
  const at = new Date(NOW - 7 * DAY);
  at.setHours(18, 0, 0, 0);
  return {
    ...base,
    id: 'sat',
    dayName: 'Pull day',
    startedAt: at.getTime(),
    finishedAt: at.getTime() + 3600_000,
  };
};
const withSaturday = (): StoreState => {
  const r = richState();
  return { ...r, workouts: [...r.workouts, saturday()] };
};
const deck = () => {
  fireEvent.click(document.querySelector('.nudge-deck') as HTMLElement);
  return [...document.querySelectorAll('.nudge-full')] as HTMLElement[];
};
const card = (kicker: string) =>
  deck().find((c) => c.querySelector('.nudge-kicker')?.textContent === kicker) as HTMLElement;
const kickers = () => deck().map((c) => c.querySelector('.nudge-kicker')?.textContent);

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

describe('TodayView nudges: the deck', () => {
  it('collects the advisory cards, most urgent first', async () => {
    await openToday();
    const k = kickers();
    expect(k).toEqual(
      expect.arrayContaining([
        en.progSuggestKicker,
        en.kcalOut,
        en.playbook,
        en.todayAnalysisKicker,
      ]),
    );
    const pr = (kicker: string) => k.indexOf(kicker);
    expect(pr(en.todayAnalysisKicker)).toBeLessThan(pr(en.progSuggestKicker));
    expect(pr(en.progSuggestKicker)).toBeLessThan(pr(en.kcalOut));
  });

  it('the front card is named on the deck button and the overlay closes from the X', async () => {
    await openToday();
    expect(document.querySelector('.nudge-deck')?.getAttribute('aria-label')).toBeTruthy();
    deck();
    expect(document.querySelector('.nudge-sheet')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.srClose }));
    await vi.waitFor(() => expect(document.querySelector('.nudge-sheet')).toBeNull());
  });

  it('energy card adds up lifting, activity and resting burn', async () => {
    await openToday();
    const c = card(en.kcalOut);
    expect(c.querySelector('.nudge-card-title')?.textContent).toMatch(/^~[\d,]+$/);
    expect(c.querySelector('.ne-active')?.textContent).toContain('·');
    expect(c.querySelector('.ne-passive')).not.toBeNull();
  });

  it('analysis card names what Trends flagged and opens Trends', async () => {
    await openToday();
    const c = card(en.todayAnalysisKicker);
    expect(c.querySelector('.nudge-card-title')?.textContent).toBe(en.todayAnalysisTitle(2));
    fireEvent.click(within(c).getByRole('button', { name: new RegExp(en.todayAnalysisCta) }));
    expect(currentHash()).toBe('#/trends');
    window.location.hash = '';
  });

  it('playbook card lists up to three plays and opens the playbook', async () => {
    const { shell } = await openToday();
    const c = card(en.playbook);
    expect(c.querySelectorAll('.td-pb-chip').length).toBeGreaterThan(0);
    expect(c.querySelectorAll('.td-pb-chip').length).toBeLessThanOrEqual(3);
    fireEvent.click(within(c).getByRole('button', { name: new RegExp(en.playbookOpen) }));
    expect(shell.calls.goPlaybook).toHaveBeenCalledTimes(1);
  });

  it('a trainer gets no advisory deck at all (Atlas and clients only)', async () => {
    setRole('trainer');
    await openToday();
    expect(document.querySelector('.nudge-deck')).toBeNull();
    expect(document.querySelector('.td-topbar')).toBeNull();
    expect(document.querySelector('.today-page .pane-main')).not.toBeNull();
  });
});

describe('TodayView nudges: program suggestion', () => {
  it('offers to build a program from history when none is assigned', async () => {
    await openToday();
    const c = card(en.progSuggestKicker);
    expect(c.querySelector('.nudge-card-title')?.textContent).toBe(en.progSuggestNewTitle);
    expect(c.textContent).toContain(en.progSuggestNewBody);
  });

  it('creating it stores a seed, thanks with a toast, jumps to Programs and starts the cooldown', async () => {
    const { shell } = await openToday();
    fireEvent.click(
      within(card(en.progSuggestKicker)).getByRole('button', {
        name: new RegExp(en.progSuggestNewCta),
      }),
    );
    const sheet = document.querySelector('.prog-suggest-sheet') as HTMLElement;
    expect(sheet.querySelector('.ps-title')?.textContent).toBe(en.progSuggestSheetTitle);
    fireEvent.click(within(sheet).getByText(en.progSuggestOptWeek));
    fireEvent.click(within(sheet).getByRole('button', { name: en.progSuggestCreate }));
    expect(shell.calls.toast).toHaveBeenCalledWith({
      kind: 'ok',
      icon: 'check-circle',
      text: en.progSuggestCreatedToast,
    });
    expect(shell.calls.goTab).toHaveBeenCalledWith('programs');
    expect(Number(localStorage.getItem(SUGGEST_KEY))).toBe(NOW);
    expect(kickers()).not.toContain(en.progSuggestKicker);
  });

  it('Cancel closes the sheet without creating anything', async () => {
    const { shell } = await openToday();
    fireEvent.click(
      within(card(en.progSuggestKicker)).getByRole('button', {
        name: new RegExp(en.progSuggestNewCta),
      }),
    );
    const sheet = document.querySelector('.prog-suggest-sheet') as HTMLElement;
    fireEvent.click(sheet.querySelector('.ps-acts button') as HTMLElement);
    await vi.waitFor(() => expect(document.querySelector('.prog-suggest-sheet')).toBeNull());
    expect(shell.calls.goTab).toBeUndefined();
    expect(localStorage.getItem(SUGGEST_KEY)).toBeNull();
  });

  it('stays quiet for twelve days after a dismissal and returns afterwards', async () => {
    localStorage.setItem(SUGGEST_KEY, String(NOW - 5 * DAY));
    await openToday();
    expect(kickers()).not.toContain(en.progSuggestKicker);
    cleanup();
    localStorage.setItem(SUGGEST_KEY, String(NOW - 13 * DAY));
    await openToday();
    expect(kickers()).toContain(en.progSuggestKicker);
  });

  it('says the program has drifted when recent lifts diverge from it', async () => {
    m.mine = { assignment: assignment(), active: true };
    await openToday();
    const c = card(en.progSuggestKicker);
    expect(c.querySelector('.nudge-card-title')?.textContent).toBe(en.progSuggestDriftedTitle);
    expect(c.textContent).toContain(en.progSuggestDriftedBody);
  });

  it('is silent when the program matches what was trained', async () => {
    const r = richState();
    const names = [...new Set(r.workouts.flatMap((w) => w.exercises.map((e) => e.name)))];
    const a = assignment();
    a.program.items = names.map((n, i) => ({
      ...a.program.items[0],
      id: `x${i}`,
      name: n,
      day: 1 + (i % 6),
    }));
    m.mine = { assignment: a, active: true };
    await openToday();
    expect(kickers()).not.toContain(en.progSuggestKicker);
  });

  it('is silent for a thin history', async () => {
    const r = richState();
    await openToday({ ...r, workouts: r.workouts.slice(-2) });
    expect(kickers()).not.toContain(en.progSuggestKicker);
    cleanup();
    // three lift sessions, but all on one weekday: not enough of a weekly shape yet
    const oneDay = [0, 1, 2].map((w) => ({
      ...history(1)[0],
      id: `one${w}`,
      startedAt: history(1)[0].startedAt - w * 7 * DAY,
      finishedAt: history(1)[0].startedAt - w * 7 * DAY + 3600_000,
    }));
    await openToday({ ...r, workouts: oneDay });
    expect(kickers()).not.toContain(en.progSuggestKicker);
    cleanup();
    await openToday({ ...r, workouts: r.workouts.slice(-3) });
    expect(kickers()).toContain(en.progSuggestKicker);
  });
});

describe('TodayView nudges: weigh-in, visit, plan, likely', () => {
  it('reminds on the usual weigh-in weekday and time when nothing is logged today', async () => {
    await openToday(weighDue());
    const c = card(en.weighTitle);
    expect(c.querySelector('.nudge-card-title')?.textContent).toBe(en.weighBody('12:00'));
  });

  it('is not shown once today is logged, before the usual time, on another weekday or when dismissed', async () => {
    await openToday(richState());
    expect(kickers()).not.toContain(en.weighTitle);
    cleanup();
    vi.setSystemTime(new Date(2026, 8, 26, 9, 0));
    await openToday(weighDue());
    expect(kickers()).not.toContain(en.weighTitle);
    cleanup();
    vi.setSystemTime(new Date(2026, 8, 25, 13, 0));
    await openToday(weighDue());
    expect(kickers()).not.toContain(en.weighTitle);
    cleanup();
    vi.setSystemTime(NOW);
    const w = weighDue();
    const d = new Date(NOW);
    await openToday({
      ...w,
      bodyMetrics: {
        ...w.bodyMetrics,
        weighInDismissedDay: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
      },
    });
    expect(kickers()).not.toContain(en.weighTitle);
  });

  it('Add weight opens the weight sheet', async () => {
    await openToday(weighDue());
    fireEvent.click(within(card(en.weighTitle)).getByRole('button', { name: en.bmAddWeight }));
    await vi.waitFor(() =>
      expect(document.querySelector('[role="dialog"]:not(.nudge-sheet)')).not.toBeNull(),
    );
  });

  it("with a program, today's plan comes first with its muscles and the usual start and meal times", async () => {
    const a = assignment({ targetMuscles: { '6': ['lats', 'biceps'] } });
    m.mine = { assignment: a, active: true };
    await openToday(withSaturday());
    const c = card(en.todayPlanKicker);
    expect(c.querySelector('.nudge-card-title')?.textContent).toBe('Pull');
    expect(c.querySelector('.nudge-muscles')?.textContent).toBe(
      `${en.muscleGroups.lats} · ${en.muscleGroups.biceps}`,
    );
    const stats = [...c.querySelectorAll('.tp-stat')].map((s) => s.textContent);
    expect(stats).toEqual([`~18:00${en.todayPlanStart}`, `~16:15${en.todayPlanEat}`]);
    expect(kickers()[0]).toBe(en.todayPlanKicker);
  });

  it('a plan day with no history has no timing line', async () => {
    m.mine = { assignment: assignment(), active: true };
    await openToday();
    const c = card(en.todayPlanKicker);
    expect(c.querySelector('.tp-timing')).toBeNull();
  });

  it('there is no plan card on a day the program leaves free, or once today is trained', async () => {
    m.mine = { assignment: assignment({}, [1, 3]), active: true };
    await openToday();
    expect(kickers()).not.toContain(en.todayPlanKicker);
    cleanup();
    m.mine = { assignment: assignment(), active: true };
    const r = richState();
    const today = new Date(NOW);
    today.setHours(8, 0, 0, 0);
    const done = {
      ...history(1)[0],
      id: 'today',
      startedAt: today.getTime(),
      finishedAt: today.getTime() + 3600_000,
    };
    await openToday({ ...r, workouts: [...r.workouts, done] });
    expect(kickers()).not.toContain(en.todayPlanKicker);
  });

  it('an inactive (draft) program is ignored', async () => {
    m.mine = { assignment: assignment(), active: false };
    await openToday();
    expect(kickers()).not.toContain(en.todayPlanKicker);
    expect(document.querySelector('.today-program-card[data-mode="train"]')).toBeNull();
  });

  it('without a program, "likely today" predicts the usual split and time from the same weekday', async () => {
    await openToday(withSaturday());
    const c = card(en.likelyToday);
    expect(c.querySelector('.nudge-card-title')?.textContent).toBe(en.likelyDayTitle('Pull day'));
    expect(c.querySelector('.nudge-muscles')?.textContent).toBeTruthy();
    expect([...c.querySelectorAll('.tp-stat-val')].map((s) => s.textContent)).toEqual([
      '~18:00',
      '~16:15',
    ]);
  });

  it('no prediction once today has a session', async () => {
    const r = richState();
    const today = new Date(NOW);
    today.setHours(8, 0, 0, 0);
    const done = {
      ...saturday(),
      id: 'today',
      startedAt: today.getTime(),
      finishedAt: today.getTime() + 3600_000,
    };
    await openToday({ ...r, workouts: [...r.workouts, saturday(), done] });
    expect(kickers()).not.toContain(en.likelyToday);
  });
});
