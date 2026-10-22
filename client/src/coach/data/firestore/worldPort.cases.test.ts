import { describe, expect, it, vi } from 'vitest';
import { VaultLockedError } from '../../../coachCrypto/sealOrThrow';
import { readyVault, unsetVault } from '../../../testVault';
import { dismissSignal, emptyBook, recordProgramDecision } from '../../domain/decisions';
import { buildOptions } from '../../domain/diff';
import { detectSignals } from '../../domain/signals';
import { WEEK } from '../../domain/time';
import { consent } from '../../domain/testBuilders';
import { buildFixtureWorld, FIXTURE_NOW } from '../__fixtures__/fixtures';
import { PortError, type WorldData } from '../port';
import { createMemoryFs, type MemoryFs } from './memoryFs';
import type { RosterClient, RosterInvite } from './worldMap';
import { createFirestoreWorldPort, type FirestoreWorldDeps } from './worldPort';

const NOW = 1_800_000_000_000;
const T = 'trainer-1';
const ac = () => ({ signal: new AbortController().signal });

const rc = (id: string, over: Partial<RosterClient> = {}): RosterClient => ({
  clientId: id,
  name: `Name ${id}`,
  status: 'active',
  mode: 'app',
  consent: consent({ totals: 'full', sets: 'effects' }),
  consentVersion: 1,
  keyEpoch: 1,
  cid: `cid-${id}`,
  ...over,
});
const inv = (id: string): RosterInvite => ({
  inviteId: id,
  name: `Invitee ${id}`,
  mode: 'app',
  sentAt: NOW - 1000,
  expiresAt: NOW + 86_400_000,
});
const emptyRead = { results: { totals: { state: 'locked' } }, grant: null };

async function setup(
  clients: RosterClient[] = [rc('c1')],
  invites: RosterInvite[] = [],
  over: Partial<FirestoreWorldDeps> = {},
) {
  const fs: MemoryFs = createMemoryFs(NOW);
  const vault = await readyVault();
  const reads: Record<string, unknown>[] = [];
  fs.onCall('coachClients', () => ({ clients, invites, serverTime: NOW }));
  fs.onCall('coachRead', (d) => {
    reads.push(d);
    return emptyRead;
  });
  const port = createFirestoreWorldPort({
    fs,
    vault,
    trainer: { id: T, name: 'Iryna' },
    loadOwnCoachKey: async () => null,
    ...over,
  });
  return { fs, vault, port, reads };
}

async function aDecision() {
  const w = buildFixtureWorld();
  const sig = detectSignals(w.inputs, FIXTURE_NOW).find((s) => s.clientId === 'c1')!;
  const book = recordProgramDecision(emptyBook(), {
    id: 'dec-1',
    signal: sig,
    option: buildOptions(sig).find((o) => o.suggested)!,
    now: FIXTURE_NOW,
    message: 'private-coach-message-77',
  });
  return { sig, book };
}

