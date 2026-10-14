import { describe, expect, it } from 'vitest';
import { isBare, dayItems, effectiveSets } from '../../views/programs/model';
import {
  addBareExercise,
  diffPrograms,
  forWrite,
  importDay,
  setRowMode,
  type WithMemory,
} from './ops';
import { olehDraft } from './__fixtures__/fixtures';

describe('program ops', () => {
  it('a library exercise is added as just the exercise: sets 0, reps 0, bare', () => {
    const r = addBareExercise(olehDraft(), 2, 'Dumbbell Flyes');
    const it = r.program.items.find((i) => i.id === r.id)!;
    expect(it.sets).toBe(0);
    expect(it.reps).toBe(0);
    expect(isBare(it)).toBe(true);
    expect(effectiveSets(it)).toBe(0);
  });

  it('bare -> targets restores the numbers it had (undo memory), and the memory is never written', () => {
    const d = olehDraft();
    const row = d.items.find((i) => i.name === 'Leg Press')!;
    const bare = setRowMode(d, row.id, true);
    const b = bare.items.find((i) => i.id === row.id)! as WithMemory;
    expect(isBare(b)).toBe(true);
    expect(b.was).toMatchObject({ sets: row.sets, reps: row.reps, kg: row.targetWeight });
    const back = setRowMode(bare, row.id, false).items.find((i) => i.id === row.id)!;
    expect(back.sets).toBe(row.sets);
    expect(back.reps).toBe(row.reps);
    expect(isBare(back)).toBe(false);
    expect(forWrite(bare).items.every((i) => !('was' in i))).toBe(true);
  });

  it('diff: the draft against the live version', () => {
    const draft = olehDraft();
    const live = { ...draft, items: draft.items.filter((i) => i.name !== 'Paused bench press') };
    expect(diffPrograms(live, draft)).toEqual([
      expect.objectContaining({ op: 'add', name: 'Paused bench press' }),
    ]);
    expect(diffPrograms(draft, draft)).toEqual([]);
  });

  it('diff names a row that turned into "just the exercise"', () => {
    const d = olehDraft();
    const row = d.items.find((i) => i.name === 'Leg Press')!;
    const c = diffPrograms(d, setRowMode(d, row.id, true));
    expect(c).toEqual([expect.objectContaining({ op: 'change', what: 'bare', name: 'Leg Press' })]);
  });

  it('importing a day replaces the day with new ids', () => {
    const src = olehDraft();
    const dst = importDay(olehDraft(), 4, src, 2);
    const ids = new Set(src.items.filter((i) => i.day === 2).map((i) => i.id));
    expect(dayItems(dst, 4).length).toBeGreaterThan(0);
    expect(dayItems(dst, 4).every((i) => !ids.has(i.id))).toBe(true);
  });
});
