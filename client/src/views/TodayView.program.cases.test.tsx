import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { fmtWeekday, setLocale } from '../i18n';
import { en } from '../i18n/en';
import { dayKey } from '../store';
import type { StoreState } from '../store';
import type { Activity, Injury, RestPeriod } from '../types';
import {
  assignment,
  DAY,
  m,
  openToday,
  programOpts,
  resetTodayMocks,
} from './__fixtures__/todayMocks';
import {
  activities,
  emptyState,
  freezeClock,
  history,
  installIntersectionObserver,
  NOW,
  richState,
} from './__fixtures__/viewKit';

const dk = dayKey(NOW);
/** No injury, no rest period, and no sleep logged today (a logged night makes today's pill open the drawer). */
const calm = (): StoreState => ({ ...richState(), injuries: [], restPeriods: [], sleeps: [] });
const card = () => document.querySelector('.today-program-card.td-week') as HTMLElement;
const pills = () => [...document.querySelectorAll('.wk-pill')] as HTMLElement[];
const states = () => pills().map((p) => /st-([a-z-]+)/.exec(p.className)?.[1]);
const pill = (day: number) => pills()[day - 1];
const trainedToday = (): StoreState => {
  const r = calm();
  const at = new Date(NOW);
  at.setHours(8, 0, 0, 0);
  return {
    ...r,
    workouts: [
      ...r.workouts,
      {
        ...history(1)[0],
        id: 'today',
        startedAt: at.getTime(),
        finishedAt: at.getTime() + 3600_000,
      },
    ],
  };
};
const restOf = (over: Partial<RestPeriod>): StoreState => ({
  ...calm(),
  restPeriods: [
    {
      id: 'r1',
      startDay: dk - 1,
      endDay: dk + 1,
      mode: 'off',
      createdAt: NOW - DAY,
      name: null,
      ...over,
    } as RestPeriod,
  ],
});
const kneeInjury = (over: Partial<Injury> = {}): Injury =>
  ({
    id: 'inj',
    reason: 'injury',
    bodyPart: 'knee',
    muscles: ['quads'],
    stage: 'reintroduce',
    startDay: dk - 3,
    createdAt: NOW - 3 * DAY,
    checkins: [],
    healedDay: null,
    ...over,
  }) as Injury;

