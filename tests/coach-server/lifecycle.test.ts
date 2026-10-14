import { beforeEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { createMemoryKv, type MemoryKv } from '../../functions/src/coach/memoryKv';
import {
  CoachError,
  addSealedNote,
  coachAccept,
  coachExport,
  coachInvite,
  type Actor,
  type Ctx,
} from '../../functions/src/coach/service';
import {
  adminAssignTrainer,
  adoptMyLegacyTrainer,
  adoptLegacyClientsOf,
  endTrainerRelationships,
  migrateLegacyRelationships,
  purgeAccountCoaching,
} from '../../functions/src/coach/lifecycle';
import { legacyCut, canSeeFull, canSeeSummary } from '../../functions/src/coach/legacy';
import { conversationId, ckEnvelopeProblem, legacyLevel } from '../../functions/src/coach/logic';
import { inviteTokenOf, inviteUrl, normalizeOrigin } from '../../functions/src/coach/inviteLink';
import { vaultKeyFor, vaultKeyHandler } from '../../functions/src/vault';

const T0 = Date.UTC(2026, 9, 10, 9, 0, 0);
const PEPPER = randomBytes(32);
const trainer: Actor = { uid: 't1', role: 'trainer' };
const admin: Actor = { uid: 'a1', role: 'admin' };
const client: Actor = { uid: 'c1', role: 'member' };
let kv: MemoryKv;
let n = 0;
const ctx = (): Ctx => ({
  kv,
  now: () => T0,
  pepper: PEPPER,
  newToken: () => `tok${(++n).toString().padStart(12, '0')}`,
  notify: async () => undefined,
});
const CID = conversationId(PEPPER, 'c1', 't1');
const enc = { v: 1, iv: 'A'.repeat(16), ct: 'C'.repeat(120) };
async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof CoachError) return `${e.code}:${e.reason}`;
    throw e;
  }
  return 'ok';
}
async function link(consent: Record<string, string> = { totals: 'full' }) {
  const inv = await coachInvite(ctx(), trainer, { name: 'Oleh', mode: 'app', request: consent });
  await coachAccept(ctx(), client, { token: inv.inviteId, consent });
}
beforeEach(async () => {
  kv = createMemoryKv();
  n = 0;
  for (const [id, role] of [
    ['t1', 'trainer'],
    ['t2', 'trainer'],
    ['a1', 'admin'],
    ['c1', 'member'],
    ['c2', 'member'],
  ])
    await kv.set(`users/${id}`, {
      role,
      status: 'active',
      firstName: id,
      username: id,
      trainerId: null,
    });
});

describe('legacy callables use the coaching consent (item 1)', () => {
  it('an active coach gets exactly the consented levels; everyone else gets nothing', async () => {
    await link({ totals: 'full', sets: 'effects' });
    const cut = await legacyCut(kv, 't1', 'c1');
    expect(cut?.coach).toBe(true);
    expect(canSeeFull(cut, 'totals')).toBe(true);
    expect(canSeeFull(cut, 'sets')).toBe(false);
    expect(canSeeSummary(cut, 'sets')).toBe(true);
    expect(canSeeSummary(cut, 'body')).toBe(false);
    expect((await legacyCut(kv, 'c1', 'c1')) === null).toBe(true); // self: no cut
    const stranger = await legacyCut(kv, 't2', 'c1');
    expect(stranger?.coach).toBe(false);
    expect(canSeeSummary(stranger, 'totals')).toBe(false);
    const adm = await legacyCut(kv, 'a1', 'c1'); // an admin has no bypass
    expect(adm?.coach).toBe(false);
    expect(canSeeSummary(adm, 'totals')).toBe(false);
  });
  it('program mode and ended relationships are off', () => {
    const base = { trainerId: 't1', consent: { totals: 'full' } } as never;
    expect(
      legacyLevel({ ...(base as object), status: 'active', mode: 'app' } as never, 't1', 'totals'),
    ).toBe('full');
    expect(
      legacyLevel(
        { ...(base as object), status: 'active', mode: 'program' } as never,
        't1',
        'totals',
      ),
    ).toBe('off');
    expect(
      legacyLevel({ ...(base as object), status: 'ended', mode: 'app' } as never, 't1', 'totals'),
    ).toBe('off');
    expect(legacyLevel(null, 't1', 'totals')).toBe('off');
  });
});

