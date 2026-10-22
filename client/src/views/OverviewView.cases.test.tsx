import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setLocale } from '../i18n';
import { fmtWeekday } from '../i18n';
import { en } from '../i18n/en';
import { computeTrends } from '../trends';
import { focusCounts } from '../goals';
import { BUILT_IN_CATALOG } from '../data/exercises';
import { __getStateForTests, myExercises } from '../store';
import type { Activity, Workout } from '../types';
import { DAY, emptyState, freezeClock, NOW, richState, seed } from './__fixtures__/viewKit';

const m = vi.hoisted(() => ({ mine: { assignment: null as unknown, active: true } }));
vi.mock('../data/programMine', async (orig) => ({
  ...(await orig<typeof import('../data/programMine')>()),
  useProgramMine: () => m.mine,
}));

import { OverviewView } from './OverviewView';

// 2026-09-26 is a Saturday (weekday 6)
const program = (days: Record<number, string>, extra: Record<string, unknown> = {}) => ({
  program: {
    id: 'p1',
    name: 'Strength Block',
    weeks: 8,
    daysPerWeek: Object.keys(days).length,
    status: 'active',
    authorId: 'u1',
    dayNames: { 1: 'Push', 3: 'Pull', 6: 'Legs', ...(extra.dayNames as object) },
    targetMuscles: {},
    items: Object.keys(days).map((d, i) => ({
      id: `i${i}`,
      day: Number(d),
      position: 0,
      name: 'Barbell Squat',
      kind: 'strength',
      sets: 3,
      reps: 5,
      durationMin: null,
      equipment: 'barbell',
      groupId: null,
      groupOrder: null,
      dropLast: false,
    })),
    activities: extra.activities,
  },
  assignedBy: null,
  startedAt: NOW - 14 * DAY,
  week: 2,
  done: 3,
  total: 24,
});
const open = () => {
  const cb = { onProgress: vi.fn(), onTrends: vi.fn(), onActivity: vi.fn(), onPrograms: vi.fn() };
  const out = render(<OverviewView shell={{ openOverlay: vi.fn() } as never} {...cb} />);
  return { ...out, ...cb };
};
const tile = (c: string) => document.querySelector(c) as HTMLElement;
const workout = (id: string, startedAt: number): Workout =>
  ({
    id,
    startedAt,
    finishedAt: startedAt + 3600_000,
    gymId: null,
    exercises: [
      {
        id: `e-${id}`,
        name: 'Barbell Bench Press - Medium Grip',
        sets: [{ id: `s-${id}`, weight: 100, reps: 5, isWarmup: false, done: true }],
      },
    ],
  }) as unknown as Workout;

beforeEach(() => {
  freezeClock(NOW);
  setLocale('en');
  m.mine = { assignment: null, active: true };
  seed(richState());
});
afterEach(() => cleanup());

