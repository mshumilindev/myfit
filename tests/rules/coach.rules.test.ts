/**
 * Firestore rules suite for the coaching collections (conversations, messages, notes, requests,
 * schedules, plans, versions, liveSessions extension, coach keys, trainer/client subcollections).
 *
 * Verified against the Firestore emulator (Java 21). Without the emulator the suite is SKIPPED.
 * Run: npm run test:rules (separate Node configuration, no application Firebase mocks).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const HOST = process.env.FIRESTORE_EMULATOR_HOST;
if (!HOST) {
  // Visible reason in the test report: this file is skipped, not green.
  describe('coach rules (SKIPPED: FIRESTORE_EMULATOR_HOST is not set; run via firebase emulators:exec)', () =>
    it.skip('emulator unavailable', () => {}));
}
const suite = describe.skipIf(!HOST);

const CID = 'abcdefghijklmnopqrstuvwxyz';
const CID2 = 'bcdefghijklmnopqrstuvwxyza';
const enc = (ct = 'A'.repeat(120)) => ({ v: 1, iv: 'A'.repeat(16), ct });
/** envelope under the owner's vault key (DEK): { v, salt, iv, ct } */
const dek = (ct = 'A'.repeat(40)) => ({ v: 1, salt: 'A'.repeat(24), iv: 'A'.repeat(16), ct });
const sealed = (extra: Record<string, unknown> = {}) => ({ keyEpoch: 1, enc: enc(), ...extra });
const ck = (epoch = 1) => ({
  v: 1,
  epoch,
  epk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y', ext: true, key_ops: [] },
  iv: 'A'.repeat(16),
  ct: 'A'.repeat(64),
  fp: 'a'.repeat(16),
});

