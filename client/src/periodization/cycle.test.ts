import { describe, expect, it } from 'vitest';
import {
  cycleNote,
  activeCycleWeek,
  activeWeekLabel,
  activeWeekPlan,
  cycleRepeats,
  cycleWeekOf,
  isDeloadWeek,
  loadKg,
  plannedDays,
  plannedThrough,
  pctToKg,
  repsLabel,
  weekPlanOf,
  type WeekSource,
} from './cycle';
import type { ProgramItem } from '../views/programs/model';

const item = (day: number, extra: Partial<ProgramItem> = {}): ProgramItem => ({
  id: `i${day}${Math.random()}`,
  day,
  position: 0,
  name: 'Barbell Bench Press',
  kind: 'strength',
  sets: 3,
  reps: 5,
  durationMin: null,
  equipment: [],
  ...extra,
});

/** A 4-week cycle: week 1 trains Mon+Wed, week 2 Mon only, week 3 Mon+Wed+Fri, week 4 (deload) Mon. */
const cycleProgram = (): WeekSource => ({
  items: [item(1), item(3)],
  dayNames: { '1': 'A', '3': 'B' },
  cycle: {
    length: 4,
    baseLabel: 'peak',
    weeks: [
      { dayNames: { '1': 'A' }, targetMuscles: {}, items: [item(1)] },
      { dayNames: {}, targetMuscles: {}, items: [item(1), item(3), item(5)] },
      { label: 'deload', dayNames: {}, targetMuscles: {}, items: [item(1)] },
    ],
  },
});

describe('cycleWeekOf / cycleRepeats', () => {
  it('wraps the program week onto the cycle', () => {
    expect([1, 2, 3, 4, 5, 6, 8, 9].map((w) => cycleWeekOf(w, 4))).toEqual([
      1, 2, 3, 4, 1, 2, 4, 1,
    ]);
  });
  it('treats a missing or too short cycle as week 1, and bad weeks as week 1', () => {
    expect(cycleWeekOf(7, 1)).toBe(1);
    expect(cycleWeekOf(7, 0)).toBe(1);
    expect(cycleWeekOf(0, 4)).toBe(1);
    expect(cycleWeekOf(Number.NaN, 4)).toBe(1);
  });
  it('counts whole repeats only; ongoing programs have none to count', () => {
    expect(cycleRepeats(12, 4)).toBe(3);
    expect(cycleRepeats(10, 4)).toBe(2);
    expect(cycleRepeats(0, 4)).toBe(0);
    expect(cycleRepeats(12, 1)).toBe(0);
  });
});

describe('weekPlanOf', () => {
  it('week 1 is the program itself, with its own hint', () => {
    const p = cycleProgram();
    const w = weekPlanOf(p, 1);
    expect(w.items).toBe(p.items);
    expect(w.label).toBe('peak');
  });
  it('later weeks come from the cycle; a missing week falls back to the base', () => {
    const p = cycleProgram();
    expect(weekPlanOf(p, 4).label).toBe('deload');
    expect(weekPlanOf(p, 3).items).toHaveLength(3);
    expect(weekPlanOf(p, 9).items).toBe(p.items);
  });
});

describe('the cycle rules', () => {
  it('picks the cycle week for each program week', () => {
    const p = cycleProgram();
    expect([1, 2, 3, 4, 5].map((w) => activeCycleWeek(p, w))).toEqual([1, 2, 3, 4, 1]);
    expect(activeWeekPlan(p, 3).items).toHaveLength(3);
  });
  it('a program without a cycle is the same every week', () => {
    const p: WeekSource = { items: [item(1)] };
    expect(activeCycleWeek(p, 9)).toBe(1);
    expect(activeWeekPlan(p, 9).items).toBe(p.items);
  });
  it('knows the hint and the deload week', () => {
    const p = cycleProgram();
    expect(activeWeekLabel(p, 1)).toBe('peak');
    expect(activeWeekLabel(p, 2)).toBeUndefined();
    expect(isDeloadWeek(p, 4)).toBe(true);
    expect(isDeloadWeek(p, 8)).toBe(true);
    expect(isDeloadWeek(p, 5)).toBe(false);
  });
  it('plans days by the real week of the cycle, not week × days', () => {
    const p = cycleProgram();
    expect([1, 2, 3, 4].map((w) => plannedDays(p, w))).toEqual([2, 1, 3, 1]);
    expect(plannedThrough(p, 4)).toBe(7);
    expect(plannedThrough(p, 5)).toBe(9);
    expect(plannedThrough(p, 0)).toBe(0);
  });
  it('turns a percent into kilograms rounded to the 2.5 step, never inventing a weight', () => {
    expect(pctToKg(85, 140)).toBe(120);
    expect(pctToKg(80, 100)).toBe(80);
    expect(pctToKg(67, 100)).toBe(67.5);
    expect(pctToKg(0, 100)).toBeNull();
    expect(pctToKg(80, 0)).toBeNull();
    expect(pctToKg(80, Number.NaN)).toBeNull();
    expect(loadKg({ targetPct: 85 }, 140)).toEqual({ kg: 120, pct: 85, needsMax: false });
    expect(loadKg({ targetPct: 85 }, null)).toEqual({ kg: null, pct: 85, needsMax: true });
    expect(loadKg({ targetWeight: 60 }, 140)).toEqual({ kg: 60, pct: null, needsMax: false });
    expect(loadKg({}, 140)).toEqual({ kg: null, pct: null, needsMax: false });
  });
  it('a percent wins over a weight in kilograms', () => {
    expect(loadKg({ targetWeight: 60, targetPct: 50 }, 140).kg).toBe(70);
  });
  it('shows a rep range only when the lower end is below the upper end', () => {
    expect(repsLabel({ reps: 8, repsMin: 6 })).toBe('6–8');
    expect(repsLabel({ reps: 8, repsMin: 8 })).toBe('8');
    expect(repsLabel({ reps: 8 })).toBe('8');
  });
});

describe('cycleNote', () => {
  const words = { cycleAt: 'Cycle week {n} of {len}', labels: { deload: 'Deload' } };
  const prog = {
    items: [],
    cycle: {
      length: 4,
      weeks: [
        { dayNames: {}, targetMuscles: {}, items: [] },
        { dayNames: {}, targetMuscles: {}, items: [] },
        { label: 'deload' as const, dayNames: {}, targetMuscles: {}, items: [] },
      ],
    },
  };
  it('names the place in the cycle and the week type', () => {
    expect(cycleNote(prog, 2, words)).toBe('Cycle week 2 of 4');
    expect(cycleNote(prog, 4, words)).toBe('Cycle week 4 of 4 · Deload');
    expect(cycleNote(prog, 5, words)).toBe('Cycle week 1 of 4');
  });
  it('is null without a cycle', () => {
    expect(cycleNote({ items: [] }, 3, words)).toBeNull();
  });
});