describe('load: the roster and the consent-gated reads', () => {
  it('lists active clients and pending invites; only active ones are read, and only consented categories are asked for', async () => {
    const { port, reads } = await setup(
      [
        rc('c1', { consent: consent({ totals: 'full', sets: 'effects' }) }),
        rc('c2', { status: 'pending' }),
        rc('c3', { consent: consent({ injury: 'full' }) }),
      ],
      [inv('i1')],
    );
    const w = await port.load(ac());
    expect(w.clients.map((c) => c.id)).toEqual(['c1', 'c3', 'i1']);
    expect(w.clients.find((c) => c.id === 'i1')?.name).toBe('Invitee i1');
    const byClient = Object.fromEntries(reads.map((r) => [r.clientId, r]));
    expect(byClient.c1).toMatchObject({ categories: ['totals', 'sets'], via: 'queue' });
    expect(byClient.c3).toMatchObject({ categories: ['injury'], via: 'queue' });
    expect(byClient.c2).toBeUndefined();
    expect(w.asOf).toBe(NOW);
    expect(port.peek()?.data).toBe(w);
    expect(port.peek()?.fetchedAt).toBe(NOW);
  });

  it('a program-only client, or one that shares nothing, is never read', async () => {
    const { port, reads } = await setup([
      rc('p1', { mode: 'program' }),
      rc('off', { consent: consent() }),
    ]);
    const w = await port.load(ac());
    expect(reads).toEqual([]);
    expect(w.clients.map((c) => c.id)).toEqual(['p1', 'off']);
  });

  it('reads in batches of the configured width and keeps every client', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const { port, reads } = await setup(
      ids.map((i) => rc(i)),
      [],
      { concurrency: 2 },
    );
    const w = await port.load(ac());
    expect(w.clients.map((c) => c.id)).toEqual(ids);
    expect(reads).toHaveLength(5);
  });

  it('one client failing to read does not blank the dashboard; a 403 (consent withdrawn mid-flight) does fail the load', async () => {
    const { fs, port } = await setup([rc('c1'), rc('c2')]);
    fs.onCall('coachRead', (d) => {
      if (d.clientId === 'c1') throw new Error('boom');
      return emptyRead;
    });
    expect((await port.load(ac())).clients.map((c) => c.id)).toEqual(['c1', 'c2']);

    fs.onCall('coachRead', () => {
      throw Object.assign(new Error('forbidden'), { status: 403 });
    });
    await expect(port.load(ac())).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('maps a roster failure to a port error and an aborted load to a timeout', async () => {
    const a = await setup();
    a.fs.onCall('coachClients', () => {
      throw Object.assign(new Error('x'), { status: 503 });
    });
    await expect(a.port.load(ac())).rejects.toMatchObject({ code: 'offline' });

    const b = await setup();
    const ctl = new AbortController();
    b.fs.onCall('coachClients', () => {
      ctl.abort();
      return { clients: [rc('c1')], invites: [], serverTime: NOW };
    });
    await expect(b.port.load({ signal: ctl.signal })).rejects.toBeInstanceOf(PortError);
    await expect(b.port.load({ signal: ctl.signal })).rejects.toMatchObject({ code: 'timeout' });
  });

  it('the assigned program and week come from plaintext documents of THIS trainer only', async () => {
    const { fs, port } = await setup([rc('c1'), rc('c2'), rc('c3')]);
    fs.seed('programs/p-mine', { authorId: T, name: 'Block A', weeks: 4 });
    fs.seed('programs/p-other', { authorId: 'someone-else', name: 'Not mine', weeks: 8 });
    fs.seed('assignments/c1', { programId: 'p-mine', startedAt: NOW - 2 * WEEK - 1000 });
    fs.seed('assignments/c2', { programId: 'p-mine', startedAt: NOW - 30 * WEEK });
    fs.seed('assignments/c3', { programId: 'p-other', startedAt: NOW });
    const w = await port.load(ac());
    const by = Object.fromEntries(w.clients.map((c) => [c.id, c]));
    expect([by.c1.program, by.c1.programWeek]).toEqual(['Block A', 3]);
    expect(by.c2.programWeek).toBe(4); // clamped to the program length
    expect([by.c3.program, by.c3.programWeek]).toEqual(['', 0]); // another trainer's program is not shown
  });

  it('an assignment with no start date counts as week 1, a program without length is uncapped', async () => {
    const { fs, port } = await setup([rc('c1'), rc('c2')]);
    fs.seed('programs/pa', { authorId: T, name: 'A' });
    fs.seed('programs/pb', { authorId: T, name: 'B', weeks: 6 });
    fs.seed('assignments/c1', { programId: 'pa', startedAt: NOW - 9 * WEEK });
    fs.seed('assignments/c2', { programId: 'pb', startedAt: 'never' });
    const by = Object.fromEntries((await port.load(ac())).clients.map((c) => [c.id, c]));
    expect(by.c1.programWeek).toBe(10);
    expect(by.c2.programWeek).toBe(1);
  });

  it('a failing programs query leaves the roster as it was', async () => {
    const { fs, port } = await setup([rc('c1')]);
    const real = fs.getDocs.bind(fs);
    fs.getDocs = async (c, q) => {
      if (c === 'programs') throw new Error('denied');
      return real(c, q);
    };
    const w = await port.load(ac());
    expect(w.clients[0].program).toBe('');
  });

  it('a failing assignment read leaves that client without a program, the others keep theirs', async () => {
    const { fs, port } = await setup([rc('c1'), rc('c2')]);
    fs.seed('programs/pa', { authorId: T, name: 'A', weeks: 5 });
    fs.seed('assignments/c2', { programId: 'pa', startedAt: NOW });
    const real = fs.get.bind(fs);
    fs.get = async (p) => {
      if (p === 'assignments/c1') throw new Error('denied');
      return real(p);
    };
    const by = Object.fromEntries((await port.load(ac())).clients.map((c) => [c.id, c]));
    expect(by.c1.program).toBe('');
    expect(by.c2.program).toBe('A');
  });

  it('joins the schedule when it answers, and loads without it when it fails', async () => {
    const sched = vi.fn(async () => null);
    const a = await setup([rc('c1')], [], { schedule: sched });
    await a.port.load(ac());
    expect(sched).toHaveBeenCalledTimes(1);
    const b = await setup([rc('c1')], [], {
      schedule: async () => {
        throw new Error('no key yet');
      },
    });
    expect((await b.port.load(ac())).clients).toHaveLength(1);
  });

  it('notifies subscribers after each load until they unsubscribe', async () => {
    const { port } = await setup();
    const on = vi.fn();
    const off = port.subscribe!(on);
    await port.load(ac());
    expect(on).toHaveBeenCalledTimes(1);
    off();
    await port.load(ac());
    expect(on).toHaveBeenCalledTimes(1);
  });
});

describe('the on-device snapshot', () => {
  const snapshot = (): { data: WorldData; fetchedAt: number } => ({
    data: {
      asOf: 5,
      trainer: { id: T, name: 'Iryna' },
      clients: [],
      inputs: [],
      slots: [],
      book: emptyBook(),
      history: {},
    } as unknown as WorldData,
    fetchedAt: 5,
  });

  it('hydrate adopts a stored snapshot, a later load replaces it and is written back', async () => {
    const set = vi.fn(async () => undefined);
    const snap = snapshot();
    const { port } = await setup([rc('c1')], [], { cache: { get: async () => snap, set } });
    await port.hydrate!();
    expect(port.peek()).toBe(snap);
    const w = await port.load(ac());
    expect(port.peek()?.data).toBe(w);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ fetchedAt: NOW }));
  });

  it('a snapshot that arrives after a live load never overwrites it', async () => {
    let release!: (v: ReturnType<typeof snapshot>) => void;
    const slow = new Promise<ReturnType<typeof snapshot>>((r) => (release = r));
    const { port } = await setup([rc('c1')], [], {
      cache: { get: () => slow, set: async () => undefined },
    });
    const w = await port.load(ac());
    release(snapshot());
    await port.hydrate!();
    expect(port.peek()?.data).toBe(w);
  });

  it('a broken or failing cache is ignored (load still works and never rejects on the write)', async () => {
    const { port } = await setup([rc('c1')], [], {
      cache: {
        get: async () => {
          throw new Error('corrupt');
        },
        set: async () => {
          throw new Error('quota');
        },
      },
    });
    await expect(port.hydrate!()).resolves.toBeUndefined();
    await expect(port.load(ac())).resolves.toBeDefined();
  });
});