describe('sealed trainer notes (item 1)', () => {
  const body = (o: Record<string, unknown> = {}) => ({
    id: 'c1',
    noteId: 'n1',
    at: T0,
    keyEpoch: 1,
    enc,
    ...o,
  });
  beforeEach(async () => {
    await link();
    await kv.merge(`conversations/${CID}`, { keyEpoch: 1 });
  });
  it('stores only the envelope, once, and refuses plaintext, bad envelopes and skewed time', async () => {
    expect(await addSealedNote(ctx(), trainer, body())).toMatchObject({ ok: true, already: false });
    expect(await addSealedNote(ctx(), trainer, body())).toMatchObject({ already: true });
    const stored = await kv.get(`conversations/${CID}/notes/n1`);
    expect(Object.keys(stored ?? {}).sort()).toEqual([
      'at',
      'by',
      'enc',
      'id',
      'keyEpoch',
      'updatedAt',
    ]);
    expect(await code(addSealedNote(ctx(), trainer, body({ noteId: 'n2', text: 'knee' })))).toBe(
      'failed-precondition:use-sealed-notes',
    );
    expect(
      await code(
        addSealedNote(ctx(), trainer, body({ noteId: 'n3', enc: { v: 1, iv: 'x', ct: 'y' } })),
      ),
    ).toBe('invalid-argument:not-sealed');
    expect(await code(addSealedNote(ctx(), trainer, body({ noteId: 'n4', enc: undefined })))).toBe(
      'invalid-argument:not-sealed',
    );
    expect(
      await code(addSealedNote(ctx(), trainer, body({ noteId: 'n5', at: T0 - 121_000 }))),
    ).toBe('invalid-argument:bad-time');
    expect(await code(addSealedNote(ctx(), trainer, body({ noteId: 'n6', keyEpoch: 9 })))).toBe(
      'failed-precondition:stale-epoch',
    );
    expect(
      await code(addSealedNote(ctx(), { uid: 't2', role: 'trainer' }, body({ noteId: 'n7' }))),
    ).not.toBe('ok');
  });
  it('envelope check bounds', () => {
    expect(ckEnvelopeProblem(enc)).toBeNull();
    expect(ckEnvelopeProblem({ ...enc, ct: 'C'.repeat(20_000) })).toBe('too-large');
    expect(ckEnvelopeProblem({ ...enc, extra: 1 })).toBe('bad-envelope');
  });
});

