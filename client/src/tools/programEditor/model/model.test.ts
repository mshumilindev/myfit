import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { demoCatalog, demoDoc } from '../stories/demoHost';
import {
  dayItems,
  dayMode,
  effectiveSets,
  emptyDoc,
  isBare,
  supersetLabels,
  trainingDays,
  type ProgramDoc,
} from './doc';
import { diffPrograms } from './diff';
import { canRedo, canUndo, emptyHistory, HISTORY_LIMIT, record, redo, undo } from './history';
import {
  addActivity,
  addBareExercise,
  addItem,
  copyDay,
  forWrite,
  importDay,
  moveItem,
  patchItem,
  removeItem,
  setIdGenerator,
  setRowMode,
  supersetWith,
  toggleMuscle,
  toMusclesMode,
  ungroup,
  type WithMemory,
} from './ops';
import { applyEdit } from './pipeline';

let n = 0;
beforeEach(() => {
  n = 0;
  setIdGenerator(() => `id-${++n}`);
});
afterEach(() => setIdGenerator());

const freeze = (d: ProgramDoc): ProgramDoc => JSON.parse(JSON.stringify(d)) as ProgramDoc;

describe('ProgramDoc', () => {
  it('is plain JSON: a round trip through JSON changes nothing', () => {
    const d = demoDoc();
    expect(freeze(d)).toEqual(d);
  });

  it("week order is the host's: a Sunday-first week lists Sunday-first", () => {
    const d = { ...demoDoc(), dayNames: { ...demoDoc().dayNames, '7': 'Long run' } };
    expect(trainingDays(d)).toEqual([1, 3, 5, 7]);
    expect(trainingDays(d, { weekOrder: [7, 1, 2, 3, 4, 5, 6] })).toEqual([7, 1, 3, 5]);
  });

  it('a day with items is an exercises day, any other is a muscles day', () => {
    const d = demoDoc();
    expect(dayMode(d, 1)).toBe('exercises');
    expect(dayMode(d, 5)).toBe('muscles');
  });
});

describe('ops are immutable', () => {
  it('no operation mutates its input', () => {
    const d = demoDoc();
    const before = freeze(d);
    const row = d.items[0];
    patchItem(d, row.id, { sets: 9 });
    removeItem(d, row.id);
    moveItem(d, row.id, 1);
    copyDay(d, 1, 2);
    toMusclesMode(d, 1, demoCatalog);
    toggleMuscle(d, 5, 'core');
    setRowMode(d, row.id, true);
    supersetWith(d, d.items[0].id, d.items[1].id);
    addActivity(d, { day: 4, type: 'run', minutes: 20, effort: 'light', when: 'any' });
    expect(d).toEqual(before);
  });

  it('a no-op returns the same reference (so history and onChange stay quiet)', () => {
    const d = demoDoc();
    expect(setRowMode(d, 'unknown', true)).toBe(d);
    expect(moveItem(d, dayItems(d, 1)[0].id, -1)).toBe(d);
    expect(copyDay(d, 1, 1)).toBe(d);
  });

  it('host-only fields on the document survive every operation', () => {
    const d = { ...demoDoc(), id: 'host-id', status: 'draft', sealed: { v: 1 } };
    const out = addItem(d, {
      day: 2,
      name: 'Leg Press',
      kind: 'strength',
      sets: 3,
      reps: 10,
      durationMin: null,
      equipment: [],
    });
    expect(out).toMatchObject({ id: 'host-id', status: 'draft', sealed: { v: 1 } });
  });
});

