/**
 * Parity between the trainer app and the client app over ONE shared store (real adapters on both sides, the real server
 * services on a Kv seam, `firestore.rules` enforced for both signed-in users). See parity/harness.ts.
 *
 * F2  the conversation key exists right after the accept
 * F3  nothing the trainer prescribes is lost on the way to the client's workout
 */
import { describe, expect, it } from 'vitest';
import { ALL_OFF } from '../../domain/consent';
import { freshProgram, type Program, type ProgramItem } from '../../../views/programs/model';
import { planProgramId, runnableProgram } from '../../program/planCodec';
import { forWrite } from '../../program/ops';
import { applyProgramLayer } from './clientProgram';
import { C, T, makeServer, settle } from './parity/harness';
import { makeClient, makeTrainer } from './parity/sides';
import { latest, linkUp } from './parity/flow';

const ac = () => ({ signal: new AbortController().signal });

describe('F2 conversation key right after the accept', () => {
  it('the trainer can chat, load the program, save a schedule and add a shared note before the client wrote anything', async () => {
    const s = await makeServer();
    const tr = await makeTrainer(s);
    const cl = await makeClient(s);
    const inv = await tr.invite.create({
      name: 'Oleh',
      mode: 'app',
      request: { ...ALL_OFF, totals: 'full' },
    });
    await cl.port.acceptInvite(inv.url!.split('/').pop()!, {
      ...ALL_OFF,
      totals: 'full',
      sets: 'effects',
    });
    await settle(100);
    const cid = s.cidOf(C, T);
    expect((await s.fs.get(`conversations/${cid}`))?.ck).toBeTruthy();
    expect(cl.book.ringFor(C)).not.toBeNull();
    await tr.world.load(ac());
    await tr.chat.send(cid, { id: 'm1', text: 'Hi Oleh', at: tr.fs.now() });
    expect((await tr.program.load(C, ac())).rev).toBe(0);
    await tr.schedule.saveDoc({
      clientId: C,
      rev: 0,
      patterns: [],
      oneOffs: [],
      exceptions: [],
      cancelled: [],
    });
    await tr.notes.add({ clientId: C, text: 'hello', vis: 'shared', anchor: { kind: 'none' } });
    expect(tr.fs.denied).toEqual([]);
    expect(cl.fs.denied).toEqual([]);
  });

  it('is idempotent: a chat send after the accept keeps the same key and epoch', async () => {
    const w = await linkUp({ totals: 'full' }, { hello: false });
    const before = await w.s.fs.get(`conversations/${w.cid}`);
    await w.cl.chatClient.send(w.cid, { id: 'c1', text: 'Hi', at: w.cl.fs.now() });
    await settle(50);
    const after = await w.s.fs.get(`conversations/${w.cid}`);
    expect(after?.keyEpoch).toBe(before?.keyEpoch);
    expect((after?.ck as { fp: string }).fp).toBe((before?.ck as { fp: string }).fp);
    // the trainer reads the message the client sent with the key made at the accept
    await w.tr.book.refresh();
    const msgs =
      (await latest<{ body: { text?: string } }[]>((on, er) =>
        w.tr.chat.subscribeMessages(w.cid, (m) => on(m as never), er),
      )) ?? [];
    expect(msgs.map((m) => m.body.text)).toContain('Hi');
  });

  it('two requests for the key in the same tick make one key', async () => {
    const w = await linkUp({ totals: 'full' }, { hello: false });
    const [a, b] = await Promise.all([w.cl.rings.current(w.cid), w.cl.rings.current(w.cid)]);
    expect(a.epoch).toBe(b.epoch);
    expect(a.epoch).toBe(1);
  });
});

const item = (
  id: string,
  day: number,
  position: number,
  name: string,
  extra: Partial<ProgramItem> = {},
): ProgramItem => ({
  id,
  day,
  position,
  name,
  kind: 'strength',
  sets: 4,
  reps: 5,
  durationMin: null,
  equipment: [],
  ...extra,
});

