/**
 * NO DATA LOSS (iter17), the coach editor. Every editing operation changes only what it says it changes: the other rows,
 * and every other field of the changed row, come out byte-for-byte the same. Property-style over the seeded programs
 * of `parity/programGen.ts` (every optional key of the model is set by some seed).
 */
import { describe, expect, it } from 'vitest';
import {
  addItem,
  copyDay,
  diffPrograms,
  forWrite,
  importDay,
  moveItem,
  patchItem,
  removeItem,
  setDayName,
  setRowMode,
  supersetWith,
  ungroup,
} from '../../tools/programEditor';
import { genProgram, seeds } from '../data/firestore/parity/programGen';
import type { Program, ProgramItem } from '../../views/programs/model';

const byId = (p: Program) => new Map(p.items.map((i) => [i.id, i]));
const strip = (i: ProgramItem): Record<string, unknown> => {
  const { position: _p, ...rest } = i;
  void _p;
  return rest;
};

describe('editor operations leave everything else alone', () => {
  it('patching one field of one row touches only that field of that row', () => {
    for (const seed of seeds) {
      const p = genProgram(seed);
      const target = p.items[seed % p.items.length];
      const out = patchItem(p, target.id, { reps: 77 });
      expect(out.items.find((i) => i.id === target.id)).toEqual({ ...target, reps: 77 });
      for (const i of p.items) if (i.id !== target.id) expect(byId(out).get(i.id)).toEqual(i);
      expect({ ...out, items: [] }).toEqual({ ...p, items: [] });
    }
  });

  it('move / superset / ungroup / add / remove keep every field of every surviving row', () => {
    for (const seed of seeds) {
      const p = genProgram(seed);
      const a = p.items[0];
      const same = p.items.find((i) => i.day === a.day && i.id !== a.id);
      const check = (out: Program, except: readonly string[] = []) => {
        for (const i of p.items) {
          if (except.includes(i.id)) continue;
          const o = byId(out).get(i.id);
          expect(o, `row ${i.id} survives`).toBeDefined();
          // identity fields never change; position / group labels are what these operations move
          const { position: _a, groupId: _g, groupOrder: _o, ...restSrc } = i;
          const { position: _b, groupId: _h, groupOrder: _q, ...restOut } = o!;
          void [_a, _g, _o, _b, _h, _q];
          expect(restOut).toEqual(restSrc);
        }
        expect(out.dayNames).toEqual(p.dayNames);
        expect(out.activities).toEqual(p.activities);
        expect(out.weeks).toBe(p.weeks);
      };
      check(moveItem(p, a.id, 1));
      check(moveItem(p, a.id, -1));
      if (same) {
        check(supersetWith(p, a.id, same.id));
        check(ungroup(supersetWith(p, a.id, same.id), a.id));
      }
      const added = addItem(p, {
        day: a.day,
        name: 'Added',
        kind: 'strength',
        sets: 3,
        reps: 10,
        durationMin: null,
        equipment: [],
      });
      check(added);
      expect(added.items).toHaveLength(p.items.length + 1);
      check(removeItem(p, a.id), [a.id]);
    }
  });

  it('copy a day: the copies carry every field of the source rows (new id, new day, own group id), the rest is unchanged', () => {
    for (const seed of seeds.slice(0, 30)) {
      const p = genProgram(seed);
      const from = p.items[0].day;
      const to = from === 7 ? 1 : from + 1;
      const out = copyDay(p, from, to);
      const src = p.items.filter((i) => i.day === from).sort((x, y) => x.position - y.position);
      const dst = out.items.filter((i) => i.day === to).sort((x, y) => x.position - y.position);
      expect(dst).toHaveLength(src.length);
      for (const [k, s] of src.entries()) {
        const { id: _i, day: _d, groupId: _g, position: _p, ...restS } = s;
        const { id: _i2, day: _d2, groupId: _g2, position: _p2, ...restD } = dst[k];
        void [_i, _d, _g, _p, _i2, _d2, _g2, _p2];
        expect(restD).toEqual(restS);
      }
      // other days untouched
      for (const i of p.items.filter((x) => x.day !== to))
        expect(byId(out).get(i.id)).toMatchObject(strip(i));
      // activities of the source day are copied too
      expect(out.activities?.filter((a) => a.day === to).map((a) => a.type)).toEqual(
        p.activities?.filter((a) => a.day === from).map((a) => a.type) ?? [],
      );
      expect(out.dayNames[String(to)]).toBe(p.dayNames[String(from)]);
    }
  });

  it('import a day from another program (a template): same guarantee', () => {
    for (const seed of seeds.slice(0, 30)) {
      const tpl = genProgram(seed + 1, 'tpl');
      const p = genProgram(seed);
      const srcDay = tpl.items[0].day;
      const out = importDay(p, 3, tpl, srcDay);
      const src = tpl.items.filter((i) => i.day === srcDay).sort((x, y) => x.position - y.position);
      const dst = out.items.filter((i) => i.day === 3).sort((x, y) => x.position - y.position);
      expect(dst).toHaveLength(src.length);
      for (const [k, s] of src.entries()) {
        const { id: _i, day: _d, groupId: _g, position: _p, ...restS } = s;
        const { id: _i2, day: _d2, groupId: _g2, position: _p2, ...restD } = dst[k];
        void [_i, _d, _g, _p, _i2, _d2, _g2, _p2];
        expect(restD).toEqual(restS);
      }
    }
  });

  it('"Just the exercise" and back: the cue, group and equipment stay; the numbers are remembered in the draft only', () => {
    const p = genProgram(seeds[0]);
    const row = p.items.find((i) => i.kind === 'strength' && !i.bare && i.targetWeight && i.note)!;
    const bare = setRowMode(p, row.id, true);
    const b = bare.items.find((i) => i.id === row.id)!;
    expect(b).toMatchObject({ bare: true, sets: 0, reps: 0, note: row.note, name: row.name });
    expect(b.groupId).toEqual(row.groupId);
    expect(b.equipment).toEqual(row.equipment);
    expect(b.targetWeight).toBeUndefined();
    const back = setRowMode(bare, row.id, false).items.find((i) => i.id === row.id)!;
    expect(back).toMatchObject({
      sets: row.sets,
      reps: row.reps,
      targetWeight: row.targetWeight,
      note: row.note,
    });
    // what is written drops the memory (explicit: `was` is draft-only), never a real field
    const written = forWrite(bare).items.find((i) => i.id === row.id)!;
    expect('was' in written).toBe(false);
    expect(written.note).toBe(row.note);
  });

  it('the diff sees every part of the program a client would notice (so "Program updated" never has an empty summary)', () => {
    const p = genProgram(seeds[2]);
    const strength = p.items.find((i) => i.kind === 'strength' && !i.bare)!;
    const whats = (to: Program) =>
      diffPrograms(forWrite(p), forWrite(to)).map((c) => (c.op === 'change' ? c.what : c.op));
    const patch = (patchBody: Partial<ProgramItem>) => patchItem(p, strength.id, patchBody);
    expect(whats(patch({ targetWeight: 999 }))).toEqual(['weight']);
    expect(whats(patch({ targetRpe: 10 }))).toContain('rpe');
    expect(whats(patch({ restSec: 999 }))).toContain('rest');
    expect(whats(patch({ note: 'changed' }))).toContain('note');
    expect(whats(patch({ dropLast: !strength.dropLast }))).toContain('dropLast');
    expect(whats(patch({ sets: 9 }))).toContain('sets');
    expect(whats(patch({ reps: 99 }))).toContain('reps');
    expect(whats(patch({ day: strength.day === 7 ? 1 : strength.day + 1 }))).toContain('day');
    expect(whats(patch({ equipment: ['kettlebell'] }))).toContain('equipment');
    expect(whats(setDayName(p, 3, 'Renamed'))).toEqual(['dayName']);
    // warm-up exercises and weights, cardio minutes
    const warm = p.items.find((i) => i.kind === 'warmup' && i.warmupItems?.length);
    if (warm)
      expect(
        whats(
          patchItem(p, warm.id, {
            warmupItems: warm.warmupItems!.map((w) => ({
              ...w,
              weight: (w.weight ?? 0) + 5,
              reps: w.reps ?? 8,
            })),
          }),
        ),
      ).toEqual(['warmup']);
    const cardio = p.items.find((i) => i.kind === 'cardio');
    if (cardio)
      expect(
        whats(patchItem(p, cardio.id, { durationMin: (cardio.durationMin ?? 0) + 5 })),
      ).toEqual(['cardio']);
    if (cardio) expect(whats(removeItem(p, cardio.id))).toEqual(['cardio']);
    // planned activities and target muscles of a day
    expect(
      whats({
        ...p,
        activities: [
          ...(p.activities ?? []),
          { id: 'new', day: 2, type: 'cycling', minutes: 30, effort: 'light', when: 'any' },
        ],
      }),
    ).toEqual(['activities']);
    expect(whats({ ...p, targetMuscles: { ...p.targetMuscles, '6': ['legs'] as never } })).toEqual([
      'muscles',
    ]);
    // nothing changed = nothing reported
    expect(whats(p)).toEqual([]);
    // forWrite's draft-only memory is not a change
    expect(whats(setRowMode(p, strength.id, false))).toEqual([]);
  });
});
