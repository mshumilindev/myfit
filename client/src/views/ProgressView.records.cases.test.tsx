import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { fmtTonnes, setLocale } from '../i18n';
import { en } from '../i18n/en';
import { __getStateForTests, muscleVolumeKg } from '../store';
import type { StoreState } from '../store';
import type { Exercise, Workout } from '../types';
import {
  DAY,
  freezeClock,
  makeShell,
  NOW,
  richState,
  seed,
  set,
  setDesktop,
} from './__fixtures__/viewKit';

vi.mock('../data/programMine', async (orig) => ({
  ...(await orig<typeof import('../data/programMine')>()),
  useProgramMine: () => ({ assignment: null, active: true }),
}));

import { ProgressView } from './ProgressView';

type Seg = 'total' | 'muscle' | 'volume' | 'records';
const open = (seg: Seg, state?: StoreState) => {
  if (state) seed(state);
  const shell = makeShell();
  const out = render(
    <ProgressView
      store={__getStateForTests() as never}
      shell={shell}
      sub="progress"
      seg={seg}
      onSeg={vi.fn()}
      lens="volume"
      onLens={vi.fn()}
    />,
  );
  return { ...out, shell };
};
const rangeBtn = () => document.querySelector('.pv-top .uibtn') as HTMLElement;
const lift = (id: string, name: string, kg: number): Exercise =>
  ({
    id,
    name,
    kind: 'strength',
    position: 0,
    sets: [set(`${id}-s`, 5, kg)],
  }) as unknown as Exercise;
const session = (id: string, at: number, ex: Exercise[]): Workout =>
  ({
    id,
    startedAt: at,
    finishedAt: at + 3600_000,
    gymId: null,
    exercises: ex,
  }) as unknown as Workout;
const withOld = (extra: Workout[]): StoreState => {
  const base = richState();
  return { ...base, workouts: [...extra, ...base.workouts] };
};
const rows = () => [...document.querySelectorAll('.muscle-row')] as HTMLElement[];
const rowName = (r: Element) => r.querySelector('.n')?.textContent;

beforeEach(() => {
  freezeClock(NOW);
  setLocale('en');
  setDesktop(false);
  seed(richState());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ProgressView: by muscle', () => {
  it('lists muscles by this week tonnage, most first, with tonnes and an em dash for untouched ones', () => {
    open('muscle');
    const mon = new Date(2026, 8, 21).getTime();
    const week = __getStateForTests().workouts.filter((w) => w.startedAt >= mon);
    const vol = muscleVolumeKg(week);
    const top = [...vol.entries()].sort((a, b) => b[1] - a[1])[0];
    expect(rowName(rows()[0])).toBe(en.muscleGroups[top[0]]);
    expect(rows()[0].querySelector('.v')?.textContent).toBe(fmtTonnes(top[1]));
    const dim = rows().filter((r) => r.classList.contains('dim'));
    expect(dim.length).toBeGreaterThan(0);
    for (const r of dim) expect(r.querySelector('.v')?.textContent).toBe('—');
    expect(rows()[0].querySelector('.bar span')).not.toBeNull();
  });

  it('mobile: rows are read-only (the muscle-history branch of the row click is unreachable)', () => {
    const { shell } = open('muscle');
    expect(rows()[0].tagName).toBe('DIV');
    fireEvent.click(rows()[0]);
    expect(shell.calls.openOverlay).toBeUndefined();
  });

  it('shows the weekly note on This week only', () => {
    open('muscle');
    expect(document.querySelector('.muscle-note p')?.textContent).toBe(
      en.muscleWeekNote(
        rows()
          .filter((r) => r.classList.contains('dim'))
          .map(rowName)
          .join(' · ') || null,
        rowName(rows()[0]) ?? null,
        document.querySelector('.muscle-note p')?.textContent?.match(/\d+%/)?.[0] ?? null,
      ),
    );
    fireEvent.click(rangeBtn());
    fireEvent.click(
      within(document.querySelector('.range-sheet') as HTMLElement).getByText(en.volRange28),
    );
    expect(document.querySelector('.muscle-note')).toBeNull();
  });

  it('desktop: rows are selectable buttons that do not navigate; the brass heatmap pane shows', () => {
    setDesktop(true);
    const { shell } = open('muscle');
    fireEvent.click(rows()[1]);
    expect(shell.calls.openOverlay).toBeUndefined();
    expect(rows()[1].className).toContain('accent');
    expect(document.querySelector('.vol-map-pane h3')?.textContent).toBe(en.volumeThisWeek);
    expect(document.querySelector('.brass-legend')).not.toBeNull();
    expect(document.querySelector('.muscle-heatmap, .mhm, svg')).not.toBeNull();
  });
});