/** Every optional field of the program model set at least once. */
const richProgram = (): Program => ({
  ...freshProgram('Strength block'),
  id: planProgramId(C),
  authorId: T,
  weeks: 6,
  daysPerWeek: 3,
  dayNames: { '2': 'Lower A', '4': 'Upper B', '6': 'Conditioning' },
  targetMuscles: { '6': ['chest', 'back'] },
  items: [
    item('w1', 2, 0, 'Warm-up', {
      kind: 'warmup',
      sets: 1,
      reps: 1,
      durationMin: 8,
      warmupItems: [
        { id: 'wi1', name: 'Goblet Squat', reps: 8, weight: 12 },
        { id: 'wi2', name: 'Plank', durationSec: 30 },
      ],
    }),
    item('i1', 2, 1, 'Barbell Squat', {
      targetWeight: 120,
      targetRpe: 8,
      restSec: 150,
      note: 'Pause at the bottom',
      groupId: null,
      dropLast: true,
    }),
    item('i2', 2, 2, 'Romanian Deadlift', {
      sets: 3,
      reps: 8,
      targetWeight: 100,
      groupId: 'g1',
      groupOrder: 0,
    }),
    item('i3', 2, 3, 'Leg Curl', {
      sets: 3,
      reps: 12,
      targetWeight: 40,
      groupId: 'g1',
      groupOrder: 1,
      restSec: 60,
    }),
    item('i4', 4, 0, 'Barbell Squat', {
      sets: 3,
      reps: 8,
      targetWeight: 90,
      targetRpe: 7,
      restSec: 120,
      note: 'Light day',
    }),
    item('i5', 4, 1, 'Paused Bench Press', { sets: 0, reps: 0, bare: true }),
    item('c1', 6, 0, 'Rowing', { kind: 'cardio', sets: 1, reps: 1, durationMin: 20 }),
  ],
  activities: [
    { id: 'a1', day: 3, type: 'running', minutes: 30, effort: 'hard', when: 'before' },
    { id: 'a2', day: 5, type: 'yoga', minutes: 45, effort: 'light', when: 'any' },
  ],
});

describe('F3 the prescription reaches the client unchanged', () => {
  it('trainer send -> client layer holds the whole program, field by field', async () => {
    const w = await linkUp();
    const b = await w.tr.program.load(C, ac());
    const draft = richProgram();
    await w.tr.program.send(C, { draft, trainerDays: ['Tue', 'Thu'], baseRev: b.rev });
    await settle(80);
    const layer = w.cl.snap()!.program!;
    const sent = forWrite(draft);
    expect(layer.program).toBeDefined();
    // item by item, every key the model knows
    expect(layer.program!.items).toEqual(sent.items);
    expect(layer.program!.dayNames).toEqual(draft.dayNames);
    expect(layer.program!.targetMuscles).toEqual(draft.targetMuscles);
    expect(layer.program!.activities).toEqual(draft.activities);
    expect(layer.program!.weeks).toBe(6);
    expect(layer.trainerDays).toEqual(['Tue', 'Thu']);
    // the by-name summary does not collapse a second row of the same lift into the first
    expect(
      layer.program!.items.filter((i) => i.name === 'Barbell Squat').map((i) => i.targetWeight),
    ).toEqual([120, 90]);
  });

  it('trainer reload gives back what was saved (draft and live), nothing normalised away', async () => {
    const w = await linkUp();
    const b = await w.tr.program.load(C, ac());
    const draft = richProgram();
    await w.tr.program.saveDraft(C, { draft, trainerDays: ['Tue'], baseRev: b.rev });
    const again = await w.tr.program.load(C, ac());
    expect(again.draft).toEqual(forWrite(draft));
    const sent = await w.tr.program.send(C, { draft, trainerDays: ['Tue'], baseRev: again.rev });
    const live = await w.tr.program.load(C, ac());
    expect(live.live).toEqual(forWrite(draft));
    expect(live.liveVersion).toBe(sent.version);
  });

  it('the plaintext runnable program stays template-level, and the client puts the sealed layer back in memory', async () => {
    const w = await linkUp();
    const b = await w.tr.program.load(C, ac());
    const draft = richProgram();
    await w.tr.program.send(C, { draft, trainerDays: ['Tue'], baseRev: b.rev });
    await settle(80);
    const asg = await w.cl.fs.get(`assignments/${C}`);
    const doc = (await w.cl.fs.get(`programs/${asg!.programId}`)) as unknown as Program;
    // privacy: no prescription in the plaintext document
    for (const i of doc.items) {
      expect(i).not.toHaveProperty('targetWeight');
      expect(i).not.toHaveProperty('targetRpe');
      expect(i).not.toHaveProperty('restSec');
      expect(i).not.toHaveProperty('note');
    }
    expect(doc.activities).toBeUndefined();
    // structure is complete
    const tpl = runnableProgram(draft, { id: doc.id, authorId: T, updatedAt: doc.updatedAt ?? 0 });
    expect(
      doc.items.map((i) => [
        i.id,
        i.day,
        i.position,
        i.name,
        i.kind,
        i.sets,
        i.reps,
        i.groupId ?? null,
        i.groupOrder ?? null,
        !!i.dropLast,
        !!i.bare,
      ]),
    ).toEqual(
      tpl.items.map((i) => [
        i.id,
        i.day,
        i.position,
        i.name,
        i.kind,
        i.sets,
        i.reps,
        i.groupId ?? null,
        i.groupOrder ?? null,
        !!i.dropLast,
        !!i.bare,
      ]),
    );
    // what the workout screen reads (programMine + overlay)
    const merged = applyProgramLayer(doc as never, w.cl.snap()!.program) as unknown as Program;
    const sq = merged.items.find((i) => i.id === 'i1')!;
    expect(sq).toMatchObject({
      targetWeight: 120,
      targetRpe: 8,
      restSec: 150,
      note: 'Pause at the bottom',
      dropLast: true,
    });
    const sq2 = merged.items.find((i) => i.id === 'i4')!;
    expect(sq2).toMatchObject({ targetWeight: 90, targetRpe: 7, restSec: 120, note: 'Light day' });
    expect(merged.items.find((i) => i.id === 'w1')!.warmupItems?.[0].weight).toBe(12);
    expect(merged.activities).toEqual(draft.activities);
    expect(w.cl.fs.denied).toEqual([]);
    expect(w.tr.fs.denied).toEqual([]);
  });

  it('old data still decodes: a layer or a document without the program leaves the runnable program as it is', () => {
    const base = { items: [{ id: 'x', targetWeight: 50 }, { id: 'y' }] };
    expect(applyProgramLayer(base as never, null)).toBe(base);
    expect(applyProgramLayer(base as never, {} as never)).toBe(base);
    const lay = {
      program: {
        items: [
          { id: 'y', targetWeight: 70 },
          { id: 'zzz', targetWeight: 1 },
        ],
        activities: [],
      },
    } as never;
    const out = applyProgramLayer(base as never, lay) as {
      items: { id: string; targetWeight?: number }[];
    };
    expect(out.items).toEqual([
      { id: 'x', targetWeight: 50 },
      { id: 'y', targetWeight: 70 },
    ]);
  });
});