suite('coach firestore rules (needs emulator)', () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let T: any; // RulesTestEnvironment
  let rt: any; // @firebase/rules-unit-testing
  let fs: any; // firebase/firestore
  /* eslint-enable @typescript-eslint/no-explicit-any */

  beforeAll(async () => {
    const rtName = '@firebase/rules-unit-testing'; // not installed yet: keep the import dynamic
    rt = await import(/* @vite-ignore */ rtName);
    fs = await import('firebase/firestore');
    const [host, port] = HOST!.split(':');
    T = await rt.initializeTestEnvironment({
      projectId: 'demo-spotter',
      firestore: {
        rules: readFileSync(resolve('firestore.rules'), 'utf8'),
        host,
        port: Number(port),
      },
    });
  });
  afterAll(async () => T?.cleanup());

  const as = (uid: string, role = 'member') => T.authenticatedContext(uid, { role }).firestore();
  const client = () => as('c1');
  const trainer = () => as('t1', 'trainer');
  const adminCoach = () => as('a1', 'admin'); // admin who coaches c2 themselves
  const stranger = () => as('x');
  const D = (db: unknown, ...p: string[]) => fs.doc(db, ...p);

  async function seed(
    over: {
      status?: string;
      active?: boolean;
      noCk?: boolean;
      trainerRole?: string;
      trainerStatus?: string;
    } = {},
  ) {
    await T.clearFirestore();
    await T.withSecurityRulesDisabled(async (ctx: { firestore(): unknown }) => {
      const db = ctx.firestore();
      const conv = (cid: string, c: string, t: string) =>
        fs.setDoc(D(db, 'conversations', cid), {
          clientId: c,
          trainerId: t,
          active: over.active ?? true,
          readUpTo: {},
          clearedBefore: {},
          createdAt: 1,
          lastAt: 1,
          ...(over.noCk ? {} : { ck: ck(), keyEpoch: 1 }),
        });
      // the LIVE user documents back the coach/admin privileges (stale token claims reach nothing, B-02)
      await fs.setDoc(D(db, 'users', 't1'), {
        role: over.trainerRole ?? 'trainer',
        status: over.trainerStatus ?? 'active',
      });
      await fs.setDoc(D(db, 'users', 'a1'), { role: 'admin', status: 'active' });
      await fs.setDoc(D(db, 'users', 'c2'), { role: 'member', status: 'active' });
      await fs.setDoc(D(db, 'users', 'x'), { role: 'member', status: 'active' });
      await fs.setDoc(D(db, 'coaching', 'c1'), {
        trainerId: 't1',
        status: over.status ?? 'active',
        keyEpoch: 1,
      });
      await fs.setDoc(D(db, 'coaching', 'c2'), { trainerId: 'a1', status: 'active', keyEpoch: 1 });
      await conv(CID, 'c1', 't1');
      await conv(CID2, 'c2', 'a1');
      await fs.setDoc(D(db, 'conversations', CID, 'messages', 'm0'), {
        id: 'm0',
        from: 'c1',
        at: Date.now(),
        v: 1,
        ...sealed(),
      });
      await fs.setDoc(D(db, 'conversations', CID, 'notes', 'n0'), {
        id: 'n0',
        by: 't1',
        at: 1,
        updatedAt: 1,
        ...sealed(),
      });
      await fs.setDoc(D(db, 'conversations', CID, 'requests', 'r0'), {
        id: 'r0',
        from: 'client',
        status: 'pending',
        createdAt: Date.now(),
        expiresAt: Date.now() + 1e6,
        slotKey: 'k',
        ...sealed(),
      });
      await fs.setDoc(D(db, 'plans', 'c1'), {
        clientId: 'c1',
        trainerId: 't1',
        programId: 'p',
        liveVersion: 2,
        rev: 1,
        updatedAt: 1,
        ...sealed(),
      });
      await fs.setDoc(D(db, 'plans', 'c1', 'versions', '1'), {
        n: 1,
        programId: 'p',
        state: 'draft',
        createdAt: 1,
        ...sealed(),
      });
      await fs.setDoc(D(db, 'plans', 'c1', 'versions', '2'), {
        n: 2,
        programId: 'p',
        state: 'live',
        createdAt: 1,
        ...sealed(),
      });
      await fs.setDoc(D(db, 'schedules', 'c1'), {
        clientId: 'c1',
        trainerId: 't1',
        rev: 1,
        updatedAt: 1,
        ...sealed(),
      });
      await fs.setDoc(D(db, 'users', 'c1'), { trainerId: 't1', role: 'member', status: 'active' });
    });
  }
  beforeEach(() => seed());

  const ok = (p: Promise<unknown>) => rt.assertSucceeds(p);
  const no = (p: Promise<unknown>) => rt.assertFails(p);
  // the sender signature is REQUIRED by the rules (B-21); the receiver verifies it
  const msg = (from: string, over: Record<string, unknown> = {}) => ({
    id: 'm1',
    from,
    at: Date.now(),
    v: 1,
    ...sealed(),
    sig: 'A'.repeat(88),
    sigKid: '0123456789abcdef',
    ...over,
  });
  const msgRef = (db: unknown, id = 'm1', cid = CID) => D(db, 'conversations', cid, 'messages', id);

  describe('conversations', () => {
    it('client, active trainer and admin-as-coach (own client) read; others do not', async () => {
      await ok(fs.getDoc(D(client(), 'conversations', CID)));
      await ok(fs.getDoc(D(trainer(), 'conversations', CID)));
      await ok(fs.getDoc(D(adminCoach(), 'conversations', CID2)));
      await no(fs.getDoc(D(stranger(), 'conversations', CID)));
      await no(fs.getDoc(D(as('t1', 'member'), 'conversations', CID)));
      await no(fs.getDoc(D(adminCoach(), 'conversations', CID))); // admin is not t1
    });
    it('trainer loses read when active=false', async () => {
      await seed({ active: false });
      await no(fs.getDoc(D(trainer(), 'conversations', CID)));
      await ok(fs.getDoc(D(client(), 'conversations', CID)));
    });
    it('roster list query needs trainerId==uid AND active==true', async () => {
      const col = fs.collection(trainer(), 'conversations');
      await ok(
        fs.getDocs(
          fs.query(col, fs.where('trainerId', '==', 't1'), fs.where('active', '==', true)),
        ),
      );
      await no(fs.getDocs(fs.query(col, fs.where('trainerId', '==', 't1'))));
    });
    it('create and delete are denied for everyone', async () => {
      await no(
        fs.setDoc(D(client(), 'conversations', 'n'.repeat(26)), {
          clientId: 'c1',
          trainerId: 't1',
        }),
      );
      await no(fs.deleteDoc(D(client(), 'conversations', CID)));
    });
    it('client publishes ck with a valid shape and a step of at most one epoch; trainer cannot', async () => {
      const ref = () => D(client(), 'conversations', CID);
      await ok(fs.updateDoc(ref(), { ck: ck(2), keyEpoch: 2 }));
      await seed();
      await no(fs.updateDoc(ref(), { ck: ck(1), keyEpoch: 2 })); // epoch mismatch
      await no(fs.updateDoc(ref(), { ck: { ...ck(1), ct: 'B'.repeat(64) }, keyEpoch: 1 })); // same epoch, same fingerprint: cannot be replaced (D04)
      await ok(fs.updateDoc(ref(), { ck: { ...ck(1), fp: 'b'.repeat(16) }, keyEpoch: 1 })); // re-wrap for a new trainer key
      await seed();
      await no(fs.updateDoc(ref(), { ck: ck(40), keyEpoch: 40 })); // an epoch cannot be made up far ahead
      await no(fs.updateDoc(ref(), { ck: { ...ck(1), extra: 1 }, keyEpoch: 1 }));
      await no(fs.updateDoc(ref(), { ck: { ...ck(1), fp: 'short' }, keyEpoch: 1 }));
      await no(fs.updateDoc(ref(), { ck: { ...ck(1), ct: 'A'.repeat(10) }, keyEpoch: 1 }));
      await no(fs.updateDoc(ref(), { ck: ck(0), keyEpoch: 0 }));
      await no(fs.updateDoc(D(trainer(), 'conversations', CID), { ck: ck(2), keyEpoch: 2 }));
      await seed();
      await ok(fs.updateDoc(ref(), { ck: ck(2), keyEpoch: 2 }));
      await ok(fs.updateDoc(ref(), { ck: ck(3), keyEpoch: 3 }));
      await no(fs.updateDoc(ref(), { ck: ck(2), keyEpoch: 2 })); // decrease
    });
    it('pointers: own uid only, forward only; other fields denied', async () => {
      await ok(fs.updateDoc(D(client(), 'conversations', CID), { readUpTo: { c1: 10 } }));
      await ok(fs.updateDoc(D(trainer(), 'conversations', CID), { 'readUpTo.t1': 10 }));
      await no(fs.updateDoc(D(client(), 'conversations', CID), { readUpTo: { t1: 10 } }));
      await no(fs.updateDoc(D(trainer(), 'conversations', CID), { clearedBefore: { c1: 5 } }));
      await no(fs.updateDoc(D(client(), 'conversations', CID), { lastAt: 99 }));
      await no(fs.updateDoc(D(client(), 'conversations', CID), { unread: { c1: 0 } }));
      await no(fs.updateDoc(D(client(), 'conversations', CID), { active: false }));
      await seed();
      await ok(fs.updateDoc(D(client(), 'conversations', CID), { readUpTo: { c1: 10 } }));
      await no(fs.updateDoc(D(client(), 'conversations', CID), { readUpTo: { c1: 5 } })); // backwards
    });
    it('clearedBefore is the own view marker: it may move back (Undo of Clear chat), never another uid or a negative value', async () => {
      const ref = () => D(client(), 'conversations', CID);
      await ok(fs.updateDoc(ref(), { 'clearedBefore.c1': 50 }));
      await ok(fs.updateDoc(ref(), { 'clearedBefore.c1': 10 })); // back
      await ok(fs.updateDoc(ref(), { 'clearedBefore.c1': 0 }));
      await no(fs.updateDoc(ref(), { 'clearedBefore.c1': -1 }));
      await no(fs.updateDoc(ref(), { 'clearedBefore.t1': 5 }));
      await ok(fs.updateDoc(D(trainer(), 'conversations', CID), { 'clearedBefore.t1': 7 }));
      await ok(fs.updateDoc(D(client(), 'conversations', CID), { 'readUpTo.c1': 9 })); // dotted path, as the adapter writes it
    });
  });

  describe('messages', () => {
    it('client, trainer and admin-as-coach create valid messages', async () => {
      await ok(fs.setDoc(msgRef(client()), msg('c1')));
      await ok(fs.setDoc(msgRef(trainer(), 'm2'), msg('t1', { id: 'm2' })));
      await ok(fs.setDoc(msgRef(adminCoach(), 'm1', CID2), msg('a1')));
    });
    it('sender signature: sig and sigKid are REQUIRED, come together and are size-bounded', async () => {
      const sig = 'A'.repeat(88);
      const bare = (id: string, extra: Record<string, unknown> = {}) => {
        const m = msg('c1', { id, ...extra });
        if (!('sig' in extra)) delete (m as Record<string, unknown>).sig;
        if (!('sigKid' in extra)) delete (m as Record<string, unknown>).sigKid;
        return m;
      };
      await ok(fs.setDoc(msgRef(client()), msg('c1', { sig, sigKid: '0123456789abcdef' })));
      await no(fs.setDoc(msgRef(client(), 'm2'), bare('m2'))); // unsigned (B08)
      await no(fs.setDoc(msgRef(client(), 'm2'), bare('m2', { sig })));
      await no(fs.setDoc(msgRef(client(), 'm3'), bare('m3', { sigKid: '0123456789abcdef' })));
      await no(
        fs.setDoc(
          msgRef(client(), 'm4'),
          msg('c1', { id: 'm4', sig: 'A'.repeat(101), sigKid: 'k' }),
        ),
      );
      await no(
        fs.setDoc(msgRef(client(), 'm5'), msg('c1', { id: 'm5', sig, sigKid: 'k'.repeat(33) })),
      );
    });
    const drop = (m: Record<string, unknown>, k: string) => {
      const copy = { ...m };
      delete copy[k];
      return copy;
    };
    it.each([
      ['wrong from', () => msg('t1')],
      ['id != path', () => msg('c1', { id: 'other' })],
      ['at too old', () => msg('c1', { at: Date.now() - 600000 })],
      [
        'at 4 minutes old (rate-limit evasion window, B05)',
        () => msg('c1', { at: Date.now() - 240000 }),
      ],
      ['at in the future', () => msg('c1', { at: Date.now() + 600000 })],
      ['extra plaintext key', () => msg('c1', { text: 'hi' })],
      ['extra kind key', () => msg('c1', { kind: 'text' })],
      ['missing enc', () => drop(msg('c1'), 'enc')],
      ['enc with salt', () => msg('c1', { enc: { ...enc(), salt: 'x' } })],
      ['iv size', () => msg('c1', { enc: { ...enc(), iv: 'AAAA' } })],
      ['ct too big', () => msg('c1', { enc: enc('A'.repeat(11000)) })],
      ['ct too small', () => msg('c1', { enc: enc('A'.repeat(10)) })],
      ['enc version', () => msg('c1', { enc: { ...enc(), v: 2 } })],
      ['epoch mismatch', () => msg('c1', { keyEpoch: 2 })],
      ['v != 1', () => msg('c1', { v: 2 })],
    ])('create denied: %s', async (_n, make) => {
      await no(fs.setDoc(msgRef(client()), make()));
    });
    it('trainer cannot write without a published ck; client can write epoch 1 only', async () => {
      await seed({ noCk: true });
      await no(fs.setDoc(msgRef(trainer()), msg('t1')));
      await ok(fs.setDoc(msgRef(client()), msg('c1')));
      await no(fs.setDoc(msgRef(client(), 'm2'), msg('c1', { id: 'm2', keyEpoch: 2 })));
    });
    it('ended relationship: nobody writes, trainer cannot read, client still reads', async () => {
      await seed({ status: 'ended', active: false });
      await no(fs.setDoc(msgRef(client()), msg('c1')));
      await no(fs.setDoc(msgRef(trainer()), msg('t1')));
      await no(fs.getDoc(msgRef(trainer(), 'm0')));
      await ok(fs.getDoc(msgRef(client(), 'm0')));
    });
    it('strangers neither read nor write; a member with the trainer uid is not a coach', async () => {
      await no(fs.getDoc(msgRef(stranger(), 'm0')));
      await no(fs.setDoc(msgRef(stranger()), msg('x')));
      await no(fs.getDoc(msgRef(as('t1', 'member'), 'm0')));
      await no(fs.setDoc(msgRef(as('t1', 'member')), msg('t1')));
    });
    it('delete flow: pending, undo, tombstone drops enc; other edits and other users denied', async () => {
      const ref = msgRef(client(), 'm0');
      await no(fs.updateDoc(ref, { enc: enc('B'.repeat(120)) }));
      await no(fs.updateDoc(msgRef(trainer(), 'm0'), { del: { state: 'pending', at: 1 } }));
      await no(fs.updateDoc(ref, { del: { state: 'done', at: 1 } }));
      await no(fs.updateDoc(ref, { del: { state: 'pending', at: 1, extra: 1 } }));
      await ok(fs.updateDoc(ref, { del: { state: 'pending', at: Date.now() } }));
      await ok(fs.updateDoc(ref, { del: fs.deleteField() })); // undo
      await no(fs.updateDoc(ref, { deleted: true, deletedAt: 1, enc: fs.deleteField() })); // not pending
      await ok(fs.updateDoc(ref, { del: { state: 'pending', at: Date.now() } }));
      await ok(
        fs.updateDoc(ref, {
          deleted: true,
          deletedAt: Date.now(),
          enc: fs.deleteField(),
          del: fs.deleteField(),
        }),
      );
      await no(fs.updateDoc(ref, { deletedAt: 5 })); // nothing after the tombstone
      await no(fs.deleteDoc(ref));
    });
  });

  describe('notes (trainer only)', () => {
    const noteRef = (db: unknown, id = 'n1', cid = CID) => D(db, 'conversations', cid, 'notes', id);
    const note = (over = {}) => ({ id: 'n1', by: 't1', at: 1, updatedAt: 1, ...sealed(), ...over });
    it('trainer and admin-as-coach write; client reads but cannot write; strangers nothing', async () => {
      await ok(fs.setDoc(noteRef(trainer()), note()));
      await ok(fs.updateDoc(noteRef(trainer(), 'n0'), { updatedAt: 2, enc: enc('C'.repeat(120)) }));
      await ok(fs.setDoc(noteRef(adminCoach(), 'n1', CID2), note({ by: 'a1' })));
      await ok(fs.getDoc(noteRef(client(), 'n0')));
      await no(fs.setDoc(noteRef(client()), note({ by: 'c1' })));
      await no(fs.setDoc(noteRef(stranger()), note({ by: 'x' })));
      await no(fs.deleteDoc(noteRef(client(), 'n0')));
      await ok(fs.deleteDoc(noteRef(trainer(), 'n0')));
    });
    it('by/at/id are immutable, shape is strict', async () => {
      await no(fs.updateDoc(noteRef(trainer(), 'n0'), { by: 'someone' }));
      await no(fs.updateDoc(noteRef(trainer(), 'n0'), { at: 99 }));
      await no(fs.setDoc(noteRef(trainer()), note({ text: 'plain' })));
      await no(fs.setDoc(noteRef(trainer()), note({ by: 'c1' })));
    });
    it('ended relationship: no writes, no trainer read', async () => {
      await seed({ status: 'ended', active: false });
      await no(fs.setDoc(noteRef(trainer()), note()));
      await no(fs.getDoc(noteRef(trainer(), 'n0')));
    });
  });

  describe('requests (functions only: coachRescheduleCreate / coachRescheduleRespond)', () => {
    const reqRef = (db: unknown, id = 'r1', cid = CID) =>
      D(db, 'conversations', cid, 'requests', id);
    const req = (from: string) => ({
      id: 'r1',
      from,
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: Date.now() + 1e6,
      slotKey: 'slot-1',
      ...sealed(),
    });
    it('both parties read their conversation requests; strangers and removed trainers do not', async () => {
      await ok(fs.getDoc(reqRef(client(), 'r0')));
      await ok(fs.getDoc(reqRef(trainer(), 'r0')));
      await no(fs.getDoc(reqRef(stranger(), 'r0')));
      await seed({ status: 'ended', active: false });
      await no(fs.getDoc(reqRef(trainer(), 'r0')));
      await ok(fs.getDoc(reqRef(client(), 'r0')));
    });
    it('no client write of any kind: the one-pending-per-slot and ttl rules live in the callable', async () => {
      await no(fs.setDoc(reqRef(client()), req('client')));
      await no(fs.setDoc(reqRef(trainer()), req('trainer')));
      await no(fs.setDoc(reqRef(adminCoach(), 'r1', CID2), req('trainer')));
      const r0 = (db: unknown) => reqRef(db, 'r0');
      await no(fs.updateDoc(r0(trainer()), { status: 'accepted', decidedAt: Date.now() }));
      await no(fs.updateDoc(r0(client()), { status: 'cancelled', decidedAt: Date.now() }));
      await no(fs.deleteDoc(r0(client())));
      await no(fs.deleteDoc(r0(trainer())));
    });
  });

  describe('coach keys (server signature fields) and functions-only collections', () => {
    const pub = { kty: 'EC', crv: 'P-256', x: 'x', y: 'y', ext: true, key_ops: [] };
    const key = (over: Record<string, unknown> = {}) => ({ pub, updatedAt: 5, ...over });
    it('the owner publishes a key but can never set the signature fields', async () => {
      const ref = () => D(trainer(), 'coachKeys', 't1');
      await ok(fs.setDoc(ref(), key()));
      await no(fs.setDoc(ref(), key({ sig: 'abc', kid: 'k', signedAt: 1 })));
      await no(fs.setDoc(D(client(), 'coachKeys', 't1'), key())); // not the owner
      await ok(fs.getDoc(D(client(), 'coachKeys', 't1')));
      await no(fs.deleteDoc(ref()));
    });
    it('a signed key stays valid for a write that keeps the signature fields identical, not for a changed one', async () => {
      await T.withSecurityRulesDisabled(async (ctx: { firestore(): unknown }) =>
        fs.setDoc(
          D(ctx.firestore(), 'coachKeys', 't1'),
          key({ sig: 's1', kid: 'k1', signedAt: 9 }),
        ),
      );
      const ref = () => D(trainer(), 'coachKeys', 't1');
      await ok(fs.setDoc(ref(), key({ updatedAt: 6, sig: 's1', kid: 'k1', signedAt: 9 })));
      await no(fs.setDoc(ref(), key({ updatedAt: 7, sig: 'forged', kid: 'k1', signedAt: 9 })));
      // the old signature cannot ride along with a DIFFERENT key (G02), and the key has size caps (G08)
      await no(
        fs.setDoc(
          ref(),
          key({ pub: { ...pub, x: 'EVIL' }, updatedAt: 6, sig: 's1', kid: 'k1', signedAt: 9 }),
        ),
      );
      await ok(fs.setDoc(ref(), key({ pub: { ...pub, x: 'NEWKEY' }, updatedAt: 8 }))); // new key, no signature
      await no(fs.setDoc(ref(), key({ pub: { ...pub, x: 'A'.repeat(900) }, updatedAt: 9 })));
    });
    it('only a coach role publishes a coach key (G01), and only while the live user document agrees (B-02)', async () => {
      await no(fs.setDoc(D(client(), 'coachKeys', 'c1'), key()));
      await ok(fs.setDoc(D(trainer(), 'coachKeys', 't1'), key()));
      await seed({ trainerRole: 'member' }); // demoted: the token still says trainer
      await no(fs.setDoc(D(trainer(), 'coachKeys', 't1'), key()));
      await no(fs.getDoc(D(trainer(), 'conversations', CID)));
      await seed({ trainerStatus: 'suspended' });
      await no(fs.getDoc(D(trainer(), 'conversations', CID)));
      await no(fs.getDoc(msgRef(trainer(), 'm0')));
      await no(fs.getDoc(D(trainer(), 'coaching', 'c1')));
    });
    it('invites, coaching, consent log and audit are never client-writable; the audit is readable by its subject only', async () => {
      await no(fs.setDoc(D(client(), 'invites', 'tok'), { kind: 'coach-link' }));
      await no(fs.getDoc(D(client(), 'invites', 'tok')));
      await no(fs.setDoc(D(client(), 'coaching', 'c1'), { trainerId: 't1', status: 'active' }));
      await no(fs.updateDoc(D(trainer(), 'coaching', 'c1'), { status: 'ended' }));
      await ok(fs.getDoc(D(client(), 'coaching', 'c1')));
      await ok(fs.getDoc(D(trainer(), 'coaching', 'c1')));
      await no(fs.getDoc(D(stranger(), 'coaching', 'c1')));
      await seed({ status: 'ended', active: false });
      await no(fs.getDoc(D(trainer(), 'coaching', 'c1'))); // an ex-trainer reads no consent metadata (A07)
      await ok(fs.getDoc(D(client(), 'coaching', 'c1')));
      await T.withSecurityRulesDisabled(async (ctx: { firestore(): unknown }) =>
        fs.setDoc(D(ctx.firestore(), 'users', 'c1', 'audit', 'a1'), { id: 'a1', at: 1 }),
      );
      await ok(fs.getDoc(D(client(), 'users', 'c1', 'audit', 'a1')));
      await no(fs.getDoc(D(trainer(), 'users', 'c1', 'audit', 'a1')));
      await no(fs.setDoc(D(client(), 'users', 'c1', 'audit', 'a2'), { id: 'a2', at: 1 }));
      await no(fs.deleteDoc(D(client(), 'users', 'c1', 'audit', 'a1')));
    });
    it('device signing keys are readable by any signed-in user and writable by nobody (callable only)', async () => {
      const rec = { uid: 't1', kid: 'k1', publicRaw: 'A'.repeat(87), srvKid: 's1', sig: 'abc' };
      await no(fs.setDoc(D(trainer(), 'signKeys', 't1', 'keys', 'k1'), rec));
      await T.withSecurityRulesDisabled(async (ctx: { firestore(): unknown }) =>
        fs.setDoc(D(ctx.firestore(), 'signKeys', 't1', 'keys', 'k1'), rec),
      );
      await ok(fs.getDoc(D(client(), 'signKeys', 't1', 'keys', 'k1')));
      await no(fs.deleteDoc(D(trainer(), 'signKeys', 't1', 'keys', 'k1')));
    });
    it('the server-maintained conversation fields (unread, lastAt, rotateDue, keyStale) are not client-writable', async () => {
      for (const f of [
        { unread: { c1: 0 } },
        { lastAt: 5 },
        { rotateDue: true },
        { keyStale: true },
        { active: false },
      ])
        await no(fs.updateDoc(D(client(), 'conversations', CID), f));
    });
  });

  describe('schedules, plans, versions', () => {
    const sched = (over = {}) => ({
      clientId: 'c1',
      trainerId: 't1',
      rev: 2,
      updatedAt: 2,
      ...sealed(),
      ...over,
    });
    it('trainer writes rev+1 only; client reads but cannot write; admin-as-coach of own client', async () => {
      await ok(fs.setDoc(D(trainer(), 'schedules', 'c1'), sched()));
      await seed();
      await no(fs.setDoc(D(trainer(), 'schedules', 'c1'), sched({ rev: 5 })));
      await no(fs.setDoc(D(trainer(), 'schedules', 'c1'), sched({ plain: 1 })));
      await no(fs.setDoc(D(client(), 'schedules', 'c1'), sched()));
      await ok(fs.getDoc(D(client(), 'schedules', 'c1')));
      await no(fs.getDoc(D(stranger(), 'schedules', 'c1')));
      await no(fs.deleteDoc(D(trainer(), 'schedules', 'c1')));
      await ok(
        fs.setDoc(
          D(adminCoach(), 'schedules', 'c2'),
          sched({ clientId: 'c2', trainerId: 'a1', rev: 1 }),
        ),
      );
      await no(fs.setDoc(D(adminCoach(), 'schedules', 'c1'), sched({ trainerId: 'a1' })));
    });
    const plan = (over = {}) => ({
      clientId: 'c1',
      trainerId: 't1',
      programId: 'p',
      liveVersion: 2,
      rev: 2,
      updatedAt: 2,
      ...sealed(),
      ...over,
    });
    it('plan: rev+1, liveVersion cannot move from the client SDK, ended relationship blocks', async () => {
      await ok(fs.setDoc(D(trainer(), 'plans', 'c1'), plan()));
      await seed();
      await no(fs.setDoc(D(trainer(), 'plans', 'c1'), plan({ liveVersion: 3 })));
      await no(fs.setDoc(D(trainer(), 'plans', 'c1'), plan({ rev: 9 })));
      await no(fs.setDoc(D(client(), 'plans', 'c1'), plan()));
      await seed({ status: 'ended', active: false });
      await no(fs.setDoc(D(trainer(), 'plans', 'c1'), plan()));
      await no(fs.getDoc(D(trainer(), 'plans', 'c1')));
    });
    const ver = (n: number, over = {}) => ({
      n,
      programId: 'p',
      state: 'draft',
      createdAt: 1,
      ...sealed(),
      ...over,
    });
    it('a whole program fits a plan / version document (up to 250000 base64 chars) but not a message', async () => {
      const big = enc('B'.repeat(200_000));
      await ok(fs.setDoc(D(trainer(), 'plans', 'c1', 'versions', '3'), ver(3, { enc: big })));
      await ok(fs.setDoc(D(trainer(), 'plans', 'c1'), plan({ enc: big })));
      await no(fs.setDoc(D(trainer(), 'plans', 'c1'), plan({ enc: enc('B'.repeat(260_000)) })));
      await no(fs.setDoc(D(trainer(), 'schedules', 'c1'), sched({ enc: big })));
      // a long schedule (up to 165000 base64 chars) is fine, more is not
      await ok(
        fs.setDoc(D(trainer(), 'schedules', 'c1'), sched({ enc: enc('S'.repeat(150_000)) })),
      );
      await no(
        fs.setDoc(D(trainer(), 'schedules', 'c1'), sched({ enc: enc('S'.repeat(170_000)) })),
      );
    });
    it('versions: drafts only for the trainer; client sees non-drafts only', async () => {
      const v = (n: string) => D(trainer(), 'plans', 'c1', 'versions', n);
      await ok(fs.setDoc(v('3'), ver(3)));
      await no(fs.setDoc(v('4'), ver(3))); // n != path
      await no(fs.setDoc(v('5'), ver(5, { state: 'live' })));
      await ok(fs.updateDoc(v('1'), { enc: enc('E'.repeat(120)) }));
      await no(fs.updateDoc(v('1'), { state: 'live' }));
      await no(fs.updateDoc(v('2'), { enc: enc('E'.repeat(120)) })); // live is frozen
      await no(fs.getDoc(D(client(), 'plans', 'c1', 'versions', '1')));
      await ok(fs.getDoc(D(client(), 'plans', 'c1', 'versions', '2')));
      await no(fs.deleteDoc(v('2')));
      await ok(fs.deleteDoc(v('1')));
    });
  });

  describe('liveSessions (additive extension)', () => {
    const live = (over = {}) => ({
      id: 'c1',
      trainerId: 't1',
      startedAt: 1,
      updatedAt: 2,
      ...over,
    });
    it('the current five-field doc stays valid; the sealed extension is valid; plaintext extras are not', async () => {
      const ref = () => D(client(), 'liveSessions', 'c1');
      await ok(fs.setDoc(ref(), live()));
      await ok(fs.setDoc(ref(), live({ expireAt: 9, finishedAt: 3, ...sealed() })));
      await ok(fs.setDoc(ref(), live({ finishedAt: 3, expireAt: 9, updatedAt: 3, ...sealed(1) }))); // finished: finals live in enc
      await no(fs.setDoc(ref(), live({ athleteName: 'Oleh' })));
      await no(fs.setDoc(ref(), live({ finalSets: 12 }))); // sets are sealed or absent, never open
      await no(fs.setDoc(ref(), live({ sets: [{ reps: 5 }] })));
      await no(fs.setDoc(ref(), live({ enc: enc() }))); // enc without keyEpoch
      await no(fs.setDoc(ref(), live({ trainerId: 'other' })));
    });
  });

  describe('keyring (wraps of past conversation-key epochs, iteration 12)', () => {
    const ring = (db: unknown, e: number) => D(db, 'conversations', CID, 'keyring', String(e));
    const row = (e: number, over = {}) => ({ epoch: e, ck: ck(e), at: 1, ...over });
    it('only the client writes past epochs (below the published one); the trainer reads; nobody deletes', async () => {
      await ok(fs.updateDoc(D(client(), 'conversations', CID), { ck: ck(2), keyEpoch: 2 }));
      await ok(fs.setDoc(ring(client(), 1), row(1)));
      await no(fs.setDoc(ring(client(), 2), row(2))); // the current epoch is not a past one
      await no(fs.setDoc(ring(client(), 3), row(3)));
      await no(fs.setDoc(ring(client(), 1), row(5))); // epoch must equal the path
      await no(fs.setDoc(ring(client(), 1), row(1, { extra: 1 })));
      await no(fs.setDoc(ring(client(), 1), row(1, { ck: { ...ck(1), extra: 1 } })));
      await no(fs.setDoc(ring(trainer(), 1), row(1))); // a valid row, but the trainer does not write the ring
      await ok(fs.getDoc(ring(trainer(), 1)));
      await ok(fs.getDoc(ring(client(), 1)));
      await no(fs.getDoc(ring(stranger(), 1)));
      await no(fs.deleteDoc(ring(client(), 1)));
    });
    it('an ended relationship: the trainer reads no ring, the client writes none', async () => {
      await seed({ status: 'ended', active: false });
      await T.withSecurityRulesDisabled(async (ctx: { firestore(): unknown }) => {
        const db = ctx.firestore();
        await fs.updateDoc(D(db, 'conversations', CID), { keyEpoch: 2, ck: ck(2) });
        await fs.setDoc(D(db, 'conversations', CID, 'keyring', '1'), row(1));
      });
      await no(fs.getDoc(ring(trainer(), 1)));
      await no(fs.setDoc(ring(client(), 1), row(1)));
      await ok(fs.getDoc(ring(client(), 1)));
    });
  });

  describe('programs and assignments (the runnable program of a coached plan, iteration 12)', () => {
    const prog = (over = {}) => ({
      id: 'prg-c1-1',
      authorId: 't1',
      name: 'UL',
      status: 'draft',
      items: [],
      ...over,
    });
    it('the trainer writes his own program doc; the member reads only the assigned one; assignments are server-only', async () => {
      await ok(fs.setDoc(D(trainer(), 'programs', 'prg-c1-1'), prog()));
      await no(fs.setDoc(D(trainer(), 'programs', 'prg-c1-2'), prog({ authorId: 'someone' }))); // authorship
      await ok(fs.updateDoc(D(trainer(), 'programs', 'prg-c1-1'), { status: 'active' }));
      await no(fs.updateDoc(D(client(), 'programs', 'prg-c1-1'), { name: 'mine' }));
      await no(fs.getDoc(D(client(), 'programs', 'prg-c1-1'))); // not assigned yet
      await T.withSecurityRulesDisabled(async (ctx: { firestore(): unknown }) => {
        await fs.setDoc(D(ctx.firestore(), 'assignments', 'c1'), {
          memberId: 'c1',
          programId: 'prg-c1-1',
          assignedBy: 't1',
          startedAt: 1,
        });
      });
      await ok(fs.getDoc(D(client(), 'programs', 'prg-c1-1')));
      await ok(fs.getDoc(D(client(), 'assignments', 'c1')));
      await no(
        fs.setDoc(D(client(), 'assignments', 'c1'), {
          memberId: 'c1',
          programId: 'x',
          assignedBy: 'c1',
        }),
      );
      await no(fs.getDoc(D(stranger(), 'programs', 'prg-c1-1')));
    });
  });

  describe('users subcollections', () => {
    it('owner-only trainer data, sealed under the owner key only (I02/I03); consentLog readable by owner, never writable', async () => {
      const note = (over = {}) => ({
        id: 'n',
        clientId: 'c1',
        at: 1,
        updatedAt: 1,
        enc: dek(),
        ...over,
      });
      await ok(fs.setDoc(D(trainer(), 'users', 't1', 'clientNotes', 'n'), note()));
      await no(
        fs.setDoc(D(trainer(), 'users', 't1', 'clientNotes', 'n2'), {
          id: 'n2',
          clientId: 'c1',
          text: 'knee hurts',
        }),
      ); // plaintext
      await no(
        fs.setDoc(D(trainer(), 'users', 't1', 'clientNotes', 'n3'), note({ id: 'n3', text: 'x' })),
      ); // plaintext sibling
      await no(
        fs.setDoc(D(trainer(), 'users', 't1', 'clientNotes', 'n4'), note({ id: 'n4', enc: enc() })),
      ); // wrong envelope
      await no(fs.getDoc(D(client(), 'users', 't1', 'clientNotes', 'n')));
      await ok(
        fs.setDoc(D(trainer(), 'users', 't1', 'decisions', 'd'), {
          id: 'd',
          clientId: 'c1',
          kind: 'k',
          status: 'open',
          enc: dek(),
        }),
      );
      await no(
        fs.setDoc(D(trainer(), 'users', 't1', 'decisions', 'd2'), {
          id: 'd2',
          clientId: 'c1',
          kind: 'k',
          status: 'open',
        }),
      );
      await ok(
        fs.setDoc(D(trainer(), 'users', 't1', 'decisions', 'd', 'evidence', 'sleep'), {
          category: 'sleep',
          enc: dek(),
        }),
      );
      await no(
        fs.setDoc(D(trainer(), 'users', 't1', 'decisions', 'd', 'evidence', 'sets'), {
          category: 'sets',
          rows: [1],
        }),
      );
      await ok(
        fs.setDoc(D(client(), 'users', 'c1', 'shares', 'sleep'), {
          category: 'sleep',
          level: 'effects',
          asOf: 1,
          v: 1,
          enc: dek(),
        }),
      );
      await no(
        fs.setDoc(D(client(), 'users', 'c1', 'shares', 'totals'), {
          category: 'totals',
          level: 'full',
          view: { weeks: [] },
        }),
      );
      await no(fs.setDoc(D(trainer(), 'users', 'c1', 'shares', 'sleep'), { category: 'sleep' }));
      // generic meta stays open for the app's other documents, the coaching ones need their envelope
      await ok(fs.setDoc(D(client(), 'users', 'c1', 'meta', 'chatKeys'), { v: 1, enc: dek() }));
      await no(
        fs.setDoc(D(client(), 'users', 'c1', 'meta', 'chatKeys'), { v: 1, keys: { a: 'b' } }),
      );
      await no(
        fs.setDoc(D(client(), 'users', 'c1', 'meta', 'signalState'), {
          updatedAt: 1,
          snoozed: [1],
        }),
      );
      await ok(fs.setDoc(D(client(), 'users', 'c1', 'meta', 'anything'), { whatever: 1 }));
      await no(fs.setDoc(D(client(), 'users', 'c1', 'consentLog', 'x'), { at: 1 }));
      await ok(fs.getDocs(fs.collection(client(), 'users', 'c1', 'consentLog')));
      await no(fs.setDoc(D(client(), 'users', 'c1', 'consentRecords', 'x'), { at: 1 }));
      await ok(fs.getDocs(fs.collection(client(), 'users', 'c1', 'consentRecords')));
    });
    it('consentRecords (SPO-296): only the owner reads; the coach, an admin, another member and a signed-out caller cannot; nobody writes', async () => {
      await T.withSecurityRulesDisabled(async (ctx: { firestore(): unknown }) => {
        await fs.setDoc(D(ctx.firestore(), 'users', 'c1', 'consentRecords', 'r1'), {
          id: 'r1',
          kind: 'terms',
          action: 'grant',
          version: '2026-10-21',
          at: 1,
        });
      });
      const coll = (db: unknown) => fs.collection(db, 'users', 'c1', 'consentRecords');
      const anon = () => T.unauthenticatedContext().firestore();
      await ok(fs.getDoc(D(client(), 'users', 'c1', 'consentRecords', 'r1')));
      await ok(fs.getDocs(coll(client())));
      for (const who of [trainer, adminCoach, stranger, anon]) {
        await no(fs.getDoc(D(who(), 'users', 'c1', 'consentRecords', 'r1')));
        await no(fs.getDocs(coll(who())));
      }
      // no direct writes, not even by the owner: create, update, delete
      const rec = { kind: 'terms', action: 'grant', version: '2026-10-21', at: 2 };
      for (const who of [client, trainer, adminCoach, stranger, anon]) {
        await no(fs.setDoc(D(who(), 'users', 'c1', 'consentRecords', 'r2'), rec));
        await no(fs.setDoc(D(who(), 'users', 'c1', 'consentRecords', 'r1'), rec));
        await no(fs.deleteDoc(D(who(), 'users', 'c1', 'consentRecords', 'r1')));
      }
    });
  });
  describe('query shapes the real adapters run (ITER8)', () => {
    const q = (db: unknown, coll: string[], ...c: unknown[]) =>
      fs.getDocs(fs.query(fs.collection(db, ...coll), ...c));
    it('the trainer lists his active conversations, the client lists his own, nobody lists everything', async () => {
      await ok(
        q(
          trainer(),
          ['conversations'],
          fs.where('trainerId', '==', 't1'),
          fs.where('active', '==', true),
        ),
      );
      await ok(q(client(), ['conversations'], fs.where('clientId', '==', 'c1')));
      await no(q(client(), ['conversations']));
      await no(q(trainer(), ['conversations'], fs.where('trainerId', '==', 'a1')));
    });
    it('private notes are queried by client id under the trainer; the client never reads them', async () => {
      await ok(q(trainer(), ['users', 't1', 'clientNotes'], fs.where('clientId', '==', 'c1')));
      await no(q(client(), ['users', 't1', 'clientNotes'], fs.where('clientId', '==', 'c1')));
    });
    it('shared notes and requests of one conversation: both sides read, only the trainer writes notes', async () => {
      await ok(q(client(), ['conversations', CID, 'notes'], fs.orderBy('at', 'desc')));
      await ok(q(trainer(), ['conversations', CID, 'requests']));
      await no(q(stranger(), ['conversations', CID, 'requests']));
      await no(
        fs.setDoc(D(client(), 'conversations', CID, 'notes', 'n9'), {
          id: 'n9',
          by: 'c1',
          at: 1,
          updatedAt: 1,
          ...sealed(),
        }),
      );
    });
    it('a client reads his own schedule doc; a stranger and an ex-trainer do not', async () => {
      await T.withSecurityRulesDisabled(async (ctx: { firestore(): unknown }) =>
        fs.setDoc(D(ctx.firestore(), 'schedules', 'c1'), {
          clientId: 'c1',
          trainerId: 't1',
          rev: 1,
          updatedAt: 1,
          ...sealed(),
        }),
      );
      await ok(fs.getDoc(D(client(), 'schedules', 'c1')));
      await ok(fs.getDoc(D(trainer(), 'schedules', 'c1')));
      await no(fs.getDoc(D(stranger(), 'schedules', 'c1')));
    });
    it('live sessions are listed by trainer id; the audit log and the derived shares are owner-only', async () => {
      await ok(q(trainer(), ['liveSessions'], fs.where('trainerId', '==', 't1')));
      await no(q(trainer(), ['liveSessions']));
      await ok(q(client(), ['users', 'c1', 'audit'], fs.orderBy('at', 'desc')));
      await no(q(trainer(), ['users', 'c1', 'audit']));
      await ok(
        fs.setDoc(D(client(), 'users', 'c1', 'meta', 'selfCoach'), { updatedAt: 1, enc: dek() }),
      );
      await ok(
        fs.setDoc(D(client(), 'users', 'c1', 'shares', 'sets'), {
          category: 'sets',
          level: 'effects',
          asOf: 1,
          v: 1,
          enc: dek(),
        }),
      );
      await no(fs.setDoc(D(trainer(), 'users', 'c1', 'shares', 'sets'), { category: 'sets' }));
    });
    it('the signature fields of a message are accepted together and refused alone', async () => {
      await ok(
        fs.setDoc(
          msgRef(client(), 'ms1'),
          msg('c1', { id: 'ms1', sig: 'A'.repeat(88), sigKid: 'abcdef0123456789' }),
        ),
      );
      const only = msg('c1', { id: 'ms2' });
      delete (only as Record<string, unknown>).sigKid;
      await no(fs.setDoc(msgRef(client(), 'ms2'), only));
    });
  });
});