describe('ProgressView: records', () => {
  it('groups lifts under their primary muscle with the best weight and a record tag', () => {
    open('records');
    const heads = [...document.querySelectorAll('.record-group-head')].map((h) => h.textContent);
    expect(heads.some((h) => h?.includes(en.muscleGroups.chest))).toBe(true);
    const bench = [...document.querySelectorAll('.record-row')].find((r) =>
      r.textContent?.includes('Bench Press'),
    ) as HTMLElement;
    const best = Math.max(
      ...__getStateForTests()
        .workouts.flatMap((w) => w.exercises)
        .filter((e) => e.name.includes('Bench Press'))
        .flatMap((e) => e.sets.map((s) => s.weight ?? 0)),
    );
    expect(bench.querySelector('.v')?.textContent).toBe(`${best} kg`);
    expect(bench.textContent).toContain(en.record);
  });

  it('an old record shows how many weeks ago instead of the record tag', () => {
    open(
      'records',
      withOld([session('old', NOW - 5 * 7 * DAY, [lift('o1', 'Barbell Squat', 400)])]),
    );
    const squat = [...document.querySelectorAll('.record-row')].find((r) =>
      r.textContent?.includes('Squat'),
    ) as HTMLElement;
    expect(squat.querySelector('.v')?.textContent).toBe('400 kg');
    expect(squat.querySelector('.when')?.textContent).toBe(en.wksAgo(5));
    expect(squat.querySelector('.uitag')).toBeNull();
  });

  it('mobile: tapping a record opens its exercise history; the muscle header opens muscle history', () => {
    const { shell } = open('records');
    const row = [...document.querySelectorAll('.record-row')].find((r) =>
      r.textContent?.includes('Bench Press'),
    ) as HTMLElement;
    fireEvent.click(row);
    expect(shell.calls.openOverlay).toHaveBeenCalledWith({
      screen: 'exercise-history',
      name: 'Barbell Bench Press - Medium Grip',
    });
    const chest = [...document.querySelectorAll('.record-group-head')].find((h) =>
      h.textContent?.includes(en.muscleGroups.chest),
    ) as HTMLElement;
    fireEvent.click(chest.querySelectorAll('button')[1]);
    expect(shell.calls.openOverlay).toHaveBeenLastCalledWith({
      screen: 'muscle-history',
      muscle: 'chest',
    });
    fireEvent.click(chest.querySelectorAll('button')[0]);
    expect(shell.calls.openOverlay).toHaveBeenCalledTimes(3);
  });

  it('a lift with no known muscle lands under Other, whose header does not navigate', () => {
    const { shell } = open(
      'records',
      withOld([session('mys', NOW - 2 * DAY, [lift('m1', 'Zzz Mystery Lift', 50)])]),
    );
    const groups = [...document.querySelectorAll('.record-group')];
    const last = groups[groups.length - 1] as HTMLElement;
    expect(last.querySelector('.record-group-head')?.textContent).toBe(en.recordsOther);
    expect(last.querySelector('.record-row .v')?.textContent).toBe('50 kg');
    fireEvent.click(last.querySelector('.record-group-head button') as HTMLElement);
    expect(shell.calls.openOverlay).toBeUndefined();
  });

  it('bodyweight-only and nameless entries produce no record row', () => {
    const base = richState();
    const w = session('bw', NOW - DAY, [
      {
        id: 'x1',
        name: '  ',
        kind: 'strength',
        position: 0,
        sets: [set('a', 5, 80)],
      } as unknown as Exercise,
      {
        id: 'x2',
        name: 'Pullups',
        kind: 'strength',
        position: 1,
        sets: [set('b', 8, null)],
      } as unknown as Exercise,
    ]);
    open('records', { ...base, workouts: [w, w, w] });
    expect(document.querySelectorAll('.record-row').length).toBe(0);
  });

  it('desktop: records are selectable and drive the detail pane with stats, chart and gyms table', () => {
    setDesktop(true);
    const { shell } = open('records');
    expect(document.querySelector('a[href="#/exercises"]')?.textContent).toBe(en.exercisesTitle);
    const pane = document.querySelector('.progress-detail-pane') as HTMLElement;
    const name = pane.querySelector('h3')?.textContent;
    expect(name).toBeTruthy();
    const selRow = () =>
      [...document.querySelectorAll('.record-row')].filter((r) => r.className.includes('accent'));
    expect(selRow()).toHaveLength(1);
    expect(selRow()[0].querySelector('.n')?.textContent).toBe(name);
    const cells = [...pane.querySelectorAll('.progress-detail-stats .cell')].map((c) => [
      c.querySelector('.l')?.textContent,
      c.querySelector('.v')?.textContent,
    ]);
    expect(cells.map((c) => c[0])).toEqual([en.recordKg, en.est1rm, en.lastTopSet, en.lastVolume]);
    expect(Number(cells[0][1])).toBeGreaterThan(0);
    expect(Number(cells[1][1])).toBeGreaterThan(Number(cells[0][1]));
    expect(pane.querySelector('.progress-detail-chart polyline')?.getAttribute('points')).toMatch(
      /,/,
    );
    expect(pane.querySelector('.progress-chart-axis')?.textContent).toContain(en.record);
    expect(pane.querySelectorAll('.progress-detail-table tbody tr').length).toBe(2);
    fireEvent.click(within(pane).getByText(en.fullHistory));
    expect(shell.calls.openOverlay).toHaveBeenCalledWith({
      screen: 'exercise-history',
      name: expect.any(String),
    });
    fireEvent.click(document.querySelectorAll('.record-row')[2] as HTMLElement);
    expect(shell.calls.openOverlay).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.progress-detail-pane h3')?.textContent).not.toBe(name);
  });

  it('desktop detail for a lift without catalog info shows only the sessions line', () => {
    setDesktop(true);
    open('records', {
      ...richState(),
      workouts: [
        session('m1', NOW - 2 * DAY, [lift('a', 'Zzz Mystery Lift', 50)]),
        session('m2', NOW - 3 * DAY, [lift('b', 'Zzz Mystery Lift', 40)]),
        session('m3', NOW - 4 * DAY, [lift('c', 'Zzz Mystery Lift', 30)]),
      ],
    });
    const pane = document.querySelector('.progress-detail-pane') as HTMLElement;
    expect(pane.querySelector('h3')?.textContent).toBe('Zzz Mystery Lift');
    expect(pane.querySelector('.hist-chips')).toBeNull();
    expect(pane.textContent).toContain('3 sessions');
    expect(document.querySelectorAll('.progress-detail-table tbody tr').length).toBe(2);
  });

  it('desktop detail table marks gyms by missing equipment', () => {
    setDesktop(true);
    open('records');
    const cells = [...document.querySelectorAll('.progress-detail-table tbody td:last-child span')];
    expect(cells.length).toBe(2);
    for (const c of cells) expect(c.className).toMatch(/ut-(ok|danger)/);
  });
});