beforeEach(() => {
  freezeClock(NOW);
  setLocale('en');
  resetTodayMocks();
  installIntersectionObserver();
  m.mine = { assignment: assignment(), active: true };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('TodayView program card: today', () => {
  it('a planned, untrained day reads as a session to start, with the week so far', async () => {
    await openToday(calm());
    expect(card().dataset.mode).toBe('train');
    expect(card().querySelector('.pch-kicker')?.textContent).toBe(`${en.today} · Pull`);
    expect(card().querySelector('.pch-text .n')?.textContent).toBe('Strength Block');
    expect(card().querySelector('.pch-text .s')?.textContent).toBe(
      `${en.progWeekN(2)} · ${en.progSessions(2, 3)}`,
    );
    expect(card().querySelector('.pch-pct')?.textContent).toBe('67%');
    expect((card().querySelector('.pch-bar-fill') as HTMLElement).style.width).toBe('67%');
    expect(card().querySelector('.pch-status')?.textContent).toContain('Pull — ');
  });

  it('shows who assigned it and omits the week for an open-ended program', async () => {
    const a = assignment({ weeks: 0 });
    a.assignedBy = 'Coach Kim' as never;
    m.mine = { assignment: a, active: true };
    await openToday(calm());
    expect(card().querySelector('.pch-text .s')?.textContent).toBe(
      `${en.progSessions(2, 3)} · ${en.progAssignedBy('Coach Kim')}`,
    );
  });

  it('week pills: done, rest (not missed), today play, next rest', async () => {
    await openToday(calm());
    expect(states()).toEqual(['done', 'rest', 'done', 'rest', 'done', 'play', 'next-rest']);
    expect(pill(6).classList.contains('is-today')).toBe(true);
    expect(pill(6).querySelector('.wk-pill-label')?.textContent).toBe(en.today);
    expect(pill(1).getAttribute('aria-label')).toBe(
      `${fmtWeekday(new Date(2026, 8, 21).getTime(), 'en')} · Push`,
    );
  });

  it('a planned day that passed untrained is missed; a future planned day is next-train', async () => {
    m.mine = { assignment: assignment({}, [1, 2, 3, 6, 7]), active: true };
    await openToday(calm());
    expect(states()).toEqual(['done', 'missed', 'done', 'rest', 'done', 'play', 'next-train']);
  });

  it('once today is trained the card is done, with no status line and no play pill', async () => {
    await openToday(trainedToday());
    expect(card().dataset.mode).toBe('done');
    expect(card().querySelector('.pch-status')).toBeNull();
    expect(states()[5]).toBe('done');
  });

  it('a free day reads as rest with the program note', async () => {
    m.mine = { assignment: assignment({}, [1, 3]), active: true };
    await openToday(calm());
    expect(card().dataset.mode).toBe('rest');
    expect(card().querySelector('.pch-kicker')?.textContent).toBe(
      `${en.progRestDay} · ${fmtWeekday(NOW, 'en')}`,
    );
    expect(card().querySelector('.pch-status')?.textContent).toBe(en.restDayNote);
    expect(states()[5]).toBe('rest');
  });

  it('a muscle-only day (no exercises yet) summarises the muscles', async () => {
    m.mine = {
      assignment: assignment({ targetMuscles: { '6': ['back', 'biceps'] }, items: [] }, [1]),
      active: true,
    };
    const a = assignment({ targetMuscles: { '6': ['lats', 'biceps'] } }, [1]);
    a.program.items = a.program.items.filter((i) => i.day !== 6);
    m.mine = { assignment: a, active: true };
    await openToday(calm());
    expect(card().querySelector('.pch-status')?.textContent).toBe(
      `Pull — ${en.muscleGroups.lats} · ${en.muscleGroups.biceps}`,
    );
  });

  it('a full-body muscle day says full body', async () => {
    const a = assignment({ targetMuscles: { '6': ['fullbody'] } }, [1]);
    await openToday(calm());
    cleanup();
    a.program.items = a.program.items.filter((i) => i.day !== 6);
    m.mine = { assignment: a, active: true };
    await openToday(calm());
    expect(card().querySelector('.pch-status')?.textContent).toBe(
      `Pull — ${en.muscleGroups.fullbody}`,
    );
  });

  it('several exercises are counted with their sets', async () => {
    const a = assignment({}, [6]);
    a.program.items = [
      { ...a.program.items[0], id: 'a', name: 'Pullups', sets: 3 },
      { ...a.program.items[0], id: 'b', name: 'Bent Over Barbell Row', sets: 4 },
    ];
    m.mine = { assignment: a, active: true };
    await openToday(calm());
    expect(card().querySelector('.pch-status')?.textContent).toBe(
      `Pull — ${en.progDayWorkoutSummary(2, 7)}`,
    );
  });
});

describe('TodayView program card: other modes', () => {
  it('vacation shows as full rest and a future vacation day as off-next', async () => {
    await openToday(restOf({ mode: 'off', startDay: dk, endDay: dk + 1 }));
    expect(card().dataset.mode).toBe('off');
    expect(card().querySelector('.pch-kicker')?.textContent).toBe(en.histStateVacation);
    expect(states()[5]).toBe('off');
    expect(states()[6]).toBe('off-next');
  });

  it('an illness day is sick and keeps the program calm', async () => {
    await openToday(
      restOf({ mode: 'illness', open: true, startDay: dk - 1, illnessKind: 'virus' }),
    );
    expect(card().dataset.mode).toBe('illness');
    expect(card().querySelector('.pch-kicker')?.textContent).toBe(en.restCardIllnessKicker);
    expect(states()[5]).toBe('sick');
    // a day that was actually trained stays done, even inside the illness
    expect(states()[4]).toBe('done');
  });

  it('a deload day with nothing planned reads as an active rest day', async () => {
    m.mine = { assignment: assignment({}, [1, 3]), active: true };
    await openToday(restOf({ mode: 'active', startDay: dk, endDay: dk + 1 }));
    expect(card().dataset.mode).toBe('active');
    expect(card().querySelector('.pch-kicker')?.textContent).toBe(en.restModeActive);
    expect(states()[5]).toBe('rest');
  });

  it("a rehabbing injury keeps the session but flags it, and today's pill is the injury pill", async () => {
    await openToday({ ...calm(), injuries: [kneeInjury()] });
    expect(card().dataset.mode).toBe('injury');
    expect(card().querySelector('.pch-kicker')?.textContent).toBe(
      en.injBannerTitle(en.injBodyParts.knee),
    );
    expect(states()[5]).toBe('injury');
  });

  it('a general (non-body-part) injury is named by its reason', async () => {
    await openToday({
      ...calm(),
      injuries: [kneeInjury({ reason: 'surgery' as never, bodyPart: '' })],
    });
    expect(card().querySelector('.pch-kicker')?.textContent).toBe(
      en.injBannerTitle(en.injReason.surgery),
    );
  });

  it('a clinician full-rest window turns today into full rest', async () => {
    await openToday({
      ...calm(),
      injuries: [kneeInjury({ stage: 'protect', fullRestUntil: dk + 3 })],
    });
    expect(card().dataset.mode).toBe('off');
  });

  it('a draft (inactive) program shows the plain week strip instead', async () => {
    m.mine = { assignment: assignment(), active: false };
    await openToday(calm());
    expect(card().dataset.mode).toBe('none');
  });
});

describe('TodayView program card: block options', () => {
  it('compact drops the meta, the status line', async () => {
    programOpts({ style: 'compact' });
    await openToday(calm());
    expect(card().querySelector('.pch-text .s')).toBeNull();
    expect(card().querySelector('.pch-status')).toBeNull();
    expect(card().dataset.style).toBe('compact');
  });

  it("standard can list today's exercise names", async () => {
    programOpts({ exercises: true });
    await openToday(calm());
    expect(card().querySelector('.pch-ex')?.textContent).toContain('Bench Press');
    expect(card().querySelector('.pch-ex.is-detailed')).toBeNull();
  });

  it('detailed lists each exercise with its prescription and the target muscles', async () => {
    programOpts({ style: 'detailed', exercises: true });
    const a = assignment({ targetMuscles: { '6': ['chest'] } });
    m.mine = { assignment: a, active: true };
    await openToday(calm());
    const rows = [...card().querySelectorAll('.pch-ex.is-detailed li')];
    expect(rows).toHaveLength(1);
    expect(rows[0].querySelector('.pch-ex-v')?.textContent).toBeTruthy();
    expect(card().textContent).toContain(en.muscleGroups.chest);
  });

  it('week pills can be switched off', async () => {
    programOpts({ weekPills: false });
    await openToday(calm());
    expect(pills()).toHaveLength(0);
  });
});

describe('TodayView program card: starting and drilling in', () => {
  it("today's play pill asks for a gym, then starts the program day and opens the session", async () => {
    const { shell } = await openToday(calm());
    fireEvent.click(pill(6));
    fireEvent.click(await screen.findByText('Iron Yard'));
    await vi.waitFor(() => expect(m.startDay).toHaveBeenCalledTimes(1));
    const [a, day, name, gymId] = m.startDay.mock.calls[0] as unknown[];
    expect((a as { program: { id: string } }).program.id).toBe('p1');
    expect([day, name, gymId]).toEqual([6, 'Pull', 'g1']);
    expect(shell.calls.openOverlay).toHaveBeenCalledWith({
      screen: 'session',
      workoutId: 'w-prog',
    });
  });

  it('standing inside a saved gym skips the picker and starts there', async () => {
    localStorage.setItem(
      'spotter.lastPos',
      JSON.stringify({ lat: 1, lng: 1, accuracy: 10, at: NOW }),
    );
    const { shell } = await openToday(calm());
    fireEvent.click(pill(6));
    await vi.waitFor(() => expect(m.startDay).toHaveBeenCalledTimes(1));
    expect(m.startDay.mock.calls[0][3]).toBe('g1');
    expect(shell.calls.openOverlay).toHaveBeenCalledWith({
      screen: 'session',
      workoutId: 'w-prog',
    });
  });

  it('with the gym step off it goes straight in with the gym of the last session', async () => {
    programOpts({ gymStep: false });
    const { shell } = await openToday(calm());
    fireEvent.click(pill(6));
    await vi.waitFor(() => expect(m.startDay).toHaveBeenCalledTimes(1));
    const gymId = m.startDay.mock.calls[0][3];
    const last = [...calm().workouts]
      .sort((a, b) => b.startedAt - a.startedAt)
      .find((w) => w.gymId)!.gymId;
    expect(gymId).toBe(last);
    expect(shell.calls.openOverlay).toHaveBeenCalledWith({
      screen: 'session',
      workoutId: 'w-prog',
    });
  });

  it('a starter that returns nothing opens no overlay', async () => {
    programOpts({ gymStep: false });
    m.startDay.mockReturnValue(null);
    const { shell } = await openToday(calm());
    fireEvent.click(pill(6));
    await vi.waitFor(() => expect(m.startDay).toHaveBeenCalled());
    expect(shell.calls.openOverlay).toBeUndefined();
  });

  it('a running workout is resumed instead of starting another', async () => {
    const r = calm();
    const live = { ...r.workouts[0], id: 'live', finishedAt: null };
    const { shell } = await openToday({ ...r, workouts: [...r.workouts, live] });
    fireEvent.click(pill(6));
    expect(shell.calls.openOverlay).toHaveBeenCalledWith({ screen: 'session', workoutId: 'live' });
    expect(m.startDay).not.toHaveBeenCalled();
  });

  it('a running activity or sleep is resumed too', async () => {
    const act = { ...activities()[0], id: 'live-a', finishedAt: null } as unknown as Activity;
    const first = await openToday({ ...calm(), activities: [act] });
    fireEvent.click(pill(6));
    expect(first.shell.calls.openOverlay).toHaveBeenCalledWith({ screen: 'activity' });
    cleanup();
    const sleepNow = { id: 'night', bed: NOW - 3600_000, wake: null } as never;
    const second = await openToday({ ...calm(), sleeps: [sleepNow] });
    fireEvent.click(pill(6));
    expect(second.shell.calls.openOverlay).toHaveBeenCalledWith({ screen: 'sleep' });
  });

  it('a past day with something logged opens its drawer; an empty future day is inert', async () => {
    await openToday(calm());
    fireEvent.click(pill(1));
    expect(document.querySelector('[role="dialog"], [role="alertdialog"]')).not.toBeNull();
    cleanup();
    await openToday(calm());
    expect(pill(7).tagName).not.toBe('BUTTON');
  });

  it('today with something already logged opens the drawer, which still offers the start', async () => {
    const act = {
      ...activities()[0],
      id: 'a-today',
      startedAt: NOW - 3600_000,
      finishedAt: NOW - 1800_000,
    } as Activity;
    await openToday({ ...calm(), activities: [act] });
    fireEvent.click(pill(6));
    const sheet = document.querySelector('[role="dialog"], [role="alertdialog"]') as HTMLElement;
    expect(sheet).not.toBeNull();
    const start = within(sheet)
      .queryAllByRole('button')
      .find((b) => /start/i.test(b.textContent ?? ''));
    expect(start).toBeTruthy();
  });
});

describe('TodayView week card without a program', () => {
  beforeEach(() => {
    m.mine = { assignment: null, active: true };
  });

  it('shows done days, rest days, a play pill today and blank days after', async () => {
    await openToday(calm());
    expect(card().dataset.mode).toBe('none');
    expect(states()).toEqual(['done', 'rest', 'done', 'rest', 'done', 'play', 'blank']);
  });

  it('today is done once trained; a sick day and a vacation day show their pills', async () => {
    await openToday(trainedToday());
    expect(states()[5]).toBe('done');
    cleanup();
    await openToday(
      restOf({ mode: 'illness', startDay: dk - 1, endDay: dk, illnessKind: 'virus' }),
    );
    expect(states().slice(4, 6)).toEqual(['done', 'sick']);
    cleanup();
    await openToday(restOf({ mode: 'off', startDay: dk, endDay: dk + 1 }));
    expect(states().slice(5)).toEqual(['off', 'off-next']);
    cleanup();
    await openToday(restOf({ mode: 'active', startDay: dk, endDay: dk }));
    expect(states()[5]).toBe('rest');
  });

  it('the play pill opens the Start sheet', async () => {
    const { shell } = await openToday(calm());
    fireEvent.click(pill(6));
    expect(shell.calls.openStart).toHaveBeenCalledTimes(1);
  });

  it("a rehabbing injury colours today's pill", async () => {
    await openToday({ ...calm(), injuries: [kneeInjury()] });
    expect(states()[5]).toBe('injury');
  });

  it('a done day opens the drawer; a quiet rest day does nothing', async () => {
    await openToday(calm());
    expect(pill(2).tagName).not.toBe('BUTTON');
    fireEvent.click(pill(1));
    expect(document.querySelector('[role="dialog"], [role="alertdialog"]')).not.toBeNull();
  });

  it('the strip is hidden while the account has no history, and by the option', async () => {
    await openToday(emptyState());
    expect(card()).toBeNull();
    cleanup();
    programOpts({ weekPills: false });
    await openToday(calm());
    expect(card()).toBeNull();
  });

  it('"log a past session" shows when the option is on and today has no plan', async () => {
    programOpts({ logPast: true });
    await openToday(calm());
    fireEvent.click(screen.getByRole('button', { name: en.logPastSession }));
    expect(document.querySelector('[role="dialog"], [role="alertdialog"]')).not.toBeNull();
  });

  it('it is hidden when today has a program plan', async () => {
    programOpts({ logPast: true });
    m.mine = { assignment: assignment(), active: true };
    await openToday(calm());
    expect(screen.queryByRole('button', { name: en.logPastSession })).toBeNull();
  });
});
