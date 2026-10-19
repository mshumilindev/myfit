import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { fmtDayMonth, setLocale } from '../i18n';
import { en } from '../i18n/en';
import { __getStateForTests, workoutVolumeKg } from '../store';
import type { StoreState } from '../store';
import type { Workout } from '../types';
import {
  DAY,
  freezeClock,
  makeShell,
  NOW,
  richState,
  seed,
  setDesktop,
} from './__fixtures__/viewKit';

vi.mock('../data/programMine', async (orig) => ({
  ...(await orig<typeof import('../data/programMine')>()),
  useProgramMine: () => ({ assignment: null, active: true }),
}));

import { ProgressView } from './ProgressView';

type Seg = 'total' | 'muscle' | 'volume' | 'records';
const open = (seg: Seg = 'total', state?: StoreState) => {
  if (state) seed(state);
  const shell = makeShell();
  const onSeg = vi.fn();
  const out = render(
    <ProgressView
      store={__getStateForTests() as never}
      shell={shell}
      sub="progress"
      seg={seg}
      onSeg={onSeg}
      lens="volume"
      onLens={vi.fn()}
    />,
  );
  return { ...out, shell, onSeg };
};
const rangeBtn = () => document.querySelector('.pv-top .uibtn') as HTMLElement;
const pick = (name: string) => {
  fireEvent.click(rangeBtn());
  const sheet = document.querySelector('.range-sheet') as HTMLElement;
  fireEvent.click(within(sheet).getByText(name));
};
const kpi = () => document.querySelector('.pv-hero .kpi .big')?.textContent;
const bars = () => document.querySelectorAll('.pv-hero .bars .bar').length;
const sumKg = (ws: Workout[]) => ws.reduce((v, w) => v + workoutVolumeKg(w), 0);
const tonnes = (kg: number) => `${(kg / 1000).toFixed(1)} t`;

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

