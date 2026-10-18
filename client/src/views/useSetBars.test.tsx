import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { muscleReadiness } from '../recovery';
import { TANK_PARAMS } from '../setTank';
import type { Exercise, SetEntry, Workout } from '../types';
import { useSetBars } from './useSetBars';

vi.mock('../recovery', async (orig) => {
  const actual = await orig<typeof import('../recovery')>();
  return { ...actual, muscleReadiness: vi.fn(actual.muscleReadiness) };
});

const DAY = 86400000;
const NOW = 1_800_000_000_000;

const set = (id: string, at: number, o: Partial<SetEntry> = {}): SetEntry => ({
  id,
  reps: 8,
  weight: 60,
  isWarmup: false,
  type: 'working',
  position: Number(id.replace(/\D/g, '')) || 0,
  loggedAt: at,
  ...o,
});
const bench = (sets: SetEntry[], id = 'ex1'): Exercise => ({
  id,
  name: 'Bench Press',
  kind: 'strength',
  position: 0,
  sets,
});
const wk = (id: string, startedAt: number, finished: boolean, exercises: Exercise[]): Workout => ({
  id,
  startedAt,
  finishedAt: finished ? startedAt + 3600000 : null,
  autoFinished: false,
  exercises,
});

/** Example A of the spec on a fresh muscle: warm-ups then 5x150 RPE 6, rests 90 s. */
function exampleA(start: number): Exercise {
  const gap = (rest: number, reps: number) => (rest + Math.max(30, reps * 3)) * 1000;
  let at = start;
  const rows: [number, number, Partial<SetEntry>, number][] = [
    [8, 60, { type: 'warmup', isWarmup: true }, 0],
    [8, 100, { type: 'warmup', isWarmup: true }, 90],
    [8, 130, { type: 'warmup', isWarmup: true }, 90],
    [5, 150, { rpe: 6 }, 90],
  ];
  return bench(
    rows.map(([reps, weight, o, rest], i) => {
      at = i === 0 ? start : at + gap(rest, reps);
      return set(`s${i + 1}`, at, { reps, weight, ...o });
    }),
  );
}

// An earlier finished session with the lift's own best set (5x150 at RPE 6 -> e1RM 195).
const history = (): Workout =>
  wk('h1', NOW - 20 * DAY, true, [
    bench([set('h11', NOW - 20 * DAY, { reps: 5, weight: 150, rpe: 6 })], 'hx'),
  ]);

describe('useSetBars (adapter)', () => {
  afterEach(() => vi.useRealTimers());

  it('shows bars only for a live workout; finished / past views get none', () => {
    const w = wk('w', NOW, false, [exampleA(NOW + 1000)]);
    const live = renderHook(() => useSetBars(w, true, [history(), w])).result.current;
    expect(live.size).toBe(4);
    const past = renderHook(() => useSetBars(w, false, [history(), w])).result.current;
    expect(past.size).toBe(0);
    const done = { ...w, finishedAt: NOW + 7200000 };
    expect(renderHook(() => useSetBars(done, false, [history(), done])).result.current.size).toBe(
      0,
    );
    expect(renderHook(() => useSetBars(undefined, true, [])).result.current.size).toBe(0);
  });

  it('example A from the lift own history: e1RM 195 -> tanks of the spec', () => {
    const w = wk('w', NOW, false, [exampleA(NOW + 1000)]);
    const r = renderHook(() => useSetBars(w, true, [history(), w])).result.current;
    const tanks = ['s1', 's2', 's3', 's4'].map((id) => r.get(id)!.tank);
    [0.982, 0.9219, 0.7793, 0.6795].forEach((v, i) => expect(tanks[i]).toBeCloseTo(v, 3));
    ['s1', 's2', 's3', 's4'].forEach((id, i, a) => {
      if (i) expect(r.get(id)!.barHeight).toBeLessThan(r.get(a[i - 1])!.barHeight);
    });
  });

  it('readiness at the workout start (base, no boost) sets the starting tank', () => {
    const yesterday = wk('y', NOW - DAY, true, [
      bench(
        Array.from({ length: 12 }, (_, i) => set(`y${i + 1}`, NOW - DAY + i * 1000)),
        'yx',
      ),
    ]);
    const w = wk('w', NOW, false, [exampleA(NOW + 1000)]);
    const ready = muscleReadiness([yesterday], NOW, 0).get('chest')!.readiness;
    expect(ready).toBeLessThan(0.5);
    const r = renderHook(() => useSetBars(w, true, [yesterday, history(), w])).result.current;
    expect(r.get('s1')!.before).toBeCloseTo(1 - TANK_PARAMS.readinessWeight * (1 - ready), 9);
    expect(r.get('s1')!.before).toBeLessThan(1);
  });

  it('a session that started later, or is unfinished, is not history', () => {
    const w = wk('w', NOW, false, [exampleA(NOW + 1000)]);
    const later = wk('l', NOW + DAY, true, [
      bench([set('l1', NOW + DAY, { reps: 3, weight: 300 })], 'lx'),
    ]);
    const other = wk('o', NOW - DAY, false, [bench([set('o1', NOW - DAY)], 'ox')]);
    const a = renderHook(() => useSetBars(w, true, [history(), w])).result.current;
    const b = renderHook(() => useSetBars(w, true, [history(), later, other, w])).result.current;
    expect([...b]).toEqual([...a]);
  });

  it('does not depend on the wall clock', () => {
    const w = wk('w', NOW, false, [exampleA(NOW + 1000)]);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-17T10:00:00Z'));
    const a = renderHook(() => useSetBars(w, true, [history(), w])).result.current;
    vi.setSystemTime(new Date('2027-03-01T10:00:00Z'));
    const b = renderHook(() => useSetBars(w, true, [history(), w])).result.current;
    expect([...b]).toEqual([...a]);
  });

  it('cardio and marker exercises get no bars', () => {
    const w = wk('w', NOW, false, [
      {
        id: 'c',
        name: 'Treadmill',
        kind: 'cardio',
        position: 0,
        sets: [set('c1', NOW + 1000, { reps: 1 })],
      },
      { id: 'm', name: 'Warm-up', kind: 'warmup', position: 1, sets: [] },
    ]);
    expect(renderHook(() => useSetBars(w, true, [w])).result.current.size).toBe(0);
  });
});

