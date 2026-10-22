/** SPO-149 review follow-ups: the light-weight cut label, and a regain never above the pre-break cap. */
import { describe, expect, it } from 'vitest';
import { applyConditionEffects, nextTarget, type Target, type TopPoint } from './progression';

const day = (d: number): number => new Date(2026, 0, 1 + d, 9).getTime();
const NOW = day(400);
const ago = (daysAgo: number, weight: number, reps: number): TopPoint => ({
  ts: day(400 - daysAgo),
  weight,
  reps,
});

describe('cut on a light weight', () => {
  // R2 (x0.9): the 2.5 grid swallows the cut at 5/7.5/10/12.5 kg.
  it.each([
    [5, 5, 'ease'],
    [7.5, 7.5, 'ease'],
    [10, 10, 'ease'],
    [12.5, 12.5, 'ease'],
    [15, 12.5, 'cut'],
  ] as const)('%s kg after 6 weeks -> %s kg (%s)', (prev, weight, kind) => {
    const t = nextTarget([ago(42, prev, 10)], { plannedReps: 10, now: NOW });
    expect(t).toMatchObject({ state: 'return', returnKind: kind, weight, gapDays: 42 });
    expect(t.deltaKg).toBe(weight - prev);
    // "lighter" is only ever claimed when it is true
    expect(t.returnKind === 'cut').toBe(t.deltaKg < 0);
    expect(t.weight).toBeGreaterThan(0);
  });
  it('R5 (x0.7) still cuts 5 kg to 2.5', () => {
    const t = nextTarget([ago(400, 5, 10)], { plannedReps: 10, now: NOW });
    expect(t).toMatchObject({ returnKind: 'cut', weight: 2.5, deltaKg: -2.5 });
  });
});

describe('stepScale on a regain', () => {
  const regain = (weight: number, prevWeight: number): Target => ({
    state: 'return',
    returnKind: 'regain',
    weight,
    reps: 8,
    deltaKg: weight - prevWeight,
    repLow: 7,
    repHigh: 10,
    prevWeight,
    prevReps: 8,
  });
  it('never exceeds the pre-break cap when the step is under half a kilo', () => {
    const t = applyConditionEffects(regain(100.25, 100), { stepScale: 0.5 });
    expect(t.weight).toBeLessThanOrEqual(100.25);
    expect(t.deltaKg).toBeLessThanOrEqual(0.25);
  });
  it('a normal scaled step is unchanged', () => {
    const t = applyConditionEffects(regain(105, 100), { stepScale: 0.5 });
    expect(t).toMatchObject({ weight: 102.5, deltaKg: 2.5 });
  });
});
