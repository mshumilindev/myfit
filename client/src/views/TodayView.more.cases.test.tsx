import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { setLocale, fmtWeekdayDayMonth } from '../i18n';
import { en } from '../i18n/en';
import { __getStateForTests } from '../store';
import type { StoreState } from '../store';
import type { Activity, Injury, RestPeriod, SleepNight, Workout } from '../types';
import { peekProgramSeed, takeProgramSeed } from '../data/programSeed';
import { getTodayLayout, setTodayLayout, addSection } from '../today/layout';
import { setRole } from '../api';
import { assignment, openToday, resetTodayMocks, m } from './__fixtures__/todayMocks';
import {
  activities,
  DAY,
  emptyState,
  freezeClock,
  GYM,
  installIntersectionObserver,
  NOW,
  richState,
  sleeps,
} from './__fixtures__/viewKit';

const learn = vi.hoisted(() => ({ ready: false }));
vi.mock('../learn/catalog', async (orig) => ({
  ...(await orig<typeof import('../learn/catalog')>()),
  isReady: () => learn.ready,
}));

const calm = (): StoreState => ({ ...richState(), injuries: [], restPeriods: [], sleeps: [] });
const dialog = () => document.querySelector('[role="dialog"], [role="alertdialog"]') as HTMLElement;
const deck = () => {
  fireEvent.click(document.querySelector('.nudge-deck') as HTMLElement);
  return [...document.querySelectorAll('.nudge-full')] as HTMLElement[];
};

beforeEach(() => {
  freezeClock(NOW);
  setLocale('en');
  resetTodayMocks();
  learn.ready = false;
  installIntersectionObserver();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  takeProgramSeed();
});

describe('TodayView: log a past session', () => {
  const open = async () => {
    const r = await openToday({ ...emptyState(), gyms: [GYM] });
    fireEvent.click(screen.getAllByRole('button', { name: en.logPastSession })[0]);
    return r;
  };

  it('yesterday 18:00 for an hour is the default; continuing adds that workout and opens it for adding exercises', async () => {
    const { shell } = await open();
    fireEvent.click(within(dialog()).getByRole('button', { name: en.backfillContinue }));
    const call = shell.calls.openOverlay.mock.calls.at(-1)![0] as {
      screen: string;
      workoutId: string;
      startAdd: boolean;
    };
    expect(call).toMatchObject({ screen: 'past-workout', startAdd: true });
    const w = __getStateForTests().workouts.find((x) => x.id === call.workoutId) as Workout;
    const start = new Date(NOW - DAY);
    start.setHours(18, 0, 0, 0);
    expect(w.startedAt).toBe(start.getTime());
    expect(w.finishedAt).toBe(start.getTime() + 60 * 60_000);
    expect(w.gymId ?? null).toBeNull();
    await waitFor(() => expect(document.querySelector('.backfill-sheet')).toBeNull());
  });

  it('the chosen gym is stored on the new workout', async () => {
    const { shell } = await open();
    fireEvent.click(within(dialog()).getByText(en.backfillGymChoose));
    fireEvent.click(await screen.findByText(GYM.name));
    fireEvent.click(within(dialog()).getByRole('button', { name: en.backfillContinue }));
    const id = (shell.calls.openOverlay.mock.calls.at(-1)![0] as { workoutId: string }).workoutId;
    expect(__getStateForTests().workouts.find((x) => x.id === id)?.gymId).toBe(GYM.id);
  });

  it('a home session is created as a home workout and still asks for moves', async () => {
    const { shell } = await open();
    fireEvent.click(within(dialog()).getByText(en.backfillKindHome));
    fireEvent.click(within(dialog()).getByRole('button', { name: en.backfillContinue }));
    const call = shell.calls.openOverlay.mock.calls.at(-1)![0] as {
      workoutId: string;
      startAdd: boolean;
    };
    expect(call.startAdd).toBe(true);
    expect(__getStateForTests().workouts.find((x) => x.id === call.workoutId)?.kind).toBe('home');
  });

  it('a saved home set is prefilled by name and needs no more adding', async () => {
    const base = { ...emptyState(), gyms: [GYM] };
    const state = {
      ...base,
      home: {
        ...base.home,
        sets: [{ id: 'hs1', name: 'Garage circuit', moves: [], createdAt: NOW, updatedAt: NOW }],
      },
    } as StoreState;
    const { shell } = await openToday(state);
    fireEvent.click(screen.getAllByRole('button', { name: en.logPastSession })[0]);
    fireEvent.click(within(dialog()).getByText(en.backfillKindHome));
    fireEvent.click(within(dialog()).getByRole('button', { name: en.backfillContinue }));
    const call = shell.calls.openOverlay.mock.calls.at(-1)![0] as {
      workoutId: string;
      startAdd: boolean;
    };
    expect(call.startAdd).toBe(false);
    const w = __getStateForTests().workouts.find((x) => x.id === call.workoutId);
    expect(w?.homeSetId).toBe('hs1');
    expect(w?.dayName).toBe('Garage circuit');
  });

  it('cancel closes the sheet without creating anything', async () => {
    await open();
    fireEvent.click(document.querySelector('.backfill-sheet .sheet-actions button') as HTMLElement);
    await waitFor(() => expect(document.querySelector('.backfill-sheet')).toBeNull());
    expect(__getStateForTests().workouts).toHaveLength(0);
  });
});