describe('Overview: progress, records and trends tiles', () => {
  it("shows this week's volume in tonnes and eight bars with the current one marked", () => {
    seed({ ...emptyState(), workouts: [workout('a', NOW - 1 * 3600_000)] });
    open();
    expect(tile('.ov-progress .ov-big').textContent).toBe('0.5 t');
    const bars = [...document.querySelectorAll('.ov-progress .ov-bar')] as HTMLElement[];
    expect(bars).toHaveLength(8);
    expect(bars[7].classList.contains('cur')).toBe(true);
    expect(bars[7].style.height).toBe('100%');
    expect(bars[0].style.height).toBe('6%');
    expect(screen.getByText(en.volumeThisWeek)).toBeTruthy();
  });

  it('with no training the volume is 0.0 t and every bar sits at the 6% floor', () => {
    seed(emptyState());
    open();
    expect(tile('.ov-progress .ov-big').textContent).toBe('0.0 t');
    const hs = [...document.querySelectorAll('.ov-progress .ov-bar')].map(
      (b) => (b as HTMLElement).style.height,
    );
    expect(new Set(hs)).toEqual(new Set(['6%']));
  });

  it('the progress tile opens total progress; records opens the records segment', () => {
    const { onProgress } = open();
    fireEvent.click(tile('.ov-progress'));
    expect(onProgress).toHaveBeenLastCalledWith('total');
    fireEvent.click(tile('.ov-records'));
    expect(onProgress).toHaveBeenLastCalledWith('records');
  });

  it('records shows the heaviest estimated 1RM lift, rounded, or an empty hint', () => {
    seed({ ...emptyState(), workouts: [workout('a', NOW - DAY)] });
    open();
    expect(tile('.ov-records .ov-ts').textContent).toMatch(
      /^Barbell Bench Press - Medium Grip 1\d\d kg$/,
    );
    cleanup();
    seed(emptyState());
    open();
    expect(tile('.ov-records .ov-ts').textContent).toBe(en.ovRecordsEmpty);
  });

  it('a locked trends engine says so and opens trends on tap', () => {
    seed(emptyState());
    const { onTrends } = open();
    expect(tile('.ov-trends .ov-tt').textContent).toBe(en.trendsTab);
    expect(tile('.ov-trends .ov-ts').textContent).toBe(en.ovTrendsLocked);
    expect(tile('.ov-trends').classList.contains('is-risk')).toBe(false);
    fireEvent.click(tile('.ov-trends'));
    expect(onTrends).toHaveBeenCalledTimes(1);
  });

  it('with insights ready the trends tile counts the risks and warnings, or says all clear', () => {
    const s = __getStateForTests();
    const finished = s.workouts.filter((w) => w.finishedAt !== null);
    const tr = computeTrends(finished, s.bodyMetrics, Date.now());
    const actionable = tr.insights.filter((i) => i.level === 'risk' || i.level === 'warn');
    open();
    if (tr.ready && actionable.length > 0) {
      expect(tile('.ov-trends .ov-tt').textContent).toBe(en.ovTrendsRisks(actionable.length));
      expect(tile('.ov-trends').classList.contains('is-risk')).toBe(true);
      expect(tile('.ov-trends .ov-ts').textContent).toBe(
        actionable[0].headline || actionable[0].kicker || '',
      );
    } else if (tr.ready) {
      expect(tile('.ov-trends .ov-tt').textContent).toBe(en.ovTrendsClear);
      expect(tile('.ov-trends .ov-ts').textContent).toBe(tr.insights[0]?.headline ?? '');
    } else {
      expect(tile('.ov-trends .ov-ts').textContent).toBe(en.ovTrendsLocked);
    }
  });

  it('the trends tile is titled with the coach name when the coach is on', () => {
    const s = richState();
    seed({ ...s, coach: { ...s.coach, enabled: true } });
    open();
    expect(tile('.ov-trends .ov-k').textContent).toBe(en.atlasName);
  });

  it('without the coach it is titled Trends', () => {
    open();
    expect(tile('.ov-trends .ov-k').textContent).toBe(en.trendsTab);
  });
});