describe('demotion, deletion and admin assignment (items 2, 6, 11)', () => {
  it('endTrainerRelationships ends every active relationship of the trainer', async () => {
    await link();
    expect(await endTrainerRelationships(ctx(), 't1')).toBe(1);
    expect((await kv.get('coaching/c1'))?.status).toBe('ended');
    expect(await endTrainerRelationships(ctx(), 't1')).toBe(0);
  });
  it('purgeAccountCoaching removes the account from every coaching collection', async () => {
    await link();
    await kv.set(`conversations/${CID}/messages/m1`, { id: 'm1', from: 'c1', at: T0, enc });
    await kv.set(`conversations/${CID}/notes/n1`, { id: 'n1', enc });
    await kv.set(`rateLimits/${CID}_c1`, { hits: {}, updatedAt: T0 });
    await kv.set('users/c1/audit/x', { at: T0 });
    await kv.set('users/t1/clientNotes/cn1', { clientId: 'c1', enc: {} });
    await kv.set('users/t1/decisions/d1', { clientId: 'c1' });
    await kv.set('users/t1/decisions/d1/evidence/sets', { enc: {} });
    await kv.set('plans/c1', { clientId: 'c1' });
    await kv.set('plans/c1/versions/1', { n: 1 });
    await kv.set('schedules/c1', { clientId: 'c1' });
    await kv.set('liveSessions/c1', { id: 'c1' });
    await kv.set('signKeys/c1/keys/k1', {});
    const rep = await purgeAccountCoaching(ctx(), 'c1');
    expect(rep.conversations).toBe(1);
    for (const p of [
      'coaching/c1',
      `conversations/${CID}`,
      `conversations/${CID}/messages/m1`,
      `conversations/${CID}/notes/n1`,
      `rateLimits/${CID}_c1`,
      'users/t1/clientNotes/cn1',
      'users/t1/decisions/d1',
      'users/t1/decisions/d1/evidence/sets',
      'plans/c1',
      'plans/c1/versions/1',
      'schedules/c1',
      'liveSessions/c1',
      'signKeys/c1/keys/k1',
    ])
      expect(kv.has(p), p).toBe(false);
    // the entries OTHER users hold about reads of this client's data stay with their owners
    expect(kv.has('users/c1/audit/x')).toBe(true);
    expect(await code(purgeAccountCoaching(ctx(), 'bad/uid'))).toBe('invalid-argument:bad-user');
  });
  it('deleting the trainer ends their relationships first', async () => {
    await link();
    await purgeAccountCoaching(ctx(), 't1');
    expect(kv.has('coaching/c1')).toBe(false); // ended first, then the pointer at the deleted trainer is removed
  });
  it('adminAssignTrainer creates a targeted invite (no relationship until the client accepts) and is idempotent', async () => {
    expect(await code(adminAssignTrainer(ctx(), trainer, { id: 'c1', trainerId: 't1' }))).toBe(
      'permission-denied:not-allowed',
    );
    const r = await adminAssignTrainer(ctx(), admin, { id: 'c1', trainerId: 't1' });
    expect(r).toMatchObject({ ok: true, pending: true });
    expect(await kv.get('coaching/c1')).toBeNull();
    expect((await kv.get('users/c1'))?.trainerId).toBeNull();
    const again = await adminAssignTrainer(ctx(), admin, { id: 'c1', trainerId: 't1' });
    expect(again.inviteId).toBe(r.inviteId);
    await coachAccept(ctx(), client, { token: r.inviteId });
    expect((await kv.get('coaching/c1'))?.trainerId).toBe('t1');
    expect(await adminAssignTrainer(ctx(), admin, { id: 'c1', trainerId: 't1' })).toMatchObject({
      already: true,
    });
    // switching trainer ends the old relationship
    const sw = await adminAssignTrainer(ctx(), admin, { id: 'c1', trainerId: 't2' });
    expect(sw.pending).toBe(true);
    expect((await kv.get('coaching/c1'))?.status).toBe('ended');
    expect(await adminAssignTrainer(ctx(), admin, { id: 'c1', trainerId: null })).toMatchObject({
      ok: true,
    });
    await kv.merge('users/c2', { role: 'member' });
    expect(await code(adminAssignTrainer(ctx(), admin, { id: 'c1', trainerId: 'c2' }))).toBe(
      'failed-precondition:trainer-unavailable',
    );
    await kv.merge('users/t2', { status: 'suspended' });
    expect(await code(adminAssignTrainer(ctx(), admin, { id: 'c1', trainerId: 't2' }))).toBe(
      'failed-precondition:trainer-unavailable',
    );
  });
});