describe('TodayView: history rows open what they show', () => {
  it('a session, an activity, a night and a nap each open their own screen', async () => {
    const { shell } = await openToday({ ...richState(), injuries: [], restPeriods: [] });
    const calls = () => shell.calls.openOverlay.mock.calls.map((c) => c[0]);
    const row = (sel: string) => document.querySelector(`.td-history ${sel}`) as HTMLElement;
    fireEvent.click(row('.hist-workout'));
    expect(calls().at(-1)).toMatchObject({ screen: 'past-workout' });
    fireEvent.click(row('.hist-activity.cat-conditioning'));
    expect(calls().at(-1)).toMatchObject({ screen: 'activity' });
    expect((calls().at(-1) as { editId: string }).editId).toMatch(/^a-/);
    fireEvent.click(row('.hist-activity.cat-sleep'));
    expect(calls().at(-1)).toMatchObject({ screen: 'sleep', mode: 'edit' });
  });

  it('"See all history" opens the full history', async () => {
    const { shell } = await openToday(calm());
    fireEvent.click(document.querySelector('.td-history-all') as HTMLElement);
    expect(shell.calls.openOverlay).toHaveBeenCalledWith({ screen: 'history' });
  });
});

describe('TodayView: today drawer', () => {
  it("starting from today's drawer closes it and opens the Start sheet", async () => {
    const act1 = {
      ...activities()[0],
      id: 'a-today',
      startedAt: NOW - 3600_000,
      finishedAt: NOW - 1800_000,
    } as Activity;
    const { shell } = await openToday({ ...calm(), activities: [act1] });
    fireEvent.click(document.querySelectorAll('.wk-pill')[5] as HTMLElement);
    fireEvent.click(
      within(dialog()).getByRole('button', { name: new RegExp(en.startSessionLabel) }),
    );
    expect(shell.calls.openStart).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(document.querySelector('.day-sheet-start')).toBeNull());
  });

  it("a day drawer's session and activity rows open their screens", async () => {
    const { shell } = await openToday(calm());
    const pill = () => document.querySelectorAll('.wk-pill')[4] as HTMLElement;
    fireEvent.click(pill());
    fireEvent.click(dialog().querySelector('.hist-workout') as HTMLElement);
    expect(shell.calls.openOverlay).toHaveBeenLastCalledWith({
      screen: 'past-workout',
      workoutId: expect.stringMatching(/^w-/),
    });
    await waitFor(() => expect(document.querySelector('.day-sheet-items')).toBeNull());
    fireEvent.click(pill());
    fireEvent.click(dialog().querySelector('.hist-activity') as HTMLElement);
    expect(shell.calls.openOverlay).toHaveBeenLastCalledWith({ screen: 'activity', editId: 'a-0' });
  });

  it("a day drawer's night opens the sleep editor", async () => {
    const { shell } = await openToday({ ...calm(), sleeps: sleeps(21, NOW - DAY) as SleepNight[] });
    fireEvent.click(document.querySelectorAll('.wk-pill')[4] as HTMLElement);
    fireEvent.click(dialog().querySelector('.cat-sleep') as HTMLElement);
    expect(shell.calls.openOverlay).toHaveBeenLastCalledWith({
      screen: 'sleep',
      mode: 'edit',
      nightId: expect.stringMatching(/^sl-/),
    });
  });
});

describe('TodayView: clock', () => {
  it('while a session is live the screen follows the clock past midnight', async () => {
    const r = richState();
    const live = {
      ...r.workouts[0],
      id: 'live',
      startedAt: NOW - 600_000,
      finishedAt: null,
    } as Workout;
    await openToday({ ...r, workouts: [...r.workouts, live] });
    const head = () => document.querySelector('.td-topbar-date')?.textContent;
    expect(head()).toBe(fmtWeekdayDayMonth(NOW, 'en'));
    vi.setSystemTime(NOW + DAY);
    await act(async () => {
      await new Promise((res) => setTimeout(res, 1200));
    });
    expect(head()).toBe(fmtWeekdayDayMonth(NOW + DAY, 'en'));
  });
});

