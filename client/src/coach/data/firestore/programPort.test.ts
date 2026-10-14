import { describe, expect, it } from 'vitest';
import type { ClientSnapshot } from '../../client/data/types';
import { buildFixtureWorld } from '../__fixtures__/fixtures';
import { setRowMode } from '../../program/ops';
import { olehDraft } from '../../program/__fixtures__/fixtures';
import { planProgramId } from '../../program/planCodec';
import { ProgramPortError } from '../../program/types';
import { startProgramDaySession } from '../../../data/programMine';
import { __getStateForTests, __replaceStateForTests } from '../../../store';
import { createFirestoreClientPort } from './clientPort';
import { createFirestoreProgramPort } from './programPort';
import { C, CID, NOW, T, makeWorld } from './testWorld';

const tick = () => new Promise((r) => setTimeout(r, 0));
async function until<R>(f: () => R | undefined | null | false, ms = 1500): Promise<R> {
  const t0 = Date.now();
  for (;;) {
    const v = f();
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error('timeout');
    await tick();
  }
}

const base = buildFixtureWorld().clients[0];
const roster = [
  {
    ...base,
    id: C,
    name: 'Oleh Bondar',
    program: 'Upper/Lower 4x',
    trainerDays: ['Tue', 'Fri'] as const,
  },
  { ...base, id: 'client-2', name: 'Yulia', program: 'Upper/Lower 4x', trainerDays: [] as const },
] as unknown as ReturnType<typeof buildFixtureWorld>['clients'];

async function setup(opts: { prime?: boolean } = {}) {
  const w = await makeWorld();
  if (opts.prime !== false) await w.publishKey();
  w.trainerBook.start();
  w.clientBook.start();
  await w.trainerBook.ready();
  await w.clientBook.ready();
  if (opts.prime !== false) {
    await until(() => w.trainerBook.ringFor(C));
    await until(() => w.clientBook.ringFor(C));
  }
  // the server's publish function: flips the draft live, bumps the plan's rev, writes the one notice
  w.fs.onCall('publishPlanVersion', async (data) => {
    const n = Number(data.n);
    const plan = (await w.fs.get(`plans/${C}`))!;
    const live = Number(plan.liveVersion ?? 0);
    if (n !== live + 1)
      throw Object.assign(new Error('version-order'), { code: 'failed-precondition' });
    if (live > 0) await w.fs.update(`plans/${C}/versions/${live}`, { state: 'superseded' });
    const ver = (await w.fs.get(`plans/${C}/versions/${n}`))!;
    // the real function refuses a version without the trainer's own runnable program
    const prog = await w.fs.get(`programs/${String(ver.programId)}`);
    if (!prog) throw Object.assign(new Error('no-program'), { code: 'failed-precondition' });
    if (prog.authorId !== T)
      throw Object.assign(new Error('program-not-yours'), { code: 'permission-denied' });
    await w.fs.update(`plans/${C}/versions/${n}`, { state: 'live', publishedAt: NOW });
    await w.fs.update(`plans/${C}`, {
      liveVersion: n,
      programId: ver.programId,
      rev: Number(plan.rev) + 1,
      updatedAt: NOW,
    });
    await w.fs.update(`programs/${String(ver.programId)}`, { status: 'active', updatedAt: NOW });
    const asg = await w.fs.get(`assignments/${C}`);
    await w.fs.set(`assignments/${C}`, {
      memberId: C,
      programId: ver.programId,
      assignedBy: T,
      startedAt: asg && asg.assignedBy === T ? asg.startedAt : NOW,
    });
    await w.fs.set(`users/${C}/notices/pu-${C}`, {
      id: `pu-${C}`,
      kind: 'program-updated',
      ref: { cid: CID, version: n },
      createdAt: NOW,
      readAt: null,
    });
    return { liveVersion: n };
  });
  w.fs.onCall('coachMyLink', () => ({
    linked: true,
    trainer: { id: T, name: 'Iryna' },
    since: NOW,
    cid: CID,
    mode: 'app',
    consentVersion: 1,
  }));
  const port = createFirestoreProgramPort({
    fs: w.fs,
    vault: w.tv,
    trainer: { id: T, name: 'Iryna' },
    book: w.trainerBook,
    roster: () => roster,
  });
  const clientPort = createFirestoreClientPort({
    fs: w.fs,
    vault: w.cv,
    uid: C,
    plan: { ringFor: w.clientBook.ringFor, ready: w.clientBook.ready },
  });
  return { w, port, clientPort };
}