describe('useSetBars (history caching)', () => {
  const lift = (wid: string, name: string, k: number, at: number, n: number): Exercise => ({
    id: `${wid}-${k}`,
    name,
    kind: 'strength',
    position: k,
    sets: Array.from({ length: n }, (_, i) =>
      set(`${wid}-${k}-${i}`, at + i * 150000, { weight: 60 + (i % 3) * 10, rpe: 7 }),
    ),
  });
  const past = (d: number) => {
    const s = NOW - d * DAY;
    return wk(`h${d}`, s, true, [
      lift(`h${d}`, 'Bench Press', 0, s, 4),
      lift(`h${d}`, 'Squat', 1, s, 3),
    ]);
  };
  const hist = [1, 2, 3, 5, 8].map(past);
  const live = (benchSets: number) =>
    wk('live', NOW, false, [
      lift('live', 'Bench Press', 0, NOW + 1000, benchSets),
      lift('live', 'Squat', 1, NOW + 1000, 3),
    ]);
  const calls = () => vi.mocked(muscleReadiness).mock.calls.length;

  it('output is identical to the pre-optimisation implementation (golden values)', () => {
    const w = live(5);
    const r = renderHook(() => useSetBars(w, true, [w, ...hist])).result.current;
    // [setId, tank, before, barHeight] captured from the implementation before caching.
    const golden: [string, number, number, number][] = [
      ['live-0-0', 0.6491991813078737, 0.8928571428571428, 0.4077155930702495],
      ['live-1-0', 0.6318872031396638, 0.8690476190476191, 0.3932770015399646],
      ['live-0-1', 0.5716897322209776, 0.7862567846793376, 0.3455458245384767],
      ['live-1-1', 0.556444672695085, 0.7652899370878887, 0.33400050502653156],
      ['live-0-2', 0.5283480738653048, 0.726648100071671, 0.3132308057762818],
      ['live-1-2', 0.5142587918955634, 0.7072708174030933, 0.303048632898653],
      ['live-0-3', 0.4934350054314514, 0.6786314305690593, 0.2882662052645325],
      ['live-0-4', 0.46184048831517355, 0.6351788337472943, 0.2664064397196316],
    ];
    expect(r.size).toBe(golden.length);
    for (const [id, tank, before, barHeight] of golden) {
      expect(r.get(id)!.tank).toBeCloseTo(tank, 12);
      expect(r.get(id)!.before).toBeCloseTo(before, 12);
      expect(r.get(id)!.barHeight).toBeCloseTo(barHeight, 12);
    }
  });

  it('logging another set adds its bar without re-deriving the history', () => {
    const w4 = live(4);
    const { result, rerender } = renderHook(({ w }) => useSetBars(w, true, [w, ...hist]), {
      initialProps: { w: w4 },
    });
    const sizeBefore = result.current.size;
    const callsBefore = calls();
    expect(callsBefore).toBeGreaterThan(0);
    const w5 = live(5);
    rerender({ w: w5 });
    expect(result.current.size).toBe(sizeBefore + 1);
    expect(result.current.has('live-0-4')).toBe(true);
    expect(calls()).toBe(callsBefore);
    // and the earlier bars are untouched by the new set
    const again = renderHook(() => useSetBars(w5, true, [w5, ...hist])).result.current;
    expect(result.current.get('live-0-3')!.tank).toBe(again.get('live-0-3')!.tank);
  });

  it('a change in finished history (new or edited workout) is recomputed', () => {
    const w = live(4);
    const { result, rerender } = renderHook(({ all }) => useSetBars(w, true, all), {
      initialProps: { all: [w, ...hist] },
    });
    const c0 = calls();
    const first = result.current.get('live-0-0')!.before;
    rerender({ all: [w, ...hist, past(0.5)] });
    expect(calls()).toBeGreaterThan(c0);
    expect(result.current.get('live-0-0')!.before).not.toBe(first);
    const c1 = calls();
    const edited = { ...hist[0], exercises: [lift('h1', 'Bench Press', 0, NOW - DAY, 12)] };
    rerender({ all: [w, edited, ...hist.slice(1), past(0.5)] });
    expect(calls()).toBeGreaterThan(c1);
  });
});

describe('SessionView wiring', () => {
  it('reads the bars from useSetBars and no longer from setStimuli', () => {
    const src = readFileSync(join(__dirname, 'SessionView.tsx'), 'utf8');
    expect(src).toContain('useSetBars(workout, live, store.workouts)');
    expect(src).not.toContain('setStimuli');
    expect(src).not.toContain('rowMeters');
  });
});
