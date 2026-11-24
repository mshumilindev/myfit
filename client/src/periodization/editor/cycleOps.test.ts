import { describe, expect, it } from 'vitest';
import type { ProgramItemDoc } from '../../tools/programEditor';
import {
  copyWeek,
  cutWeeksWithRows,
  disableCycle,
  enableCycle,
  labelOfWeek,
  mergeWeek,
  resizeCycle,
  setWeekLabel,
  weekOf,
  weekView,
  type CycleDoc,
} from './cycleOps';

const row = (id: string, day: number, name = 'Back Squat'): ProgramItemDoc => ({
  id,
  day,
  position: 0,
  name,
  kind: 'strength',
  sets: 3,
  reps: 5,
  durationMin: null,
  equipment: [],
});
const base = (): CycleDoc =>
  ({
    items: [row('a', 1), row('b', 3)],
    dayNames: { '1': 'Squat' },
    targetMuscles: {},
    activities: [],
  }) as unknown as CycleDoc;

describe('switching a cycle on and off', () => {
  it('on: every other week starts as a copy of week 1, with fresh row ids', () => {
    const d = enableCycle(base(), 4);
    expect(d.cycle?.length).toBe(4);
    expect(d.cycle?.weeks).toHaveLength(3);
    expect(d.cycle?.weeks[0]?.items).toHaveLength(2);
    expect(d.cycle?.weeks[0]?.items[0]?.id).not.toBe('a');
    expect(d.cycle?.weeks[0]?.dayNames).toEqual({ '1': 'Squat' });
    expect(d.items).toHaveLength(2); // week 1 is untouched
  });
  it('on: the length is kept within 2..12', () => {
    expect(enableCycle(base(), 1).cycle?.length).toBe(2);
    expect(enableCycle(base(), 99).cycle?.length).toBe(12);
  });
  it('off: only week 1 stays', () => {
    const d = disableCycle(enableCycle(base()));
    expect(d).not.toHaveProperty('cycle');
    expect(d.items).toHaveLength(2);
  });
});

describe('the view of one week and putting an edit back', () => {
  it('week 1 is the document itself, a later week shows its own days', () => {
    let d = enableCycle(base(), 3);
    d = mergeWeek(d, 2, { ...weekView(d, 2), items: [row('x', 2)] } as CycleDoc);
    expect(weekView(d, 1)).toBe(d);
    expect(weekView(d, 2).items.map((i) => i.id)).toEqual(['x']);
    expect(weekView(d, 3).items).toHaveLength(2);
  });
  it('an edit of week 2 leaves week 1 and week 3 alone', () => {
    const d = enableCycle(base(), 3);
    const e = mergeWeek(d, 2, { ...weekView(d, 2), items: [] } as CycleDoc);
    expect(e.items).toHaveLength(2);
    expect(weekOf(e, 2).items).toHaveLength(0);
    expect(weekOf(e, 3).items).toHaveLength(2);
  });
  it('an edit of week 1 keeps the cycle', () => {
    const d = enableCycle(base(), 3);
    const e = mergeWeek(d, 1, { ...d, items: [row('z', 5)] } as CycleDoc);
    expect(e.items.map((i) => i.id)).toEqual(['z']);
    expect(e.cycle).toBe(d.cycle);
  });
  it('activities are the same every week: an edit made in week 2 reaches the document', () => {
    const d = enableCycle(base(), 2);
    const act = { id: 'r', day: 2, type: 'running', minutes: 20, effort: 'light', when: 'any' };
    const e = mergeWeek(d, 2, { ...weekView(d, 2), activities: [act] } as unknown as CycleDoc);
    expect(e.activities).toEqual([act]);
  });
});

describe('resizing', () => {
  it('growing adds copies of week 1 at the end, keeping the weeks already edited', () => {
    let d = enableCycle(base(), 3);
    d = mergeWeek(d, 2, { ...weekView(d, 2), items: [] } as CycleDoc);
    const g = resizeCycle(d, 5);
    expect(g.cycle?.length).toBe(5);
    expect(weekOf(g, 2).items).toHaveLength(0);
    expect(weekOf(g, 5).items).toHaveLength(2);
  });
  it('shrinking cuts from the end and says which weeks with rows would go', () => {
    const d = enableCycle(base(), 5);
    expect(cutWeeksWithRows(d, 3)).toEqual([4, 5]);
    expect(resizeCycle(d, 3).cycle?.weeks).toHaveLength(2);
    expect(cutWeeksWithRows(d, 5)).toEqual([]);
  });
});

describe('hints and copying a week', () => {
  it('sets and clears the hint of any week, week 1 included', () => {
    let d = enableCycle(base(), 4);
    d = setWeekLabel(d, 4, 'deload');
    d = setWeekLabel(d, 1, 'peak');
    expect(labelOfWeek(d, 4)).toBe('deload');
    expect(labelOfWeek(d, 1)).toBe('peak');
    d = setWeekLabel(d, 4, undefined);
    expect(labelOfWeek(d, 4)).toBeUndefined();
  });
  it('copying a week replaces the days of the target and keeps its hint', () => {
    let d = enableCycle(base(), 3);
    d = setWeekLabel(d, 3, 'deload');
    d = mergeWeek(d, 2, { ...weekView(d, 2), items: [row('only', 4)] } as CycleDoc);
    const c = copyWeek(d, 2, 3);
    expect(weekOf(c, 3).items.map((i) => i.day)).toEqual([4]);
    expect(weekOf(c, 3).items[0]?.id).not.toBe('only');
    expect(labelOfWeek(c, 3)).toBe('deload');
  });
  it('copying onto week 1 changes the document’s own days', () => {
    let d = enableCycle(base(), 2);
    d = mergeWeek(d, 2, { ...weekView(d, 2), items: [row('w2', 6)] } as CycleDoc);
    expect(copyWeek(d, 2, 1).items.map((i) => i.day)).toEqual([6]);
  });
  it('ignores impossible copies', () => {
    const d = enableCycle(base(), 2);
    expect(copyWeek(d, 1, 1)).toBe(d);
    expect(copyWeek(d, 1, 9)).toBe(d);
    expect(copyWeek(base(), 1, 2)).toEqual(base());
  });
});
