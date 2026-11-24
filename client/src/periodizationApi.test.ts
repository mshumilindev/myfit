import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addonsPref } from './addons/enabledSet';
import {
  cloneCycleFor,
  loadFor,
  maxForExercise,
  periodizationHost,
  repsLabelFor,
  rowExtrasFor,
  sanitizeCycleFor,
  weekPlanFor,
  type WeekSource,
} from './periodizationApi';
import { normalizeProgram, toSaved, freshProgram, type ProgramItem } from './views/programs/model';

const row = (day: number, extra: Partial<ProgramItem> = {}): ProgramItem => ({
  id: `r${day}`,
  day,
  position: 0,
  name: 'Back Squat',
  kind: 'strength',
  sets: 3,
  reps: 8,
  durationMin: null,
  equipment: [],
  ...extra,
});
const prog = (): WeekSource => ({
  items: [row(1)],
  dayNames: { '1': 'A' },
  cycle: {
    length: 2,
    weeks: [{ label: 'deload', dayNames: {}, targetMuscles: {}, items: [row(3)] }],
  },
});

beforeEach(() => addonsPref.reset());
afterEach(() => {
  addonsPref.reset();
  for (const k of Object.keys(periodizationHost) as (keyof typeof periodizationHost)[])
    (periodizationHost as unknown as Record<string, unknown>)[k] = null;
});

/** What the lazy chunk would fill in; here a marker so the test can tell it was (not) asked. */
const fill = () => {
  periodizationHost.weekPlan = () => ({ dayNames: {}, targetMuscles: {}, items: [row(5)] });
  periodizationHost.load = () => ({ kg: 1, pct: 2, needsMax: false });
  periodizationHost.repsLabel = () => 'range';
  periodizationHost.maxFor = () => 123;
  periodizationHost.rowExtras = () => ({ targetPct: 77 });
  periodizationHost.sanitizeCycle = () => ({ length: 2, weeks: [] });
  periodizationHost.cloneCycle = (c) => ({ ...c, length: 99 });
};

describe('the core seam: module off (the default)', () => {
  it('never asks the chunk, even if it was loaded earlier in the session', () => {
    fill();
    const p = prog();
    expect(weekPlanFor(p, 2).items).toBe(p.items);
    expect(loadFor({ targetWeight: 60, targetPct: 80 }, 150)).toEqual({
      kg: 60,
      pct: null,
      needsMax: false,
    });
    expect(repsLabelFor({ reps: 8, repsMin: 6 })).toBe('8');
    expect(maxForExercise('Back Squat')).toBeNull();
  });
  it('passes stored cycle, percent and range through untouched (nothing is cleaned or dropped)', () => {
    fill();
    const raw = { length: 7, weeks: [], weird: true };
    expect(sanitizeCycleFor(raw, { items: [], dayNames: {}, targetMuscles: {} })).toBe(raw);
    expect(rowExtrasFor(row(1, { targetPct: 85, repsMin: 6 }))).toEqual({
      targetPct: 85,
      repsMin: 6,
    });
    const saved = toSaved(
      {
        ...freshProgram('x'),
        authorId: 'u',
        items: [row(1, { targetPct: 85, repsMin: 6 })],
        cycle: prog().cycle,
      },
      'u',
      'x',
    );
    expect(saved.items[0]).toMatchObject({ targetPct: 85, repsMin: 6 });
    expect(saved.cycle).toEqual(prog().cycle);
    expect(
      normalizeProgram({ ...freshProgram('x'), authorId: 'u', cycle: prog().cycle }).cycle,
    ).toEqual(prog().cycle);
  });
  it('a copy keeps the stored cycle as it is', () => {
    expect(cloneCycleFor(prog().cycle!)).toEqual(prog().cycle);
  });
});

describe('the core seam: module on but its chunk not loaded yet', () => {
  beforeEach(() => addonsPref.set(['periodization']));
  it('answers the neutral value', () => {
    const p = prog();
    expect(weekPlanFor(p, 2).items).toBe(p.items);
    expect(loadFor({ targetWeight: 60, targetPct: 80 }, 150).kg).toBe(60);
    expect(repsLabelFor({ reps: 8, repsMin: 6 })).toBe('8');
    expect(maxForExercise('Back Squat')).toBeNull();
  });
});

describe('the core seam: module on and loaded', () => {
  beforeEach(() => {
    addonsPref.set(['periodization']);
    fill();
  });
  it('asks the chunk for everything', () => {
    expect(weekPlanFor(prog(), 2).items[0]?.day).toBe(5);
    expect(loadFor({}, null)).toEqual({ kg: 1, pct: 2, needsMax: false });
    expect(repsLabelFor({ reps: 8 })).toBe('range');
    expect(maxForExercise('x')).toBe(123);
    expect(rowExtrasFor(row(1))).toEqual({ targetPct: 77 });
    expect(sanitizeCycleFor({}, { items: [], dayNames: {}, targetMuscles: {} })?.length).toBe(2);
    expect(cloneCycleFor(prog().cycle!).length).toBe(99);
  });
});