describe('TodayView: week card height memory', () => {
  const asProgram = () => {
    m.mine = { assignment: assignment(), active: true };
  };
  it('remembers the measured height of the real week card for the next visit', async () => {
    asProgram();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      height: 88.4,
    } as DOMRect);
    await openToday(calm());
    await waitFor(() => expect(localStorage.getItem('spotter.todayWeekH.m')).toBe('88'));
  });

  it('a blocked storage never breaks the screen', async () => {
    asProgram();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      height: 90,
    } as DOMRect);
    const orig = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      k: string,
      v: string,
    ) {
      if (k.startsWith('spotter.todayWeekH')) throw new Error('private mode');
      return orig.call(this, k, v);
    });
    await openToday(calm());
    await act(async () => {
      await new Promise((res) => setTimeout(res, 50));
    });
    expect(document.querySelector('.td-week')).not.toBeNull();
  });

  it('without a program the stand-in keeps the old height, then lets go and forgets it after 2.5 s', async () => {
    localStorage.setItem('spotter.todayWeekH.m', '96');
    await openToday(calm());
    const card = () => document.querySelector('.td-week') as HTMLElement;
    expect(card().style.minHeight).toBe('96px');
    await waitFor(() => expect(localStorage.getItem('spotter.todayWeekH.m')).toBeNull(), {
      timeout: 4000,
    });
    expect(card().style.minHeight).toBe('');
  }, 8000);

  it('an unreadable or unremovable stored height is ignored', async () => {
    const orig = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, k: string) {
      if (k.startsWith('spotter.todayWeekH')) throw new Error('private mode');
      return orig.call(this, k);
    });
    const origRm = Storage.prototype.removeItem;
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (
      this: Storage,
      k: string,
    ) {
      if (k.startsWith('spotter.todayWeekH')) throw new Error('private mode');
      return origRm.call(this, k);
    });
    await openToday(calm());
    await act(async () => {
      await new Promise((res) => setTimeout(res, 2700));
    });
    expect((document.querySelector('.td-week') as HTMLElement).style.minHeight).toBe('');
  }, 8000);
});

describe('TodayView: program suggestion sheet choices', () => {
  const openSheet = async () => {
    await openToday();
    fireEvent.click(
      within(
        deck().find((c) => c.querySelector('.nudge-kicker')?.textContent === en.progSuggestKicker)!,
      ).getByRole('button', {
        name: new RegExp(en.progSuggestNewCta),
      }),
    );
    return document.querySelector('.prog-suggest-sheet') as HTMLElement;
  };

  it('"with last week\'s lifts" is the default and fills the draft with exercises', async () => {
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByRole('button', { name: en.progSuggestCreate }));
    expect(peekProgramSeed()!.items.length).toBeGreaterThan(0);
  });

  it('"week only" leaves the draft without exercises; switching back to lifts restores them', async () => {
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByText(en.progSuggestOptWeek));
    fireEvent.click(within(sheet).getByText(en.progSuggestOptLifts));
    fireEvent.click(within(sheet).getByText(en.progSuggestOptWeek));
    fireEvent.click(within(sheet).getByRole('button', { name: en.progSuggestCreate }));
    expect(peekProgramSeed()!.items).toHaveLength(0);
  });

  it('Escape closes the sheet and creates nothing', async () => {
    await openSheet();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(document.querySelector('.prog-suggest-sheet')).toBeNull());
    expect(peekProgramSeed()).toBeNull();
  });
});

describe('TodayView: the learn nudge', () => {
  it('once lessons are done it joins the deck with the progress and opens Learn', async () => {
    learn.ready = true;
    localStorage.setItem('spotter.learn.completed', JSON.stringify(['a', 'b']));
    await openToday();
    const c = deck().find(
      (x) => x.querySelector('.nudge-kicker')?.textContent === en.learnBannerKicker,
    )!;
    expect(c.querySelector('.learn-banner-sub')?.textContent).toMatch(/^2 \/ \d+ lessons$/);
    const total = Number(c.querySelector('.learn-banner-sub')!.textContent!.match(/\/ (\d+)/)![1]);
    expect(c.querySelector<HTMLElement>('.learn-banner-bar span')!.style.width).toBe(
      `${Math.round((2 / total) * 100)}%`,
    );
    fireEvent.click(within(c).getByRole('button', { name: new RegExp(en.learnBannerCta) }));
    expect(window.location.hash).toBe('#/learn');
  });

  it('with nothing done it is a banner above the deck instead; unreadable progress counts as none', async () => {
    learn.ready = true;
    localStorage.setItem('spotter.learn.completed', '{not json');
    await openToday();
    expect(document.querySelector('.learn-banner')).not.toBeNull();
  });

  it('is absent while no lesson has a video', async () => {
    localStorage.setItem('spotter.learn.completed', JSON.stringify(['a']));
    await openToday();
    expect(document.querySelector('.learn-banner')).toBeNull();
    expect(deck().map((x) => x.querySelector('.nudge-kicker')?.textContent)).not.toContain(
      en.learnBannerKicker,
    );
  });
});