describe('export grant is issued and logged on the server (item 8)', () => {
  it('release:false audits only categories the client allows, nothing otherwise', async () => {
    await link({ totals: 'full' });
    const r = await coachExport(ctx(), trainer, {
      clientIds: ['c1', 'c2'],
      categories: ['totals', 'sets'],
      release: false,
    });
    expect(r.clients).toEqual({ c1: ['totals'] });
    expect(r.exportId.startsWith('ex-')).toBe(true);
    const logs = await kv.list('users/c1/audit');
    expect(logs.length).toBe(1);
    expect(logs[0].data).toMatchObject({ readerId: 't1', subjectId: 'c1', via: 'export' });
    expect(await kv.list('users/c2/audit')).toEqual([]);
    expect(
      await code(coachExport(ctx(), client, { clientIds: ['c1'], categories: ['totals'] })),
    ).toBe('permission-denied:not-a-coach');
    expect(
      await code(coachExport(ctx(), trainer, { clientIds: ['c1'], categories: ['nope'] })),
    ).toBe('invalid-argument:invalid-categories');
    expect(await code(coachExport(ctx(), trainer, { clientIds: [], categories: ['totals'] }))).toBe(
      'invalid-argument:bad-client',
    );
  });
});

describe('legacy relationship backfill (item 12, Q-19)', () => {
  beforeEach(async () => {
    await kv.merge('users/c1', { trainerId: 't1' });
    await kv.merge('users/c2', { trainerId: 'ghost' });
  });
  it('dry run writes nothing; the real run creates consent-off app relationships; a re-run changes nothing', async () => {
    const before = kv.dump();
    const dry = await migrateLegacyRelationships(ctx(), {});
    expect(dry.dryRun).toBe(true);
    expect(dry.counts.created).toBe(1);
    expect(dry.counts['trainer-unavailable']).toBe(1);
    expect(kv.dump()).toBe(before);
    const run = await migrateLegacyRelationships(ctx(), { dryRun: false });
    expect(run.counts.created).toBe(1);
    expect(await kv.get('coaching/c1')).toMatchObject({
      trainerId: 't1',
      status: 'active',
      mode: 'app',
      migratedFrom: 'legacy-trainerId',
      consent: expect.objectContaining({ totals: 'off', sets: 'off' }),
    });
    expect(kv.has(`conversations/${CID}`)).toBe(true);
    expect(kv.has('coaching/c2')).toBe(false);
    const after = kv.dump();
    const again = await migrateLegacyRelationships(ctx(), { dryRun: false });
    expect(again.counts.created).toBe(0);
    expect(again.counts['already-linked']).toBe(1);
    expect(kv.dump()).toBe(after);
  });
  it("the trainer's roster read adopts only THEIR legacy clients, never ends up twice, never revives an ended one", async () => {
    expect((await adoptLegacyClientsOf(ctx(), 't1')).created).toBe(1);
    expect(await kv.get('coaching/c1')).toMatchObject({
      trainerId: 't1',
      status: 'active',
      mode: 'app',
    });
    expect(kv.has('coaching/c2')).toBe(false); // c2 points at someone else
    expect((await adoptLegacyClientsOf(ctx(), 't1')).created).toBe(0);
    await kv.merge('coaching/c1', { status: 'ended' });
    expect((await adoptLegacyClientsOf(ctx(), 't1')).created).toBe(0);
    expect(await kv.get('coaching/c1')).toMatchObject({ status: 'ended' });
  });
  it('self-service adoption: a member adopts ONLY their own legacy pointer (consent off, idempotent, never someone else)', async () => {
    const r = await adoptMyLegacyTrainer(ctx(), client);
    expect(r).toMatchObject({ adopted: true, outcome: 'created', trainerId: 't1' });
    expect(await kv.get('coaching/c1')).toMatchObject({
      trainerId: 't1',
      mode: 'app',
      migratedFrom: 'legacy-trainerId',
      consent: expect.objectContaining({ totals: 'off', sets: 'off' }),
    });
    expect(kv.has('coaching/c2')).toBe(false); // the other legacy pointer is untouched
    const again = await adoptMyLegacyTrainer(ctx(), client);
    expect(again).toMatchObject({ adopted: false, outcome: 'already-linked', trainerId: 't1' });
    // a member without a pointer, and one whose trainer is gone
    await kv.merge('users/c1', { trainerId: null });
    expect(await adoptMyLegacyTrainer(ctx(), client)).toMatchObject({
      adopted: false,
      outcome: 'no-legacy-trainer',
      trainerId: null,
    });
    expect(await adoptMyLegacyTrainer(ctx(), { uid: 'c2', role: 'member' })).toMatchObject({
      adopted: false,
      outcome: 'trainer-unavailable',
    });
  });
  it('reconciles a pointer that disagrees with the coaching doc, skips suspended clients, and pages with after/limit', async () => {
    await link();
    await kv.merge('users/c1', { trainerId: 't2' });
    const r = await migrateLegacyRelationships(ctx(), { dryRun: false });
    expect(r.counts.reconciled).toBe(1);
    expect((await kv.get('users/c1'))?.trainerId).toBe('t1');
    await kv.merge('users/c2', { trainerId: 't2', status: 'suspended' });
    expect(
      (await migrateLegacyRelationships(ctx(), { dryRun: false })).counts['client-suspended'],
    ).toBe(1);
    const p1 = await migrateLegacyRelationships(ctx(), { limit: 2 });
    expect(p1.scanned).toBe(2);
    expect(p1.next).not.toBeNull();
    const p2 = await migrateLegacyRelationships(ctx(), { limit: 2, after: p1.next! });
    expect(p2.scanned).toBeGreaterThan(0);
  });
});