describe('Overview: activity tile', () => {
  const acts = (list: Array<[string, Activity['category'], number, number]>): Activity[] =>
    list.map(([type, category, ago, min], i) => ({
      id: `a${i}`,
      type,
      category,
      startedAt: NOW - ago * DAY,
      finishedAt: NOW - ago * DAY + min * 60000,
      durationMin: min,
    })) as Activity[];

  it('sums conditioning and recovery minutes of the current week and opens Activity on tap', () => {
    seed({
      ...emptyState(),
      activities: acts([
        ['run', 'conditioning', 0, 30],
        ['yoga', 'recovery', 0, 20],
        ['run', 'conditioning', 8, 40],
      ]),
    });
    const { onActivity } = open();
    expect(tile('.ov-act')).toBeTruthy();
    expect(tile('.ov-act .ov-tt').textContent).toBe(en.ovActivityWeek(50));
    expect(document.querySelectorAll('.ov-act .ov-bar')).toHaveLength(8);
    expect(document.querySelectorAll('.ov-act .ov-bar.cur')).toHaveLength(1);
    fireEvent.click(tile('.ov-act'));
    expect(onActivity).toHaveBeenCalledTimes(1);
  });

  it('a quiet current week says "none"', () => {
    seed({
      ...emptyState(),
      activities: acts([
        ['run', 'conditioning', 10, 30],
        ['run', 'conditioning', 17, 30],
      ]),
    });
    open();
    expect(tile('.ov-act .ov-tt').textContent).toBe(en.ovActivityNone);
  });

  it('is hidden with no activities at all', () => {
    seed(emptyState());
    open();
    expect(tile('.ov-act')).toBeNull();
  });
});

describe('Overview: goals, playbook and exercises tiles', () => {
  it('goals names the physique archetype and counts the focus muscles', () => {
    const { onPrograms } = open();
    const s = __getStateForTests();
    expect(tile('.ov-sq .ov-tt').textContent).toBe(en.archetypes[s.goals.physique!.archetype].name);
    fireEvent.click(document.querySelectorAll('.ov-sq')[0]);
    expect(onPrograms).toHaveBeenLastCalledWith('goals');
    const c = focusCounts(s.goals);
    expect(document.querySelectorAll('.ov-sq .ov-ts')[0].textContent).toBe(
      c.grow + c.ease > 0 ? en.ovGoalsFocus(c.grow + c.ease) : en.ovGoalsNone,
    );
  });

  it('without goals the tile is just titled Goals and says none', () => {
    seed(emptyState());
    open();
    expect(document.querySelectorAll('.ov-sq .ov-tt')[0].textContent).toBe(en.goalsTab);
    expect(document.querySelectorAll('.ov-sq .ov-ts')[0].textContent).toBe(en.ovGoalsNone);
  });

  it('a focus block shows how many muscles are in play', () => {
    const s = richState();
    seed({
      ...s,
      goals: {
        ...s.goals,
        focus: {
          label: 'B',
          startedAt: NOW,
          weeks: 4,
          emphasis: { biceps: 'grow', 'delt-side': 'grow', quads: 'ease' },
        } as never,
      },
    });
    open();
    const c = focusCounts(__getStateForTests().goals);
    expect(c.grow + c.ease).toBe(3);
    expect(document.querySelectorAll('.ov-sq .ov-ts')[0].textContent).toBe(en.ovGoalsFocus(3));
  });

  it('playbook opens on tap; empty history shows the empty hint', () => {
    seed(emptyState());
    const { onPrograms } = open();
    expect(document.querySelectorAll('.ov-sq .ov-tt')[1].textContent).toBe(en.playbook);
    expect(document.querySelectorAll('.ov-sq .ov-ts')[1].textContent).toBe(en.ovPlaybookEmpty);
    fireEvent.click(document.querySelectorAll('.ov-sq')[1]);
    expect(onPrograms).toHaveBeenLastCalledWith('playbook');
  });

  it('exercises row shows library and custom counts and opens exercises', () => {
    const { onPrograms } = open();
    expect(tile('.ov-row:last-child .ov-ts').textContent).toBe(
      en.ovExercisesSub(BUILT_IN_CATALOG.length, myExercises().length),
    );
    fireEvent.click(document.querySelector('.ov-page > .ov-row:last-child') as HTMLElement);
    expect(onPrograms).toHaveBeenLastCalledWith('exercises');
  });
});

