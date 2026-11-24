import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addonsPref } from '../addons/enabledSet';
import './periodizationBoot';
import {
  duplicateOf,
  freshProgram,
  normalizeProgram,
  toSaved,
  type Program,
  type ProgramItem,
} from '../views/programs/model';
import { cloneItems, sanitizeCycle, sanitizePct } from './cycleData';

// The module is installed and its chunk loaded (the boot import above): the core seams ask the chunk.
beforeEach(() => addonsPref.set(['periodization']));
afterEach(() => addonsPref.reset());

const row = (day: number, extra: Partial<ProgramItem> = {}): ProgramItem => ({
  id: `r${day}`,
  day,
  position: 0,
  name: 'Back Squat',
  kind: 'strength',
  sets: 3,
  reps: 5,
  durationMin: null,
  equipment: [],
  ...extra,
});

const base = (extra: Partial<Program> = {}): Program => ({
  ...freshProgram('5/3/1'),
  authorId: 'u',
  dayNames: { '1': 'Squat' },
  items: [row(1)],
  ...extra,
});

describe('sanitizePct', () => {
  it('keeps whole numbers 1–110 and drops anything else', () => {
    expect(sanitizePct(85)).toBe(85);
    expect(sanitizePct(85.4)).toBe(85);
    expect(sanitizePct(500)).toBe(110);
    expect(sanitizePct(0)).toBeUndefined();
    expect(sanitizePct(-5)).toBeUndefined();
    expect(sanitizePct('85')).toBeUndefined();
    expect(sanitizePct(Number.NaN)).toBeUndefined();
  });
});

describe('a program without a cycle is saved exactly as before', () => {
  it('adds no cycle, percent or range keys', () => {
    const saved = toSaved(base(), 'u', 'x');
    expect(saved).not.toHaveProperty('cycle');
    expect(saved.items[0]).not.toHaveProperty('targetPct');
    expect(saved.items[0]).not.toHaveProperty('repsMin');
  });
  it('keeps a weight in kilograms as it was', () => {
    const saved = toSaved(base({ items: [row(1, { targetWeight: 100 })] }), 'u', 'x');
    expect(saved.items[0]?.targetWeight).toBe(100);
  });
});

describe('percent and rep range on a row', () => {
  it('are kept when valid', () => {
    const saved = toSaved(
      base({ items: [row(1, { targetPct: 85, reps: 8, repsMin: 6 })] }),
      'u',
      'x',
    );
    expect(saved.items[0]).toMatchObject({ targetPct: 85, reps: 8, repsMin: 6 });
  });
  it('drop a range whose lower end is not below the upper end, and a bad percent', () => {
    const saved = toSaved(
      base({ items: [row(1, { targetPct: -3, reps: 5, repsMin: 5 })] }),
      'u',
      'x',
    );
    expect(saved.items[0]).not.toHaveProperty('repsMin');
    expect(saved.items[0]).not.toHaveProperty('targetPct');
  });
});

