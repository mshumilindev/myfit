/**
 * NO DATA LOSS (iter17), program model. Three layers, each checked field by field:
 *   1. the sealed plan-version codec (`sealVersion` / `openVersion`) over seeded random programs,
 *   2. the whole trainer -> client path (port save / send / reload, the client's layer, the plaintext runnable doc),
 *   3. what is dropped ON PURPOSE (the runnable document is template-level; unknown plan keys are not read) is asserted
 *      as an explicit list, so a new field cannot disappear silently.
 * Adding a key to `Program`, `ProgramItem`, `ProgramWarmupItem` or `ProgramActivity` fails the compile of the registries
 * below until the generator sets it, which pulls it into every round trip.
 */
import { describe, expect, it } from 'vitest';
import {
  type Program,
  type ProgramActivity,
  type ProgramItem,
  type ProgramWarmupItem,
} from '../../../views/programs/model';
import { forWrite } from '../../program/ops';
import {
  openVersion,
  planProgramId,
  runnableProgram,
  sealVersion,
  type VersionDocData,
} from '../../program/planCodec';
import { applyProgramLayer } from './clientProgram';
import { C, T } from './parity/harness';
import { linkUp, settle } from './parity/flow';
import { makeWorld } from './testWorld';
import { genProgram, seeds } from './parity/programGen';

const ac = () => ({ signal: new AbortController().signal });

/* ---- registries: every key of the model, checked by the compiler ------------------------------------------------ */
const ITEM_KEYS: Record<keyof ProgramItem, true> = {
  id: true,
  day: true,
  position: true,
  name: true,
  kind: true,
  sets: true,
  reps: true,
  durationMin: true,
  equipment: true,
  groupId: true,
  groupOrder: true,
  dropLast: true,
  warmupItems: true,
  bare: true,
  targetWeight: true,
  targetRpe: true,
  restSec: true,
  note: true,
};
const WARM_KEYS: Record<keyof ProgramWarmupItem, true> = {
  id: true,
  name: true,
  exerciseId: true,
  reps: true,
  durationSec: true,
  weight: true,
};
const ACT_KEYS: Record<keyof ProgramActivity, true> = {
  id: true,
  day: true,
  type: true,
  minutes: true,
  effort: true,
  when: true,
};
const PROGRAM_KEYS: Record<keyof Program, true> = {
  id: true,
  name: true,
  weeks: true,
  daysPerWeek: true,
  status: true,
  authorId: true,
  dayNames: true,
  targetMuscles: true,
  items: true,
  activities: true,
  activitiesEnc: true,
  updatedAt: true,
};

describe('the generator reaches every key of the model (so the property below means something)', () => {
  it('each registered key is set by at least one generated program', () => {
    const progs = seeds.map((s) => genProgram(s));
    const seenItem = new Set<string>();
    const seenWarm = new Set<string>();
    const seenAct = new Set<string>();
    const seenProg = new Set<string>();
    for (const p of progs) {
      Object.keys(p).forEach((k) => seenProg.add(k));
      p.activities?.forEach((a) => Object.keys(a).forEach((k) => seenAct.add(k)));
      for (const i of p.items) {
        Object.keys(i).forEach((k) => seenItem.add(k));
        i.warmupItems?.forEach((w) => Object.keys(w).forEach((k) => seenWarm.add(k)));
      }
    }
    const missing = (reg: object, seen: Set<string>, ok: string[] = []) =>
      Object.keys(reg).filter((k) => !seen.has(k) && !ok.includes(k));
    expect(missing(ITEM_KEYS, seenItem)).toEqual([]);
    expect(missing(WARM_KEYS, seenWarm)).toEqual([]);
    expect(missing(ACT_KEYS, seenAct)).toEqual([]);
    // `activitiesEnc` is the athlete's own stored form of the list; `updatedAt` is stamped by whoever writes the document
    expect(missing(PROGRAM_KEYS, seenProg, ['activitiesEnc', 'updatedAt'])).toEqual([]);
  });
});

describe('layer 1: the sealed version codec keeps every field', () => {
  it('seal -> open returns the program as written, for 60 seeded programs, and keeps a key it does not know', async () => {
    const w = await makeWorld();
    await w.publishKey();
    w.trainerBook.start();
    await w.trainerBook.ready();
    for (let i = 0; i < 50 && !w.trainerBook.ringFor(C); i++)
      await new Promise((r) => setTimeout(r, 0));
    const src = { vault: w.tv, ring: w.trainerBook.ringFor(C)! };
    for (const [n, seed] of seeds.entries()) {
      const p = forWrite(genProgram(seed));
      // a newer app version adds a key to an item and to the program: it must come back too (forward compatible)
      (p.items[0] as unknown as Record<string, unknown>).futureField = { a: [1, 2] };
      (p as unknown as Record<string, unknown>).futureTop = 'x';
      const v: VersionDocData = {
        n: n + 1,
        programId: planProgramId(C),
        state: 'live',
        createdAt: 1_800_000_000_000,
        publishedAt: 1_800_000_000_000,
        reason: 'r',
        summary: 'summary ä',
        diff: [],
        program: p,
        trainerDays: ['Tue', 'Thu'],
      };
      const back = await openVersion(src, C, T, await sealVersion(src, C, T, v));
      expect(back.program).toEqual(JSON.parse(JSON.stringify(p)));
      expect(back.trainerDays).toEqual(['Tue', 'Thu']);
      expect(back.summary).toBe('summary ä');
    }
  });
});