describe('Overview: program week tile', () => {
  it('without a program invites the user to find one', () => {
    const { onPrograms } = open();
    expect(tile('.ov-program.is-empty .ov-tt').textContent).toBe(en.ovProgramNone);
    expect(tile('.ov-program.is-empty .ov-ts').textContent).toBe(en.ovProgramNoneSub);
    fireEvent.click(tile('.ov-program'));
    expect(onPrograms).toHaveBeenLastCalledWith('programs');
  });

  it('an inactive assignment is treated as no program', () => {
    m.mine = { assignment: program({ 1: '', 3: '', 6: '' }), active: false };
    open();
    expect(tile('.ov-program.is-empty')).toBeTruthy();
  });

  it('shows one cell per weekday, planned days named and the rest as rest, today lit', () => {
    m.mine = { assignment: program({ 1: '', 3: '', 6: '' }), active: true };
    seed(emptyState());
    open();
    expect(tile('.ov-program .ov-k').textContent).toBe(en.ovProgramKicker('Strength Block'));
    const cells = [...document.querySelectorAll('.ov-day')];
    expect(cells).toHaveLength(7);
    const names = cells.map((c) => c.querySelector('.ov-dn')?.textContent);
    const r = en.progRestShort;
    expect(names).toEqual(['Push', r, 'Pull', r, r, 'Legs', r]);
    expect(document.querySelectorAll('.ov-day.is-rest')).toHaveLength(4);
    const today = document.querySelector('.ov-day.is-today')!;
    expect(today.querySelector('.ov-dn')?.textContent).toBe('Legs');
    expect(today.querySelector('.ov-dl')?.textContent).toBe('Sat');
  });

  it('today with a plan and nothing done yet reads "Today: <day>"', () => {
    m.mine = { assignment: program({ 1: '', 3: '', 6: '' }), active: true };
    seed(emptyState());
    open();
    expect(tile('.ov-program > .ov-ts').textContent).toBe(en.ovProgramToday('Legs'));
  });

  it('after training today it says done', () => {
    m.mine = { assignment: program({ 1: '', 3: '', 6: '' }), active: true };
    seed({ ...emptyState(), workouts: [workout('t', NOW - 2 * 3600_000)] });
    open();
    expect(tile('.ov-program > .ov-ts').textContent).toBe(en.ovProgramDone);
  });

  it('on a rest day it names the next planned day and its weekday', () => {
    m.mine = { assignment: program({ 1: '', 3: '' }), active: true };
    seed(emptyState());
    open();
    expect(tile('.ov-program > .ov-ts').textContent).toBe(
      en.ovProgramRestNext('Push', fmtWeekday(NOW + 2 * DAY, 'en')),
    );
  });

  it('a program with no planned day at all falls back to the rest-day line', () => {
    m.mine = { assignment: program({}), active: true };
    seed(emptyState());
    open();
    expect(tile('.ov-program > .ov-ts').textContent).toBe(en.progRestDay);
  });

  it('planned activities for today ride along the footer', () => {
    m.mine = {
      assignment: program(
        { 1: '', 3: '', 6: '' },
        {
          activities: [
            { id: 'a', day: 6, type: 'run', minutes: 20 },
            { id: 'b', day: 2, type: 'run', minutes: 99 },
          ],
        },
      ),
      active: true,
    };
    seed(emptyState());
    open();
    expect(tile('.ov-program > .ov-ts').textContent).toBe(
      `${en.ovProgramToday('Legs')} · ${en.actType.run} 20 ${en.minShort}`,
    );
  });

  it('unnamed days use the generic day label', () => {
    const a = program({ 1: '', 6: '' }, { dayNames: { 1: '', 3: '', 6: '' } });
    m.mine = { assignment: a, active: true };
    seed(emptyState());
    open();
    expect(tile('.ov-program > .ov-ts').textContent).toBe(en.ovProgramToday(en.progDay(6)));
  });

  it('tapping the week opens Programs', () => {
    m.mine = { assignment: program({ 1: '', 3: '', 6: '' }), active: true };
    const { onPrograms } = open();
    fireEvent.click(tile('.ov-program'));
    expect(onPrograms).toHaveBeenLastCalledWith('programs');
  });
});