describe('vault key version, suspension and log (item 10)', () => {
  const master = randomBytes(32).toString('base64');
  it('v1 is stable, versions differ, and the handler logs without storing keys', async () => {
    expect(vaultKeyFor(master, 'c1').key).toBe(vaultKeyFor(master, 'c1', 1).key);
    expect(vaultKeyFor(master, 'c1', 2).key).not.toBe(vaultKeyFor(master, 'c1', 1).key);
    const r = await vaultKeyHandler(kv, { uid: 'c1', master, currentKv: 2, now: T0 });
    expect(r).toMatchObject({ kv: 2, current: 2 });
    const old = await vaultKeyHandler(kv, {
      uid: 'c1',
      master,
      currentKv: 2,
      requestedKv: 1,
      now: T0,
    });
    expect(old.key).toBe(vaultKeyFor(master, 'c1', 1).key);
    await vaultKeyHandler(kv, { uid: 'c1', master, currentKv: 2, now: T0 });
    const logs = await kv.list('users/c1/keyLog');
    expect(logs.length).toBe(2);
    expect(logs.find((l) => l.data.kv === 2)?.data.count).toBe(2);
    expect(JSON.stringify(logs)).not.toContain(r.key);
  });
  it('refuses suspended and unknown accounts, future versions, and a short master', async () => {
    await kv.merge('users/c2', { status: 'suspended' });
    await expect(vaultKeyHandler(kv, { uid: 'c2', master, currentKv: 1, now: T0 })).rejects.toThrow(
      /suspended/,
    );
    await expect(vaultKeyHandler(kv, { uid: 'zz', master, currentKv: 1, now: T0 })).rejects.toThrow(
      /not found/,
    );
    await expect(
      vaultKeyHandler(kv, { uid: 'c1', master, currentKv: 1, requestedKv: 2, now: T0 }),
    ).rejects.toThrow(/version/);
    await expect(
      vaultKeyHandler(kv, { uid: 'c1', master: 'AAAA', currentKv: 1, now: T0 }),
    ).rejects.toThrow(/not configured/);
  });
});

describe('invite link helper (item 4)', () => {
  it('builds <origin>/#/invite/<token> and round-trips, with a safe origin', () => {
    expect(inviteUrl('https://x.example/', 'abc_DEF-1')).toBe(
      'https://x.example/#/invite/abc_DEF-1',
    );
    expect(inviteTokenOf(inviteUrl('https://x.example', 'tok1'))).toBe('tok1');
    expect(normalizeOrigin('javascript:alert(1)')).toBe(normalizeOrigin(undefined));
    expect(normalizeOrigin('http://evil.example')).toBe(normalizeOrigin(undefined));
    expect(() => inviteUrl('https://x.example', '../x')).toThrow();
    expect(inviteTokenOf('https://x.example/i/abc')).toBeNull();
  });
});