describe('sanitizeCycle', () => {
  const b = { items: [row(1)], dayNames: { '1': 'Squat' }, targetMuscles: {} };
  it('is no cycle for junk or fewer than two weeks', () => {
    for (const raw of [undefined, null, 'x', 5, {}, { length: 1 }, { length: 'a' }, { length: 0 }])
      expect(sanitizeCycle(raw, b)).toBeUndefined();
  });
  it('limits the length to 12 and gives every other week a copy of the base when missing', () => {
    const c = sanitizeCycle({ length: 99, weeks: [] }, b);
    expect(c?.length).toBe(12);
    expect(c?.weeks).toHaveLength(11);
    expect(c?.weeks[0]?.items).toHaveLength(1);
    expect(c?.weeks[0]?.items[0]?.id).not.toBe('r1');
    expect(c?.weeks[0]?.dayNames).toEqual({ '1': 'Squat' });
  });
  it('trims surplus weeks and keeps only known labels', () => {
    const c = sanitizeCycle(
      {
        length: 2,
        baseLabel: 'peak',
        weeks: [
          { label: 'deload', items: [row(2)] },
          { label: 'deload', items: [] },
        ],
      },
      b,
    );
    expect(c?.weeks).toHaveLength(1);
    expect(c?.baseLabel).toBe('peak');
    expect(c?.weeks[0]?.label).toBe('deload');
    expect(
      sanitizeCycle({ length: 2, baseLabel: 'wild', weeks: [{ label: 'wild', items: [] }] }, b),
    ).toEqual({ length: 2, weeks: [{ items: [], dayNames: {}, targetMuscles: {} }] });
  });
  it('cleans each week like the base week (names trimmed, muscles only on rows-free days)', () => {
    const c = sanitizeCycle(
      {
        length: 2,
        weeks: [
          {
            items: [row(1, { name: '  Bench  ' })],
            dayNames: { '1': '  Push  ', '2': '' },
            targetMuscles: { '1': ['chest'], '2': ['back'] },
          },
        ],
      },
      b,
    );
    const w = c?.weeks[0];
    expect(w?.items[0]?.name).toBe('Bench');
    expect(w?.dayNames).toEqual({ '1': 'Push' });
    expect(w?.targetMuscles).toEqual({ '2': ['back'] });
  });
});

describe('toSaved / normalizeProgram keep the cycle', () => {
  const withCycle = () =>
    base({
      cycle: {
        length: 3,
        baseLabel: 'peak',
        weeks: [
          { dayNames: {}, targetMuscles: {}, items: [row(1, { targetPct: 70 })] },
          { label: 'deload', dayNames: {}, targetMuscles: {}, items: [row(1, { targetPct: 60 })] },
        ],
      },
    });
  it('round-trips through toSaved', () => {
    const saved = toSaved(withCycle(), 'u', 'x');
    expect(saved.cycle?.length).toBe(3);
    expect(saved.cycle?.weeks[1]?.label).toBe('deload');
    expect(saved.cycle?.weeks[0]?.items[0]?.targetPct).toBe(70);
  });
  it('survives normalizeProgram with row order fixed', () => {
    const p = normalizeProgram(withCycle());
    expect(p.cycle?.weeks).toHaveLength(2);
    expect(p.cycle?.weeks[0]?.items[0]?.position).toBe(0);
  });
  it('normalizeProgram drops a malformed cycle but leaves the rest untouched', () => {
    const p = normalizeProgram({ ...base(), cycle: { length: 1, weeks: [] } });
    expect(p).not.toHaveProperty('cycle');
    expect(p.items).toHaveLength(1);
  });
  it('a stored cycle stays when read-modify-write goes through toSaved again', () => {
    const once = toSaved(withCycle(), 'u', 'x');
    const twice = toSaved(normalizeProgram(once), 'u', 'x');
    expect(twice.cycle).toEqual(once.cycle);
  });
});

describe('copies get fresh ids', () => {
  it('cloneItems renews item ids and keeps grouped rows grouped under a new id', () => {
    const src = [row(1, { groupId: 'g' }), row(2, { groupId: 'g', id: 'r2' })];
    const out = cloneItems(src);
    expect(out.map((i) => i.id)).not.toEqual(src.map((i) => i.id));
    expect(out[0]?.groupId).toBe(out[1]?.groupId);
    expect(out[0]?.groupId).not.toBe('g');
  });
  it('duplicateOf copies the cycle weeks with fresh ids', () => {
    const p = base({
      cycle: {
        length: 2,
        weeks: [{ dayNames: {}, targetMuscles: {}, items: [row(1, { id: 'w2' })] }],
      },
    });
    const d = duplicateOf(p, 'Copy');
    expect(d.cycle?.weeks[0]?.items[0]?.id).not.toBe('w2');
    expect(d.cycle?.length).toBe(2);
  });
});