describe('decisions: sealed book', () => {
  it('saves a decision sealed, loads it back on a fresh port, and never writes the message in the clear', async () => {
    const { fs, vault, port } = await setup();
    const { book } = await aDecision();
    await port.save({ t: 'undo', id: 'x' }, book);
    const paths = fs.keys(`users/${T}/decisions`);
    expect(paths).toContain(`users/${T}/decisions/dec-1`);
    expect(paths.some((p) => p.includes('/evidence/'))).toBe(true);
    expect(fs.has(`users/${T}/meta/signalState`)).toBe(true);
    expect(fs.dump()).not.toContain('private-coach-message-77');

    const again = createFirestoreWorldPort({
      fs,
      vault,
      trainer: { id: T, name: 'Iryna' },
      loadOwnCoachKey: async () => null,
    });
    const w = await again.load(ac());
    expect(w.book.decisions.map((d) => [d.id, d.message])).toEqual([
      ['dec-1', 'private-coach-message-77'],
    ]);
  });

  it('lists the newest decision first', async () => {
    const { fs, vault, port } = await setup();
    const { sig, book } = await aDecision();
    const opt = buildOptions(sig).find((o) => o.suggested)!;
    const two = recordProgramDecision(book, {
      id: 'dec-2',
      signal: { ...sig, key: `${sig.key}-b` },
      option: opt,
      now: FIXTURE_NOW + 60_000,
      message: 'later',
    });
    await port.save({ t: 'undo', id: 'x' }, two);
    const fresh = createFirestoreWorldPort({
      fs,
      vault,
      trainer: { id: T, name: 'Iryna' },
      loadOwnCoachKey: async () => null,
    });
    expect((await fresh.load(ac())).book.decisions.map((d) => d.id)).toEqual(['dec-2', 'dec-1']);
  });

  it('writes only what changed, and removes a decision with its evidence when it leaves the book', async () => {
    const { fs, port } = await setup();
    const { book } = await aDecision();
    await port.save({ t: 'undo', id: 'x' }, book);
    const before = fs.writes.length;
    await port.save({ t: 'undo', id: 'x' }, book);
    // only the (always rewritten) signal state: no decision, no evidence document is rewritten
    expect(fs.writes.slice(before).filter((p) => p.includes('/decisions/'))).toEqual([]);
    await port.save({ t: 'undo', id: 'dec-1' }, emptyBook());
    expect(fs.keys(`users/${T}/decisions`)).toEqual([]);
  });

  it('a stored decision that does not open (another key) is dropped, never shown', async () => {
    const a = await setup();
    const { book } = await aDecision();
    await a.port.save({ t: 'undo', id: 'x' }, book);
    // the same documents read by someone holding another vault key
    const other = createFirestoreWorldPort({
      fs: a.fs,
      vault: await readyVault(),
      trainer: { id: T, name: 'Iryna' },
      loadOwnCoachKey: async () => null,
    });
    const w = await other.load(ac());
    expect(w.book.decisions).toEqual([]);
    expect(w.book.snoozed).toEqual({});
  });

  it('snoozed / dismissed state survives a reload (sealed signal state)', async () => {
    const { fs, vault, port } = await setup();
    const { sig } = await aDecision();
    const book = dismissSignal(emptyBook(), 'dec-9', sig, 'wrong-data', FIXTURE_NOW);
    await port.save(
      { t: 'dismiss', id: 'dec-9', signal: sig, reason: 'wrong-data', now: FIXTURE_NOW },
      book,
    );
    const again = createFirestoreWorldPort({
      fs,
      vault,
      trainer: { id: T, name: 'Iryna' },
      loadOwnCoachKey: async () => null,
    });
    const w = await again.load(ac());
    expect(w.book.decisions[0].reason).toBe('wrong-data');
    expect(Object.keys(w.book.dismissed)).toEqual(Object.keys(book.dismissed));
  });

  it('with a locked vault nothing is written and the load fails as vault-locked', async () => {
    const fs = createMemoryFs(NOW);
    fs.onCall('coachClients', () => ({ clients: [], invites: [], serverTime: NOW }));
    const port = createFirestoreWorldPort({
      fs,
      vault: await unsetVault(),
      trainer: { id: T, name: 'Iryna' },
      loadOwnCoachKey: async () => null,
    });
    const { book } = await aDecision();
    await expect(port.save({ t: 'undo', id: 'x' }, book)).rejects.toBeInstanceOf(VaultLockedError);
    expect(fs.writes).toEqual([]);
    await expect(port.load(ac())).rejects.toMatchObject({ code: 'vault-locked' });
  });

  it('a failing batch is a port error and the decision is retried (not marked saved) on the next save', async () => {
    const { fs, port } = await setup();
    const { book } = await aDecision();
    fs.failWrites('unavailable');
    await expect(port.save({ t: 'undo', id: 'x' }, book)).rejects.toMatchObject({
      code: 'offline',
    });
    fs.failWrites(null);
    await port.save({ t: 'undo', id: 'x' }, book);
    expect(fs.has(`users/${T}/decisions/dec-1`)).toBe(true);
  });
});

describe('ending the coaching', () => {
  it('asks the server to end it for that client and drops the delta cache of that client', async () => {
    const set = vi.fn(async () => undefined);
    const deltaCache = vi.fn(() => ({ get: async () => null, set }));
    const { fs, port } = await setup([rc('c1')], [], { deltaCache: deltaCache as never });
    fs.onCall('coachEnd', () => ({ ok: true }));
    await port.endCoaching!('c1');
    expect(fs.calls.filter((c) => c.name === 'coachEnd')).toEqual([
      { name: 'coachEnd', data: { clientId: 'c1' } },
    ]);
    expect(deltaCache).toHaveBeenCalledWith('c1');
    expect(set).toHaveBeenCalledTimes(1);
  });

  it('a refused end is a port error', async () => {
    const { fs, port } = await setup();
    fs.onCall('coachEnd', () => {
      throw Object.assign(new Error('no'), { status: 403 });
    });
    await expect(port.endCoaching!('c1')).rejects.toMatchObject({ code: 'forbidden' });
  });
});