const draftWith = (name: string) => {
  const p = olehDraft(T);
  return { ...p, name };
};

function watch(clientPort: ReturnType<typeof createFirestoreClientPort>) {
  let snap: ClientSnapshot | null = null;
  const off = clientPort.subscribe(
    (s) => (snap = s),
    (e) => {
      throw e;
    },
  );
  return { get: () => snap, off };
}

describe('program port over the sealed plan documents', () => {
  it('a new client opens with an empty starter; the first save creates the plan and a draft version, sealed', async () => {
    const { w, port } = await setup();
    const b = await port.load(C, { signal: new AbortController().signal });
    expect(b.rev).toBe(0);
    expect(b.liveVersion).toBe(0);
    expect(b.draftVersion).toBe(1);
    expect(b.draft.items).toHaveLength(0);

    const draft = draftWith('Upper/Lower 4x');
    const { rev } = await port.saveDraft(C, { draft, trainerDays: ['Tue', 'Fri'], baseRev: 0 });
    expect(rev).toBe(1);

    const plan = (await w.fs.get(`plans/${C}`))!;
    expect(plan.programId).toBe(planProgramId(C));
    expect(plan.liveVersion).toBeUndefined();
    expect(Object.keys(plan).sort()).toEqual(
      ['clientId', 'enc', 'keyEpoch', 'programId', 'rev', 'trainerId', 'updatedAt'].sort(),
    );
    const v = (await w.fs.get(`plans/${C}/versions/1`))!;
    expect(v.state).toBe('draft');
    expect(Object.keys(v).sort()).toEqual(
      ['createdAt', 'enc', 'keyEpoch', 'n', 'programId', 'state'].sort(),
    );
    // nothing readable in the database: exercise names, cues, trainer days
    const dump = w.fs.dump();
    expect(dump).not.toContain('Paused bench press');
    expect(dump).not.toContain('2 s pause');
    expect(dump).not.toContain('Upper A');
    // quoted: a bare 3-letter token can occur by chance inside base64 ciphertext
    expect(dump).not.toContain('"Tue"');

    const again = await port.load(C, { signal: new AbortController().signal });
    expect(again.rev).toBe(1);
    expect(again.draft.items.map((i) => i.name)).toEqual(draft.items.map((i) => i.name));
    expect(again.trainerDays).toEqual(['Tue', 'Fri']);
    expect(again.versions[0]).toMatchObject({ n: 1, at: null });
    expect(port.peek(C)?.rev).toBe(1);
  });

  it('a stale revision is a conflict and writes nothing', async () => {
    const { w, port } = await setup();
    const input = { draft: draftWith('A'), trainerDays: [] as never[], baseRev: 0 };
    await port.saveDraft(C, input);
    const before = JSON.stringify(await w.fs.get(`plans/${C}`));
    await expect(port.saveDraft(C, input)).rejects.toMatchObject({ code: 'conflict' });
    expect(JSON.stringify(await w.fs.get(`plans/${C}`))).toBe(before);
  });

  it('a program bigger than a chat message seals (versions are whole programs)', async () => {
    const { port } = await setup();
    const big = olehDraft(T);
    const items = [...big.items];
    for (let i = 0; i < 6; i++) items.push(...big.items.map((x) => ({ ...x, id: `${x.id}-${i}` })));
    const { rev } = await port.saveDraft(C, {
      draft: { ...big, items },
      trainerDays: [],
      baseRev: 0,
    });
    expect(rev).toBe(1);
    const b = await port.load(C, { signal: new AbortController().signal });
    expect(b.draft.items.length).toBe(items.length);
  });

  it('without a key on this device nothing is written (vault-locked), never plaintext', async () => {
    const { w, port } = await setup({ prime: false });
    await expect(
      port.saveDraft(C, { draft: draftWith('A'), trainerDays: [], baseRev: 0 }),
    ).rejects.toMatchObject({ code: 'vault-locked' });
    expect(w.fs.has(`plans/${C}`)).toBe(false);
    expect(w.fs.writes.filter((p) => p.startsWith('plans'))).toEqual([]);
  });

  it('a locked vault is vault-locked too', async () => {
    const { w, port } = await setup();
    w.tv.lock?.();
    const r = port.saveDraft(C, { draft: draftWith('A'), trainerDays: [], baseRev: 0 });
    await expect(r).rejects.toBeInstanceOf(ProgramPortError);
    expect(w.fs.has(`plans/${C}`)).toBe(false);
  });

  it('Send publishes through the callable; the client sees only the live version, with targets by exercise name', async () => {
    const { w, port, clientPort } = await setup();
    const c = watch(clientPort);
    await until(() => c.get());
    expect(c.get()!.program).toBeNull();

    // a draft is not visible to the member (and a version doc in draft state is never read)
    const v1 = draftWith('Upper/Lower 4x');
    await port.saveDraft(C, { draft: v1, trainerDays: ['Tue', 'Fri'], baseRev: 0 });
    await tick();
    expect(c.get()!.program).toBeNull();

    const sent = await port.send(C, { draft: v1, trainerDays: ['Tue', 'Fri'], baseRev: 1 });
    expect(sent.version).toBe(1);
    expect(w.fs.calls.at(-1)).toMatchObject({
      name: 'publishPlanVersion',
      data: { clientId: C, n: 1 },
    });
    const layer = (await until(() => c.get()?.program))!;
    expect(layer.version).toBe(1);
    expect(layer.acked).toBe(false);
    expect(layer.trainerDays).toEqual(['Tue', 'Fri']);
    expect(layer.targets['Bent Over Barbell Row']).toMatchObject({ sets: 4, reps: 8, kg: 70 });
    expect(layer.targets['Paused bench press']).toMatchObject({ note: '2 s pause on the chest' });

    // the trainer's view moved on: the draft is now version 2, the live one is 1
    const b = await port.load(C, { signal: new AbortController().signal });
    expect(b.liveVersion).toBe(1);
    expect(b.draftVersion).toBe(2);
    expect(b.rev).toBe(sent.rev);

    // acknowledging marks the notice read and the layer follows
    await clientPort.ackProgram(1);
    await until(() => c.get()?.program?.acked);
    c.off();
  });

  it('a second version supersedes the first; a bare row keeps no target on the member side', async () => {
    const { port, clientPort } = await setup();
    const c = watch(clientPort);
    const v1 = draftWith('Upper/Lower 4x');
    await port.saveDraft(C, { draft: v1, trainerDays: [], baseRev: 0 });
    const s1 = await port.send(C, { draft: v1, trainerDays: [], baseRev: 1 });
    const bareId = v1.items.find((i) => i.name === 'Bent Over Barbell Row')!.id;
    const v2 = setRowMode(v1, bareId, true);
    await port.saveDraft(C, { draft: v2, trainerDays: ['Mon'], baseRev: s1.rev });
    const b = await port.load(C, { signal: new AbortController().signal });
    expect(b.draftVersion).toBe(2);
    const s2 = await port.send(C, { draft: v2, trainerDays: ['Mon'], baseRev: b.rev });
    expect(s2.version).toBe(2);
    const layer = (await until(() => (c.get()?.program?.version === 2 ? c.get()!.program : null)))!;
    expect(layer.targets['Bent Over Barbell Row']).toBeUndefined();
    expect(layer.trainerDays).toEqual(['Mon']);
    const final = await port.load(C, { signal: new AbortController().signal });
    expect(final.versions.map((v) => v.n)).toEqual([2, 1]);
    c.off();
  });

  it('a version copied under another id or client does not open (AAD), and is not shown', async () => {
    const { w, port } = await setup();
    const v1 = draftWith('A');
    await port.saveDraft(C, { draft: v1, trainerDays: [], baseRev: 0 });
    const s = await port.send(C, { draft: v1, trainerDays: [], baseRev: 1 });
    const live = (await w.fs.get(`plans/${C}/versions/1`))!;
    // the same ciphertext presented as version 2 (a "draft" an attacker made up)
    w.fs.seed(`plans/${C}/versions/2`, { ...live, n: 2, state: 'draft' });
    const b = await port.load(C, { signal: new AbortController().signal });
    expect(b.versions.map((v) => v.n)).toEqual([1]);
    expect(b.draft.items.map((i) => i.name)).toEqual(v1.items.map((i) => i.name));
    expect(b.rev).toBe(s.rev);
  });

  it('copy to a person who does not share the program is forbidden', async () => {
    const { port } = await setup();
    await port.load(C, { signal: new AbortController().signal });
    await expect(port.copyTo(C, 'someone-else')).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('an unknown client is forbidden', async () => {
    const { port } = await setup();
    await expect(
      port.load('nobody', { signal: new AbortController().signal }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('the library offers the days of clients already opened on this device', async () => {
    const { port } = await setup();
    expect(port.library(C)).toEqual([]);
    const v1 = draftWith('Upper/Lower 4x');
    await port.saveDraft(C, { draft: v1, trainerDays: [], baseRev: 0 });
    await port.send(C, { draft: v1, trainerDays: [], baseRev: 1 });
    await port.load(C, { signal: new AbortController().signal });
    expect(port.library('client-2').length).toBeGreaterThan(0);
    expect(port.library(C)).toEqual([]);
  });

  describe('the runnable program (the Gym app starts sessions from it)', () => {
    const asAssignment = async (w: Awaited<ReturnType<typeof setup>>['w']) => {
      // what the `programMine` function returns: the assignment, then the program document it points at
      const asg = (await w.fs.get(`assignments/${C}`))!;
      const program = (await w.fs.get(`programs/${String(asg.programId)}`))!;
      return {
        program: { id: asg.programId, ...program },
        assignedBy: asg.assignedBy,
        week: 1,
        done: 0,
        total: 8,
        expectedSoFar: 1,
        adherence: null,
      };
    };

    it('Send creates programs/prg-{client}-{n}: template level only, status draft until the server flips it', async () => {
      const { w, port } = await setup();
      const v1 = draftWith('Upper/Lower 4x');
      await port.saveDraft(C, { draft: v1, trainerDays: ['Tue'], baseRev: 0 });
      // a saved draft writes no program and the member has no assignment
      expect(w.fs.has(`programs/prg-${C}-1`)).toBe(false);
      expect(w.fs.has(`assignments/${C}`)).toBe(false);
      await port.send(C, { draft: v1, trainerDays: ['Tue'], baseRev: 1 });
      const prog = (await w.fs.get(`programs/prg-${C}-1`))!;
      expect(prog).toMatchObject({ id: `prg-${C}-1`, authorId: T, status: 'active' });
      const names = (prog.items as { name: string }[]).map((i) => i.name);
      expect(names).toContain('Bent Over Barbell Row');
      // the trainer layer never reaches the database in the clear (R-BE-PRG-6)
      const json = JSON.stringify(prog);
      expect(json).not.toContain('2 s pause');
      expect(json).not.toMatch(/targetWeight|targetRpe|restSec|"note"|activit/);
      expect(await w.fs.get(`assignments/${C}`)).toMatchObject({
        programId: `prg-${C}-1`,
        assignedBy: T,
      });
      // the version points at its own program; the plan follows it at publish
      expect((await w.fs.get(`plans/${C}/versions/1`))!.programId).toBe(`prg-${C}-1`);
      expect((await w.fs.get(`plans/${C}`))!.programId).toBe(`prg-${C}-1`);
    });

    it('publish -> client snapshot -> a session starts from the coached plan', async () => {
      const { w, port, clientPort } = await setup();
      const c = watch(clientPort);
      const v1 = draftWith('Upper/Lower 4x');
      await port.saveDraft(C, { draft: v1, trainerDays: [], baseRev: 0 });
      await port.send(C, { draft: v1, trainerDays: [], baseRev: 1 });
      const layer = (await until(() => c.get()?.program))!;
      expect(layer.version).toBe(1);
      __replaceStateForTests({ ...__getStateForTests(), workouts: [] });
      const assignment = await asAssignment(w);
      const wid = startProgramDaySession(assignment as never, 2, 'Upper A')!;
      expect(wid).toBeTruthy();
      const started = __getStateForTests().workouts.find((x) => x.id === wid)!;
      expect(started.exercises.map((e) => e.name)).toEqual(
        expect.arrayContaining(['Bent Over Barbell Row', 'Paused bench press']),
      );
      const row = started.exercises.find((e) => e.name === 'Bent Over Barbell Row')!;
      expect(row).toMatchObject({ plannedSets: 4, plannedReps: 8 });
      // the per-client targets come from the sealed layer, by exercise name
      expect(layer.targets['Bent Over Barbell Row']).toMatchObject({ kg: 70 });
      c.off();
    });

    it('Send twice (a retry after a failed publish) is idempotent: one program doc, same content', async () => {
      const { w, port } = await setup();
      const v1 = draftWith('Upper/Lower 4x');
      await port.saveDraft(C, { draft: v1, trainerDays: [], baseRev: 0 });
      let failOnce = true;
      const real = w.fs.call.bind(w.fs);
      w.fs.call = (async (name: string, data: Record<string, unknown>) => {
        if (name === 'publishPlanVersion' && failOnce) {
          failOnce = false;
          throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
        }
        return real(name, data);
      }) as typeof w.fs.call;
      await expect(port.send(C, { draft: v1, trainerDays: [], baseRev: 1 })).rejects.toMatchObject({
        code: 'offline',
      });
      // the program exists but nothing points at it: the member sees no half-published plan
      expect(w.fs.has(`programs/prg-${C}-1`)).toBe(true);
      expect(w.fs.has(`assignments/${C}`)).toBe(false);
      const b = await port.load(C, { signal: new AbortController().signal });
      const r = await port.send(C, { draft: v1, trainerDays: [], baseRev: b.rev });
      expect(r.version).toBe(1);
      expect(w.fs.keys('programs/').filter((k) => k.startsWith('programs/prg-'))).toEqual([
        `programs/prg-${C}-1`,
      ]);
      expect(await w.fs.get(`assignments/${C}`)).toMatchObject({ programId: `prg-${C}-1` });
    });

    it('version 2 moves the assignment, keeps startedAt, and removes the superseded program document', async () => {
      const { w, port } = await setup();
      const v1 = draftWith('Upper/Lower 4x');
      await port.saveDraft(C, { draft: v1, trainerDays: [], baseRev: 0 });
      const s1 = await port.send(C, { draft: v1, trainerDays: [], baseRev: 1 });
      const started = (await w.fs.get(`assignments/${C}`))!.startedAt;
      const bareId = v1.items.find((i) => i.name === 'Bent Over Barbell Row')!.id;
      const v2 = setRowMode(v1, bareId, true);
      await port.saveDraft(C, { draft: v2, trainerDays: [], baseRev: s1.rev });
      const b = await port.load(C, { signal: new AbortController().signal });
      await port.send(C, { draft: v2, trainerDays: [], baseRev: b.rev });
      expect(await w.fs.get(`assignments/${C}`)).toMatchObject({
        programId: `prg-${C}-2`,
        startedAt: started,
      });
      expect(w.fs.has(`programs/prg-${C}-1`)).toBe(false);
      const p2 = (await w.fs.get(`programs/prg-${C}-2`))!;
      const row = (p2.items as { name: string; bare?: boolean; sets: number }[]).find(
        (i) => i.name === 'Bent Over Barbell Row',
      )!;
      expect(row).toMatchObject({ bare: true, sets: 0 });
    });
  });
});
