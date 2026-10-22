import { describe, expect, it, vi } from 'vitest';
import { buildFixtureWorld } from '../__fixtures__/fixtures';
import { olehDraft } from '../../program/__fixtures__/fixtures';
import { ProgramPortError } from '../../program/types';
import { versionProgramId } from '../../program/planCodec';
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

async function setup(
  opts: {
    prime?: boolean;
    announce?: (
      cid: string,
      card: { id: string; version: number; summary: string },
    ) => Promise<void>;
    roster?: typeof roster;
  } = {},
) {
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
    roster: () => opts.roster ?? roster,
    ...(opts.announce ? { announce: opts.announce } : {}),
  });
  const clientPort = createFirestoreClientPort({
    fs: w.fs,
    vault: w.cv,
    uid: C,
    plan: { ringFor: w.clientBook.ringFor, ready: w.clientBook.ready },
  });
  return { w, port, clientPort };
}

const draftWith = (name: string) => ({ ...olehDraft(T), name });
const ac = () => ({ signal: new AbortController().signal });

describe('program port: who and what', () => {
  it('only a client on the trainer own roster has a program here; an invite or a stranger is forbidden and nothing is read', async () => {
    const inv = { ...roster[0], id: 'inv-1', invite: true } as never;
    const { w, port } = await setup({ roster: [roster[0], inv] as never });
    await expect(port.load('inv-1', ac())).rejects.toMatchObject({ code: 'forbidden' });
    await expect(port.load('stranger', ac())).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      port.saveDraft('stranger', { draft: draftWith('x'), trainerDays: [], baseRev: 0 }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      port.send('inv-1', { draft: draftWith('x'), trainerDays: [], baseRev: 0 }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    expect(
      w.fs.writes.filter((p) => p.startsWith('plans/stranger') || p.startsWith('plans/inv-1')),
    ).toEqual([]);
    expect(port.peek('stranger')).toBeNull();
  });

  it('an aborted load rejects as an abort, not as a port error', async () => {
    const { port } = await setup();
    const ctl = new AbortController();
    ctl.abort();
    await expect(port.load(C, { signal: ctl.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('a version that does not open (damaged) is left out of the history, the rest still loads', async () => {
    const { w, port } = await setup();
    await port.saveDraft(C, { draft: draftWith('A'), trainerDays: [], baseRev: 0 });
    w.fs.seed(`plans/${C}/versions/7`, {
      n: 7,
      state: 'live',
      keyEpoch: 1,
      enc: { v: 1, iv: 'AA', ct: 'AA' },
    });
    const b = await port.load(C, ac());
    expect(b.versions.map((v) => v.n)).toEqual([1]);
  });

  it('the plan of an epoch whose key this device does not hold is not opened with another key', async () => {
    const { w, port } = await setup();
    await port.saveDraft(C, { draft: draftWith('A'), trainerDays: [], baseRev: 0 });
    await w.fs.update(`plans/${C}`, { keyEpoch: 9 });
    const b = await port.load(C, ac());
    expect(b.rev).toBe(0); // treated as no plan, not as the plan sealed with the wrong ring
    expect(b.liveVersion).toBe(0);
  });

  it('the client acknowledgement notice shows as "seen" only when well formed', async () => {
    const { w, port } = await setup();
    expect((await port.load(C, ac())).seen).toBeNull();
    w.fs.seed(`users/${T}/notices/pa-${C}`, { ref: { version: 2 }, createdAt: 123 });
    expect((await port.load(C, ac())).seen).toEqual({ version: 2, at: 123 });
    w.fs.seed(`users/${T}/notices/pa-${C}`, { ref: { version: 0 }, createdAt: 123 });
    expect((await port.load(C, ac())).seen).toBeNull();
    w.fs.seed(`users/${T}/notices/pa-${C}`, { ref: { version: 2 }, createdAt: 'yesterday' });
    expect((await port.load(C, ac())).seen).toBeNull();
  });
});

describe('program port: errors', () => {
  const cases: [string, Record<string, unknown>, string][] = [
    ['rules refuse', { code: 'permission-denied' }, 'forbidden'],
    ['http 403', { status: 403 }, 'forbidden'],
    ['version race', { code: 'failed-precondition' }, 'conflict'],
    ['aborted tx', { code: 'aborted' }, 'conflict'],
    ['exists', { code: 'already-exists' }, 'conflict'],
    ['offline', { code: 'unavailable' }, 'offline'],
    ['deadline', { code: 'deadline-exceeded' }, 'offline'],
    ['no status at all', {}, 'offline'],
    ['503', { status: 503 }, 'offline'],
    ['gateway timeout', { status: 504 }, 'offline'],
    ['vault', { name: 'VaultLockedError' }, 'vault-locked'],
    ['no ring', { message: 'chat-key-missing' }, 'vault-locked'],
    ['server error', { status: 500 }, 'unavailable'],
  ];
  for (const [label, e, code] of cases) {
    it(`a write that fails with "${label}" is ${code}`, async () => {
      const { w, port } = await setup();
      w.fs.transact = async () => {
        throw Object.assign(new Error((e.message as string) ?? 'x'), e);
      };
      await expect(
        port.saveDraft(C, { draft: draftWith('A'), trainerDays: [], baseRev: 0 }),
      ).rejects.toMatchObject({ code });
    });
  }

  it('a failing load maps the same way and keeps a typed error as it is', async () => {
    const { w, port } = await setup();
    const real = w.fs.getDocs.bind(w.fs);
    w.fs.getDocs = async () => {
      throw Object.assign(new Error('x'), { code: 'permission-denied' });
    };
    await expect(port.load(C, ac())).rejects.toMatchObject({ code: 'forbidden' });
    w.fs.getDocs = real;
    w.fs.transact = async () => {
      throw new ProgramPortError('conflict');
    };
    await expect(
      port.saveDraft(C, { draft: draftWith('A'), trainerDays: [], baseRev: 0 }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });
});

describe('program port: send', () => {
  it('announces each sent version once with a stable id, and a failing announcement does not fail the send', async () => {
    const announce = vi.fn(async () => {
      throw new Error('chat down');
    });
    const { port } = await setup({ announce });
    const b = await port.load(C, ac());
    const out = await port.send(C, { draft: draftWith('A'), trainerDays: ['Tue'], baseRev: b.rev });
    expect(out.version).toBe(1);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(
      C,
      expect.objectContaining({ id: `pu-1-${C}`, version: 1 }),
    );
    expect(port.peek(C)).toMatchObject({ liveVersion: 1, draftVersion: 2, seen: null });
  });

  it('a refused publish is a port error and the plan still shows the old live version', async () => {
    const { w, port } = await setup();
    w.fs.onCall('publishPlanVersion', () => {
      throw Object.assign(new Error('no'), { code: 'permission-denied' });
    });
    const b = await port.load(C, ac());
    await expect(
      port.send(C, { draft: draftWith('A'), trainerDays: [], baseRev: b.rev }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    expect((await port.load(C, ac())).liveVersion).toBe(0);
  });
});

describe('program port: sharing with other clients', () => {
  it('copies a draft to a client on the same program; one the program is not shared with is refused; the library lists days of other clients only', async () => {
    const { port } = await setup();
    const b = await port.load(C, ac());
    await port.send(C, {
      draft: draftWith('Upper/Lower 4x'),
      trainerDays: ['Tue'],
      baseRev: b.rev,
    });
    expect(port.library(C)).toEqual([]); // nothing of other clients is opened yet
    await port.load('client-2', ac()).catch(() => undefined);
    const lib = port.library(C);
    for (const e of lib) {
      expect(e.clientId).not.toBe(C);
      expect(e.kind).toBe('client');
    }
    // library of the other client contains the days of the first one
    expect(port.library('client-2').every((e) => e.clientId === C)).toBe(true);
    expect(port.library('client-2').length).toBeGreaterThan(0);
    expect(port.library('client-2')[0]).toMatchObject({
      clientName: 'Oleh Bondar',
      name: 'Upper/Lower 4x',
    });
    await expect(port.copyTo(C, 'stranger')).rejects.toMatchObject({ code: 'forbidden' });
  });
});

describe('program port: a second version', () => {
  async function sendTwice() {
    const announce = vi.fn(async () => undefined);
    const s = await setup({ announce });
    const b1 = await s.port.load(C, ac());
    const one = await s.port.send(C, {
      draft: draftWith('First block'),
      trainerDays: ['Tue'],
      baseRev: b1.rev,
    });
    return { ...s, announce, one };
  }

  it('v2 is judged against the live v1: the version is numbered on, the old runnable program is removed, both announcements have their own id', async () => {
    const { w, port, announce, one } = await sendTwice();
    expect(await w.fs.get(`programs/${versionProgramId(C, 1)}`)).toBeTruthy();
    const two = await port.send(C, {
      draft: draftWith('Second block'),
      trainerDays: ['Tue', 'Fri'],
      baseRev: one.rev,
    });
    expect(two.version).toBe(2);
    expect(two.rev).toBeGreaterThan(one.rev);
    expect(await w.fs.get(`programs/${versionProgramId(C, 1)}`)).toBeFalsy();
    expect(await w.fs.get(`programs/${versionProgramId(C, 2)}`)).toBeTruthy();
    expect(
      announce.mock.calls.map((c) => (c as unknown as [string, { id: string }])[1].id),
    ).toEqual([`pu-1-${C}`, `pu-2-${C}`]);
    expect(port.peek(C)).toMatchObject({
      liveVersion: 2,
      draftVersion: 3,
      trainerDays: ['Tue', 'Fri'],
    });
  });

  it('the same base revision cannot be used twice: the second writer gets a conflict and the plan is unchanged', async () => {
    const { w, port, one } = await sendTwice();
    const before = JSON.stringify(await w.fs.get(`plans/${C}`));
    await port.saveDraft(C, { draft: draftWith('Mine'), trainerDays: [], baseRev: one.rev });
    await expect(
      port.saveDraft(C, { draft: draftWith('Theirs'), trainerDays: [], baseRev: one.rev }),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(JSON.stringify(await w.fs.get(`plans/${C}`))).not.toBe(before);
  });

  it('a version number that is already published is never overwritten by a draft', async () => {
    const { w, port, one } = await sendTwice();
    await w.fs.update(`plans/${C}/versions/2`, { state: 'live' }).catch(async () => {
      await w.fs.set(`plans/${C}/versions/2`, { state: 'live' } as never);
    });
    await expect(
      port.saveDraft(C, { draft: draftWith('X'), trainerDays: [], baseRev: one.rev }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('when the live version was sealed for a key epoch this device does not hold, writing the next one is refused as locked', async () => {
    const { w, port, one } = await sendTwice();
    await w.fs.update(`plans/${C}/versions/1`, { keyEpoch: 99 });
    await expect(
      port.saveDraft(C, { draft: draftWith('Next'), trainerDays: [], baseRev: one.rev }),
    ).rejects.toMatchObject({ code: 'vault-locked' });
  });

  it('nothing the trainer typed is readable in the plan or version documents', async () => {
    const { w } = await sendTwice();
    const raw = JSON.stringify([
      await w.fs.get(`plans/${C}`),
      await w.fs.get(`plans/${C}/versions/1`),
    ]);
    expect(raw).not.toContain('First block');
    expect(raw).not.toContain('Paused bench');
    expect(raw).not.toContain('Barbell');
  });

  it("the runnable program the client's app reads carries structure only: no target weights, RPE, rest times or trainer notes", async () => {
    const { w, one } = await sendTwice();
    expect(one.version).toBe(1);
    const run = JSON.stringify(await w.fs.get(`programs/${versionProgramId(C, 1)}`));
    expect(run).toContain('Paused bench press');
    for (const k of ['targetWeight', 'targetRpe', 'restSec', '"note"'])
      expect(run).not.toContain(k);
    // while the sealed version document does hold the full program for the trainer
    const sealed = await w.fs.get(`plans/${C}/versions/1`);
    expect(JSON.stringify(sealed)).not.toContain('Paused bench press');
  });

  it('when the server has not flipped the version yet the cached revision still moves past the draft write', async () => {
    const { w, port } = await setup();
    w.fs.onCall('publishPlanVersion', () => ({ liveVersion: 1 }));
    const b = await port.load(C, ac());
    const out = await port.send(C, { draft: draftWith('A'), trainerDays: [], baseRev: b.rev });
    expect(out).toEqual({ version: 1, rev: b.rev + 2 });
  });

  it('copying to a client who has no conversation key yet is refused as locked and writes nothing for that client', async () => {
    const { w, port } = await setup();
    const b = await port.load(C, ac());
    await port.saveDraft(C, { draft: draftWith('Shared plan'), trainerDays: [], baseRev: b.rev });
    await expect(port.copyTo(C, 'client-2')).rejects.toMatchObject({ code: 'vault-locked' });
    expect(await w.fs.get('plans/client-2')).toBeFalsy();
    expect(await w.fs.getDocs('plans/client-2/versions', {})).toEqual([]);
  });
});