describe('layer 2: trainer editor -> save -> send -> client layer -> runnable -> reload, over the shared store', () => {
  it('three seeded programs sent as v1, v2, v3 arrive unchanged; a reload gives back the same', async () => {
    const w = await linkUp();
    for (const seed of [seeds[3], seeds[17], seeds[41]]) {
      const b = await w.tr.program.load(C, ac());
      const draft = genProgram(seed);
      await w.tr.program.saveDraft(C, { draft, trainerDays: ['Mon', 'Wed'], baseRev: b.rev });
      const saved = await w.tr.program.load(C, ac());
      expect(saved.draft).toEqual(JSON.parse(JSON.stringify(forWrite(draft))));
      const sent = await w.tr.program.send(C, {
        draft,
        trainerDays: ['Mon', 'Wed'],
        baseRev: saved.rev,
      });
      await settle(80);
      const layer = w.cl.snap()!.program!;
      expect(layer.version).toBe(sent.version);
      expect(layer.program).toEqual(JSON.parse(JSON.stringify(forWrite(draft))));
      expect(layer.trainerDays).toEqual(['Mon', 'Wed']);
      // the trainer's own reload of the live version
      const live = await w.tr.program.load(C, ac());
      expect(live.live).toEqual(JSON.parse(JSON.stringify(forWrite(draft))));
      // the plaintext runnable document: exactly the documented drops, nothing else
      const asg = await w.cl.fs.get(`assignments/${C}`);
      const doc = (await w.cl.fs.get(`programs/${asg!.programId}`)) as unknown as Program;
      const sentP = forWrite(draft);
      const named = sentP.items.filter((i) => i.name.trim());
      expect(doc.items.map((i) => i.id)).toEqual(named.map((i) => i.id));
      const DROPPED = ['targetWeight', 'targetRpe', 'restSec', 'note'];
      for (const [k, i] of named.entries()) {
        const keep = Object.keys(i)
          .filter((x) => !DROPPED.includes(x))
          .sort();
        expect(Object.keys(doc.items[k]).sort()).toEqual(keep);
        for (const key of keep.filter((x) => x !== 'warmupItems'))
          expect((doc.items[k] as unknown as Record<string, unknown>)[key]).toEqual(
            (i as unknown as Record<string, unknown>)[key],
          );
        if (i.warmupItems)
          expect(doc.items[k].warmupItems).toEqual(
            i.warmupItems.map(({ weight: _w, ...rest }) => (void _w, rest)),
          );
      }
      expect(doc.dayNames).toEqual(sentP.dayNames);
      expect(doc.targetMuscles).toEqual(sentP.targetMuscles);
      expect(doc.weeks).toBe(sentP.weeks);
      expect(doc.daysPerWeek).toBe(sentP.daysPerWeek);
      expect(doc.activities).toBeUndefined(); // the prescription lives only in the sealed layer
      // and the workout screen sees everything again: runnable + layer == the program as written
      const merged = applyProgramLayer(doc as never, layer) as unknown as Program;
      for (const i of named) {
        const m = merged.items.find((x) => x.id === i.id)!;
        for (const key of DROPPED)
          expect((m as unknown as Record<string, unknown>)[key]).toEqual(
            (i as unknown as Record<string, unknown>)[key],
          );
      }
      expect(merged.activities).toEqual(sentP.activities);
    }
    expect(w.cl.fs.denied).toEqual([]);
    expect(w.tr.fs.denied).toEqual([]);
  });

  it('rows without a name are not started by the client (documented drop of the runnable document), but stay in the layer', async () => {
    const w = await linkUp();
    const b = await w.tr.program.load(C, ac());
    const draft = genProgram(5);
    draft.items.push({
      id: 'blank',
      day: 2,
      position: 99,
      name: '   ',
      kind: 'strength',
      sets: 3,
      reps: 5,
      durationMin: null,
      equipment: [],
    });
    await w.tr.program.send(C, { draft, trainerDays: [], baseRev: b.rev });
    await settle(80);
    const layer = w.cl.snap()!.program!;
    expect(layer.program!.items.some((i) => i.id === 'blank')).toBe(true);
    const asg = await w.cl.fs.get(`assignments/${C}`);
    const doc = (await w.cl.fs.get(`programs/${asg!.programId}`)) as unknown as Program;
    expect(doc.items.some((i) => i.id === 'blank')).toBe(false);
  });
});

describe('layer 3: explicit drops', () => {
  it('runnableProgram removes exactly the per-client prescription, whatever the program holds', () => {
    for (const seed of seeds) {
      const p = forWrite(genProgram(seed));
      (p.items[0] as unknown as Record<string, unknown>).futureField = 1;
      const out = runnableProgram(p, { id: 'prg-x-1', authorId: T, updatedAt: 5 });
      expect(out.activities).toBeUndefined();
      expect('activitiesEnc' in out).toBe(false);
      expect(out.status).toBe('draft');
      for (const [k, i] of out.items.entries()) {
        const src = p.items.filter((x) => x.name.trim())[k];
        const gone = Object.keys(src).filter((x) => !(x in i));
        expect(
          gone.every((x) => ['targetWeight', 'targetRpe', 'restSec', 'note'].includes(x)),
        ).toBe(true);
        expect((i as unknown as Record<string, unknown>).futureField).toEqual(
          (src as unknown as Record<string, unknown>).futureField,
        ); // structure travels, unknown keys too
      }
    }
  });
});
