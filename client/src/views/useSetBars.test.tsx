import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { muscleReadiness } from '../recovery';
import { TANK_PARAMS } from '../setTank';
import type { Exercise, SetEntry, Workout } from '../types';
import { useSetBars } from './useSetBars';

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

describe('SessionView wiring', () => {
  it('reads the bars from useSetBars and no longer from setStimuli', () => {
    const src = readFileSync(join(__dirname, 'SessionView.tsx'), 'utf8');
    expect(src).toContain('useSetBars(workout, live, store.workouts)');
    expect(src).not.toContain('setStimuli');
    expect(src).not.toContain('rowMeters');
  });
});