describe('F3b feedback after the trainer sends', () => {
  it('summary is the real diff, a "Program updated" card is in the chat, the client gets a push, the trainer sees the ack', async () => {
    const w = await linkUp();
    const b = await w.tr.program.load(C, ac());
    const v1 = richProgram();
    await w.tr.program.send(C, { draft: v1, trainerDays: ['Tue'], baseRev: b.rev });
    await settle(60);
    const b2 = await w.tr.program.load(C, ac());
    expect(b2.seen).toBeNull();
    const v2: Program = {
      ...b2.draft,
      items: [
        ...b2.draft.items.map((i) =>
          i.id === 'i1' ? { ...i, targetWeight: 125, note: 'Tempo 3-1-1' } : i,
        ),
        item('i9', 2, 9, 'Leg Press', { sets: 3, reps: 12 }),
      ],
    };
    await w.tr.program.send(C, { draft: v2, trainerDays: ['Tue'], baseRev: b2.rev });
    await settle(100);
    // summary: real, in the layer the client reads and in the trainer's version list
    const layer = w.cl.snap()!.program!;
    expect(layer.version).toBe(2);
    expect(layer.summary).toMatch(/Leg Press/);
    expect(layer.summary).toMatch(/Barbell Squat/);
    expect(layer.acked).toBe(false);
    const b3 = await w.tr.program.load(C, ac());
    expect(b3.versions.find((v) => v.n === 2)?.summary).toBe(layer.summary);
    // card in the thread of the client (a sealed system body, stable id)
    const msgs =
      (await latest<{ id: string; body: { kind: string; type?: string; text?: string } }[]>(
        (on, er) => w.cl.chat.subscribeMessages(w.cid, (m) => on(m as never), er),
      )) ?? [];
    const cardV2 = msgs.filter(
      (m) => m.body.kind === 'system' && m.body.type === 'program-updated',
    );
    expect(cardV2.map((m) => m.id)).toEqual(expect.arrayContaining([`pu-2-${C}`]));
    expect(cardV2.find((m) => m.id === `pu-2-${C}`)!.body.text).toMatch(/^v2 · /);
    // push to the client, content-free kind
    expect(w.s.pushes.filter((p) => p.uid === C && p.kind === 'program').length).toBe(2);
    // ack: the client opens it, the trainer sees it
    await w.cl.port.ackProgram(2);
    await settle(60);
    expect(w.cl.snap()!.program!.acked).toBe(true);
    const b4 = await w.tr.program.load(C, ac());
    expect(b4.seen).toMatchObject({ version: 2 });
    expect(b4.seen!.at).toBeGreaterThan(0);
    // acking a version that is not live is refused by the server
    await expect(w.cl.fs.call('programAck', { version: 9 })).rejects.toMatchObject({
      reason: 'version-order',
    });
    expect(w.cl.fs.denied).toEqual([]);
    expect(w.tr.fs.denied).toEqual([]);
  });

  it('a retried Send posts the card once', async () => {
    const w = await linkUp();
    const b = await w.tr.program.load(C, ac());
    await w.tr.program.send(C, { draft: richProgram(), trainerDays: ['Tue'], baseRev: b.rev });
    const msgs =
      (await latest<{ id: string; body: { type?: string } }[]>((on, er) =>
        w.cl.chat.subscribeMessages(w.cid, (m) => on(m as never), er),
      )) ?? [];
    expect(msgs.filter((m) => m.body.type === 'program-updated')).toHaveLength(1);
  });
});
