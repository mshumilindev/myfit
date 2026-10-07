import { describe, expect, it } from 'vitest';
import { bootstrapCI, cyclePatterns, observedCycles } from './cyclePatterns';
import { timestampOfDay } from '../components/ui/calendarDays';
import type { CycleSettings } from './cycleCore';
import type { Workout } from '../types';

const s: CycleSettings = { mode: 'regular', length: 28, period: 5, anchor: 1000 };
const wk = (day: number, rpe: number): Workout => ({
  id: `w${day}`,
  startedAt: timestampOfDay(day) + 3_600_000,
  finishedAt: timestampOfDay(day) + 7_200_000,
  autoFinished: false,
  exercises: [
    {
      id: 'e',
      name: 'Squat',
      position: 0,
      sets: [1, 2].map((i) => ({
        id: `s${day}${i}`,
        reps: 5,
        weight: 100,
        isWarmup: false,
        rpe,
        position: i,
      })),
    },
  ],
});

describe('observedCycles', () => {
  it('interpolates between two entered starts, skips implausible gaps', () => {
    expect(observedCycles([1000, 1056], s).map((c) => c.length)).toEqual([28, 28]);
    expect(observedCycles([1000, 1005], s)).toEqual([]);
    expect(observedCycles([1000, 1028, 1057], s)).toHaveLength(2);
  });
});

describe('cyclePatterns', () => {
  const starts = [1000, 1028, 1056, 1084, 1112];
  it('needs at least 3 cycles of data', () => {
    expect(cyclePatterns([1000, 1028], s, []).enough).toBe(false);
  });
  it('finds a consistent effect: RPE +1 in the late phase', () => {
    const ws: Workout[] = [];
    for (let c = 0; c < 4; c++) {
      const a = starts[c];
      ws.push(wk(a + 1, 7), wk(a + 2, 7), wk(a + 8, 7), wk(a + 9, 7), wk(a + 22, 8), wk(a + 23, 8));
    }
    const r = cyclePatterns(starts, s, ws);
    const late = r.phases.find((p) => p.phase === 'late')!;
    expect(late.diff).toBeGreaterThan(0.4);
    expect(late.distinct).toBe(true);
  });
  it('noise is not called a pattern', () => {
    const ws: Workout[] = [];
    const noise = [0.4, -0.3, 0.2, -0.5];
    for (let c = 0; c < 4; c++) {
      const a = starts[c];
      ws.push(
        wk(a + 1, 7),
        wk(a + 2, 7),
        wk(a + 8, 7),
        wk(a + 9, 7),
        wk(a + 22, 7 + noise[c]),
        wk(a + 23, 7 + noise[c]),
      );
    }
    const late = cyclePatterns(starts, s, ws).phases.find((p) => p.phase === 'late')!;
    expect(late.distinct).toBe(false);
  });
  it('ignores unrated and warm-up sets', () => {
    const w = wk(1001, 9);
    w.exercises[0].sets.forEach((x) => (x.isWarmup = true));
    expect(cyclePatterns(starts, s, [w]).enough).toBe(false);
  });
  it('bootstrap is deterministic', () => {
    expect(bootstrapCI([0.5, 0.7, 0.4])).toEqual(bootstrapCI([0.5, 0.7, 0.4]));
  });
});