describe('ProgressView: hero KPI and range', () => {
  it('default range is this week: KPI is the Mon-Sun tonnage with the delta against last week', () => {
    const ws = __getStateForTests().workouts;
    const wk = (from: number) =>
      ws.filter((w) => w.startedAt >= from && w.startedAt < from + 7 * DAY);
    const mon = new Date(2026, 8, 21).getTime();
    const cur = sumKg(wk(mon));
    const prev = sumKg(wk(mon - 7 * DAY));
    expect(cur).toBeGreaterThan(0);
    open();
    expect(kpi()).toBe(tonnes(cur));
    expect(document.querySelector('.pv-hero .kpi .lab')?.textContent).toBe(en.volumeThisWeek);
    const pct = Math.round(((cur - prev) / prev) * 100);
    expect(document.querySelector('.pv-hero .kpi .uitag')?.textContent).toBe(
      `${pct >= 0 ? '+' : '−'}${Math.abs(pct)}%`,
    );
    expect(bars()).toBe(10);
    expect(rangeBtn().textContent).toBe(en.volRange7);
  });

  it('the range button needs 3 finished sessions: hidden at 2, shown at 3', () => {
    const base = richState();
    open('total', { ...base, workouts: base.workouts.slice(-2) });
    expect(document.querySelector('.pv-top .uibtn')).toBeNull();
    cleanup();
    open('total', { ...base, workouts: base.workouts.slice(-3) });
    expect(rangeBtn().textContent).toBe(en.volRange7);
  });

  it('range sheet lists the five presets and highlights the current one', () => {
    open();
    fireEvent.click(rangeBtn());
    const sheet = document.querySelector('.range-sheet') as HTMLElement;
    for (const n of [en.volRange7, en.volRange28, en.rangeM3, en.rangeY1, en.rangeAll])
      expect(within(sheet).getByText(n)).toBeTruthy();
    const chips = [...sheet.querySelectorAll('.vvs-range button')] as HTMLElement[];
    const on = chips.filter((c) => c.getAttribute('aria-pressed') === 'true');
    expect(on.map((c) => c.textContent)).toEqual([en.volRange7]);
  });

  it('last 4 weeks: rolling 28 days, weekly bars, closes the sheet and relabels the button and KPI', () => {
    open();
    pick(en.volRange28);
    expect(document.querySelector('.range-sheet')).toBeNull();
    expect(rangeBtn().textContent).toBe(en.volRange28);
    expect(document.querySelector('.pv-hero .kpi .lab')?.textContent).toBe(en.volRange28);
    const ws = __getStateForTests().workouts.filter(
      (w) => w.startedAt >= NOW - 28 * DAY && w.startedAt < NOW + 1,
    );
    expect(kpi()).toBe(tonnes(sumKg(ws)));
    // Sep 26 minus 28 days = Aug 29 -> weeks of Aug 24 ... Sep 21
    expect(bars()).toBe(5);
    expect(document.querySelector('.pv-hero .bars .bar:last-child')).not.toBeNull();
  });

  it('3 months uses weekly buckets, 1 year switches to monthly buckets', () => {
    open();
    pick(en.rangeM3);
    expect(rangeBtn().textContent).toBe(en.rangeM3);
    expect(bars()).toBe(14);
    pick(en.rangeY1);
    expect(rangeBtn().textContent).toBe(en.rangeY1);
    expect(bars()).toBe(13);
  });

  it('all time starts at the first workout and has no delta tag', () => {
    open();
    pick(en.rangeAll);
    const all = sumKg(__getStateForTests().workouts);
    expect(kpi()).toBe(tonnes(all));
    expect(document.querySelector('.pv-hero .kpi .uitag')).toBeNull();
    expect(bars()).toBe(10);
  });

  it('custom span: label shows the dates, KPI sums only that window and the sheet seeds from it', () => {
    open();
    fireEvent.click(rangeBtn());
    const sheet = document.querySelector('.range-sheet') as HTMLElement;
    const [from, to] = [...sheet.querySelectorAll('input')] as HTMLInputElement[];
    expect(to.value).toBe('26.09.2026');
    expect(from.value).toBe('30.08.2026');
    fireEvent.change(from, { target: { value: '01.09.2026' } });
    fireEvent.change(to, { target: { value: '15.09.2026' } });
    fireEvent.click(within(sheet).getByText(en.rangeApply));
    const a = new Date(2026, 8, 1).getTime();
    const b = new Date(2026, 8, 16).getTime();
    expect(rangeBtn().textContent).toBe(
      `${fmtDayMonth(a, 'en')} – ${fmtDayMonth(new Date(2026, 8, 15).getTime(), 'en')}`,
    );
    const ws = __getStateForTests().workouts.filter((w) => w.startedAt >= a && w.startedAt < b);
    expect(ws.length).toBe(6);
    expect(kpi()).toBe(tonnes(sumKg(ws)));
    expect(bars()).toBe(3);
    // reopening shows Custom as the applied range
    fireEvent.click(rangeBtn());
    expect(document.querySelector('.range-sheet .uibtn.on')?.textContent).toBe(en.rangeApply);
  });

  it('custom span given backwards (to before from) is normalised to the same window', () => {
    open();
    fireEvent.click(rangeBtn());
    const sheet = document.querySelector('.range-sheet') as HTMLElement;
    const [from, to] = [...sheet.querySelectorAll('input')] as HTMLInputElement[];
    fireEvent.change(from, { target: { value: '15.09.2026' } });
    fireEvent.change(to, { target: { value: '01.09.2026' } });
    fireEvent.click(within(sheet).getByText(en.rangeApply));
    const a = new Date(2026, 8, 1).getTime();
    const b = new Date(2026, 8, 16).getTime();
    const ws = __getStateForTests().workouts.filter((w) => w.startedAt >= a && w.startedAt < b);
    expect(kpi()).toBe(tonnes(sumKg(ws)));
  });

  it('a negative delta renders a minus sign and the neutral tag', () => {
    const base = richState();
    // last week twice as heavy as this week
    const mon = new Date(2026, 8, 21).getTime();
    const ws = base.workouts.map((w) =>
      w.startedAt >= mon - 7 * DAY && w.startedAt < mon
        ? {
            ...w,
            exercises: w.exercises.map((e) => ({
              ...e,
              sets: e.sets.map((s) => ({ ...s, weight: s.weight === null ? null : s.weight * 3 })),
            })),
          }
        : w,
    );
    open('total', { ...base, workouts: ws });
    expect(document.querySelector('.pv-hero .kpi .uitag')?.textContent?.startsWith('−')).toBe(true);
  });

  it('segment buttons report the chosen tab', () => {
    const { onSeg } = open();
    fireEvent.click(screen.getByRole('button', { name: en.records }));
    fireEvent.click(screen.getByRole('button', { name: en.byMuscle }));
    fireEvent.click(screen.getByRole('button', { name: en.volumeTab }));
    expect(onSeg.mock.calls.map((c) => c[0])).toEqual(['records', 'muscle', 'volume']);
  });

  it('1RM chart plots the two most trained lifts with their latest estimate in the legend', () => {
    open();
    const legend = [...document.querySelectorAll('.chart-legend > span')].map(
      (s) => s.textContent ?? '',
    );
    expect(legend).toHaveLength(2);
    expect(legend[0]).toMatch(/Bench Press.* \d+(\.\d+)? kg$/);
    expect(legend[1]).toMatch(/ \d+(\.\d+)? kg$/);
    expect(legend[1]).not.toBe(legend[0]);
    const lines = document.querySelectorAll('.chart-card polyline');
    expect(lines).toHaveLength(2);
    expect((lines[0].getAttribute('points') ?? '').split(' ')).toHaveLength(10);
    expect(lines[1].getAttribute('stroke-dasharray')).toBe('3 4');
  });

  it('1RM chart is omitted when no lift has two points in the period', () => {
    open();
    pick(en.volRange28);
    // still plenty of sessions in 4 weeks -> chart stays
    expect(document.querySelector('.chart-card')).not.toBeNull();
    cleanup();
    const base = richState();
    const only = base.workouts.slice(-3);
    open('total', { ...base, workouts: only });
    expect(document.querySelector('.chart-card')).toBeNull();
  });
});