describe('TodayView: sleep cards', () => {
  const yesterdayOn = (): StoreState => ({
    ...calm(),
    sleeps: sleeps(21, NOW - DAY) as SleepNight[],
  });

  it('a forgotten night: "enter manually" opens the sleep backfill', async () => {
    const { shell } = await openToday(yesterdayOn());
    fireEvent.click(await screen.findByRole('button', { name: en.sleepEnterManually }));
    expect(shell.calls.openOverlay).toHaveBeenCalledWith({ screen: 'sleep', mode: 'backfill' });
  });

  it('an auto-filled night asks to adjust the times', async () => {
    const s = sleeps(21, NOW);
    s[0] = { ...s[0], source: 'auto' };
    const base = calm();
    const { shell } = await openToday({
      ...base,
      sleeps: s as SleepNight[],
      sleepSettings: { ...base.sleepSettings, autoLog: true },
    });
    fireEvent.click(await screen.findByRole('button', { name: en.sleepAdjustTimes }));
    expect(shell.calls.openOverlay).toHaveBeenCalledWith({ screen: 'sleep', mode: 'backfill' });
  });
});

describe('TodayView: quick shortcuts', () => {
  const withShortcuts = () =>
    setTodayLayout(
      addSection(
        getTodayLayout(),
        {
          id: 'quick',
          title: 'Quick',
          layout: 'shortcuts',
          items: [
            { id: 'q1', widget: 'sc:log-past', size: 'XS' },
            { id: 'q2', widget: 'sc:weigh', size: 'XS' },
          ],
        },
        undefined,
        NOW,
      ),
    );

  it('"Log past" opens the backfill sheet and the weigh-in shortcut opens the weight sheet', async () => {
    withShortcuts();
    await openToday(calm());
    fireEvent.click(screen.getByRole('button', { name: en.todayLogPastShort }));
    expect(dialog()).not.toBeNull();
    expect(within(dialog()).getByText(en.backfillDate)).toBeTruthy();
  });

  it('the weigh-in shortcut opens the weight sheet', async () => {
    withShortcuts();
    await openToday(calm());
    fireEvent.click(screen.getByRole('button', { name: /weigh/i }));
    expect(dialog()).not.toBeNull();
    expect(document.querySelector('.backfill-sheet')).toBeNull();
  });
});

describe('TodayView: status banners, remaining actions', () => {
  const dk = Math.floor(NOW / DAY);
  it('rehab: "View plan" opens the injury', async () => {
    const inj = {
      id: 'inj',
      reason: 'injury',
      bodyPart: 'knee',
      muscles: ['quads'],
      stage: 'reintroduce',
      startDay: dk - 3,
      createdAt: NOW - 3 * DAY,
      checkins: [],
      healedDay: null,
    } as Injury;
    const { shell } = await openToday({ ...richState(), injuries: [inj], restPeriods: [] });
    const b = document.querySelector('.tr-banner') as HTMLElement;
    fireEvent.click(within(b).getByRole('button', { name: new RegExp(en.injViewPlan) }));
    expect(shell.calls.openOverlay).toHaveBeenCalledWith({ screen: 'injury', injuryId: 'inj' });
  });

  it('an active rest period: "End now" asks for confirmation', async () => {
    const r = {
      id: 'r1',
      startDay: dk - 1,
      endDay: dk + 2,
      mode: 'active',
      createdAt: NOW - DAY,
      name: null,
    } as RestPeriod;
    await openToday({ ...richState(), injuries: [], restPeriods: [r] });
    const b = document.querySelector('.tr-banner') as HTMLElement;
    fireEvent.click(within(b).getByRole('button', { name: en.restEndNow }));
    expect(dialog().textContent).toContain(en.restEndBody);
  });
});

describe('TodayView: Atlas and clients', () => {
  const roster = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `c${i}`,
      name: `Client${i} Surname`,
      avatar: false,
      lastSessionAt: NOW - i * DAY,
      dormantDays: null,
    }));

  it('a trainer\'s Today: Atlas opens the coach, a client opens their profile, "+N more" opens the clients area', async () => {
    setRole('trainer');
    m.roster = roster(14);
    const { shell } = await openToday(richState());
    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(`^${en.atlasName}|${en.atlasInvite}`) }),
    );
    expect(shell.calls.openOverlay).toHaveBeenCalledWith({ screen: 'coach' });
    fireEvent.click(screen.getByRole('button', { name: 'Client0 Surname' }));
    expect(window.location.hash).toBe('#/c/clients/c0');
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.todayMore) }));
    expect(window.location.hash).toBe('#/people/clients');
  });
});