describe('rows', () => {
  it('a library exercise is added as just the exercise (sets 0, reps 0, bare), with its equipment', () => {
    const r = addBareExercise(demoDoc(), 1, 'Pull-Up', demoCatalog);
    const it = r.program.items.find((i) => i.id === r.id)!;
    expect([it.sets, it.reps, isBare(it), effectiveSets(it)]).toEqual([0, 0, true, 0]);
    expect(it.equipment).toEqual(['bodyweight']);
  });

  it('bare <-> targets restores the numbers, and the memory is never written', () => {
    const d = demoDoc();
    const row = d.items.find((i) => i.name === 'Barbell Bench Press')!;
    const bare = setRowMode(d, row.id, true);
    expect((bare.items.find((i) => i.id === row.id) as WithMemory).was).toMatchObject({
      sets: 4,
      reps: 6,
      kg: 80,
    });
    const back = setRowMode(bare, row.id, false).items.find((i) => i.id === row.id)!;
    expect([back.sets, back.reps, back.targetWeight]).toEqual([4, 6, 80]);
    expect(forWrite(bare).items.every((i) => !('was' in i))).toBe(true);
  });

  it('reorder moves a row inside its day and renumbers', () => {
    const d = demoDoc();
    const [a, b] = dayItems(d, 1);
    const moved = moveItem(d, a.id, 1);
    expect(
      dayItems(moved, 1)
        .map((i) => i.id)
        .slice(0, 2),
    ).toEqual([b.id, a.id]);
    expect(dayItems(moved, 1).map((i) => i.position)).toEqual([0, 1, 2, 3]);
  });

  it('a superset of one is no superset: removing a partner dissolves the group', () => {
    const d = demoDoc();
    const [a, b] = dayItems(d, 1);
    const grouped = supersetWith(d, a.id, b.id);
    expect([...supersetLabels(dayItems(grouped, 1)).values()]).toEqual(['A1', 'A2']);
    const rest = removeItem(grouped, b.id);
    expect(rest.items.find((i) => i.id === a.id)?.groupId).toBeNull();
    expect(ungroup(grouped, a.id).items.every((i) => !i.groupId)).toBe(true);
  });

  it('copy and import give every row a new id and keep supersets together', () => {
    const d = demoDoc();
    const [a, b] = dayItems(d, 1);
    const grouped = supersetWith(d, a.id, b.id);
    const copied = copyDay(grouped, 1, 2);
    const day2 = dayItems(copied, 2);
    expect(day2.length).toBe(dayItems(grouped, 1).length);
    expect(day2.every((i) => !grouped.items.some((x) => x.id === i.id))).toBe(true);
    expect(new Set(day2.filter((i) => i.groupId).map((i) => i.groupId)).size).toBe(1);
    const imported = importDay(emptyDoc('x'), 4, grouped, 1);
    expect(dayItems(imported, 4).length).toBe(day2.length);
  });

  it("switching to muscles keeps the day's muscles and drops its rows", () => {
    const m = toMusclesMode(demoDoc(), 1, demoCatalog);
    expect(dayItems(m, 1)).toEqual([]);
    expect(m.targetMuscles['1']?.length).toBeGreaterThan(0);
  });

  it('"Full body" switches every muscle on and off', () => {
    const on = toggleMuscle(emptyDoc(), 2, 'fullbody');
    expect(on.targetMuscles['2']).toContain('chest');
    expect(toggleMuscle(on, 2, 'fullbody').targetMuscles['2']).toBeUndefined();
  });
});

describe('diff', () => {
  it('names added, removed and changed rows', () => {
    const live = demoDoc();
    const row = live.items.find((i) => i.name === 'Leg Press')!;
    let draft = patchItem(live, row.id, { sets: 5 });
    draft = removeItem(draft, live.items.find((i) => i.name === 'Lateral Raise')!.id);
    draft = addBareExercise(draft, 1, 'Pull-Up', demoCatalog).program;
    expect(diffPrograms(live, draft)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: 'change', what: 'sets', name: 'Leg Press' }),
        expect.objectContaining({ op: 'remove', name: 'Lateral Raise' }),
        expect.objectContaining({ op: 'add', name: 'Pull-Up' }),
      ]),
    );
    expect(diffPrograms(live, live)).toEqual([]);
  });
});

describe('history', () => {
  it('undo and redo walk the same documents back and forth', () => {
    const a = demoDoc();
    const b = patchItem(a, a.items[0].id, { sets: 7 });
    const c = patchItem(b, b.items[0].id, { sets: 8 });
    let h = record(record(emptyHistory(), a, 'one'), b, 'two');
    expect([canUndo(h), canRedo(h)]).toEqual([true, false]);
    const u1 = undo(h, c)!;
    expect(u1.doc).toBe(b);
    const u2 = undo(u1.history, u1.doc)!;
    expect(u2.doc).toBe(a);
    expect(undo(u2.history, u2.doc)).toBeNull();
    const r1 = redo(u2.history, u2.doc)!;
    expect(r1.doc).toBe(b);
    expect(redo(redo(r1.history, r1.doc)!.history, c)).toBeNull();
    h = r1.history;
    expect(canRedo(h)).toBe(true);
  });

  it('a new edit ends the redo branch, and the past is capped', () => {
    const a = demoDoc();
    let h = record(emptyHistory(), a);
    const u = undo(h, a)!;
    expect(canRedo(u.history)).toBe(true);
    h = record(u.history, a);
    expect(canRedo(h)).toBe(false);
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) h = record(h, a);
    expect(h.past.length).toBe(HISTORY_LIMIT);
  });
});

describe('edit pipeline', () => {
  const bump = (d: ProgramDoc) => patchItem(d, d.items[0].id, { sets: 9 });

  it('runs the middleware in order on the candidate', () => {
    const calls: string[] = [];
    const out = applyEdit(demoDoc(), bump, [
      ({ next }) => (calls.push('a'), next),
      ({ next }) => (calls.push('b'), { ...next, name: 'renamed' }),
    ]);
    expect(calls).toEqual(['a', 'b']);
    expect(out.name).toBe('renamed');
  });

  it('a middleware that returns prev vetoes the edit', () => {
    const d = demoDoc();
    expect(applyEdit(d, bump, [({ prev }) => prev])).toBe(d);
  });

  it('middleware sees the previous document and the label', () => {
    const seen: unknown[] = [];
    const d = demoDoc();
    applyEdit(d, bump, [(ev) => (seen.push([ev.prev === d, ev.label]), ev.next)], 'bump');
    expect(seen).toEqual([[true, 'bump']]);
  });
});
