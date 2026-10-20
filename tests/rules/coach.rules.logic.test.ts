/**
 * Rules WITHOUT the emulator. Parses the real `firestore.rules`, evaluates it with the interpreter in `engine/`
 * and runs the REAL client adapters (key ring, notes/schedule seals, program port, live writer) through a store that
 * enforces the rules. A write shape the rules refuse, a size cap that drifted from the client constant, an allow-list
 * that no longer matches the registry or a read that leaks past a lock all fail here, in plain `vitest run`.
 *
 * It models the rules language (see engine/rulesEngine.ts); the emulator suite (`coach.rules.test.ts`, run with
 * `npm run test:rules`) stays the authority for engine-specific behaviour. Both suites share the case ideas.
 */
import { describe, expect, it } from 'vitest';
import { buildFixtureWorld } from '../../client/src/coach/data/__fixtures__/fixtures';
import { createFirestoreClientPort } from '../../client/src/coach/data/firestore/clientPort';
import { createFirestoreProgramPort } from '../../client/src/coach/data/firestore/programPort';
import {
  LIVE_BEAT_MS,
  createLiveWriter,
  type LiveWriterInput,
} from '../../client/src/coach/data/firestore/liveWriter';
import { C, CID, NOW, T, makeWorld } from '../../client/src/coach/data/firestore/testWorld';
import { olehDraft } from '../../client/src/coach/program/__fixtures__/fixtures';
import {
  NEW_COLLECTIONS,
  PLAN_MAX_BYTES,
  SCHEDULE_MAX_BYTES,
} from '../../client/src/coachCrypto/newCollections';
import { MAX_PAYLOAD_BYTES } from '../../client/src/coachCrypto/envelope';
import { sealOrThrow } from '../../client/src/coachCrypto/sealOrThrow';
import type { ChatKeyRing } from '../../client/src/coachCrypto/conversationKey';
import type { Workout } from '../../client/src/types';
import { callRulesFn, decide, parseRules, type Ctx, type Doc } from './engine/rulesEngine';
import { enforceRules, type EnforcedFs } from './engine/rulesFs';
import { RULES_SOURCE } from './engine/rulesSource';

const rules = parseRules(RULES_SOURCE);
const member = { uid: C, token: { role: 'member' } };
const trainer = { uid: T, token: { role: 'trainer' } };

const enc = (len = 120) => ({ v: 1, iv: 'A'.repeat(16), ct: 'A'.repeat(len) });
const sealedShape = (len = 120, epoch = 1) => ({ keyEpoch: epoch, enc: enc(len) });
const fn = (name: string, d: Doc, ctx: Partial<Ctx> = {}) =>
  callRulesFn(rules, name, [d], { auth: member, db: {}, ...ctx });
const ckWrap = (epoch = 1) => ({
  v: 1,
  epoch,
  epk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y', ext: true, key_ops: [] },
  iv: 'A'.repeat(16),
  ct: 'A'.repeat(64),
  fp: 'a'.repeat(16),
});

/** a world whose three parties see the store only through the rules */
async function enforced() {
  const w = await makeWorld((fs, uid, role) => enforceRules(rules, fs, { uid, role }));
  w.fs.seed(`users/${C}`, { trainerId: T, role: 'member', status: 'active' });
  // coach privileges also need the LIVE user document to agree with the token claim (stale-claim guard, B-02)
  w.fs.seed(`users/${T}`, { role: 'trainer', status: 'active' });
  return { w, t: w.tfs as EnforcedFs, c: w.cfs as EnforcedFs };
}
const denied = async (p: Promise<unknown>) => {
  await expect(p).rejects.toMatchObject({ code: 'permission-denied' });
};

// =================================================================== static

describe('rules file: static checks', () => {
  it('no allow statement is unconditional; nothing is writable by anyone', () => {
    const open: string[] = [];
    const walk = (m: (typeof rules.root)['children'][number], path: string) => {
      for (const a of m.allows) {
        const c = a.cond;
        if (c.t === 'lit' && c.v === true) open.push(`${path}: allow ${a.ops.join(',')}`);
      }
      m.children.forEach((k) => walk(k, path + '/' + k.segs.join('/')));
    };
    rules.root.children.forEach((m) => walk(m, m.segs.join('/')));
    expect(open).toEqual([]);
  });

  it('every collection the client may write is in the reviewed list (a new writable path needs a review)', () => {
    const writable: string[] = [];
    const walk = (m: (typeof rules.root)['children'][number], path: string) => {
      for (const a of m.allows) {
        const w = a.ops.some((o) => ['write', 'create', 'update', 'delete'].includes(o));
        const never = a.cond.t === 'lit' && a.cond.v === false;
        if (w && !never) writable.push(path.replace('databases/{database}/documents/', ''));
      }
      m.children.forEach((k) => walk(k, path + '/' + k.segs.join('/')));
    };
    rules.root.children.forEach((m) => walk(m, m.segs.join('/')));
    expect([...new Set(writable)].sort()).toEqual(
      [
        '',
        'coachKeys/{userId}',
        'config/{docId}',
        'conversations/{cid}',
        // SPO-196: the CLIENT delegates the schedule/requests sub-keys to a team manager (ADR 005)
        'conversations/{cid}/delegations/{managerUid}',
        'conversations/{cid}/keyring/{epoch}',
        'conversations/{cid}/messages/{mid}',
        'conversations/{cid}/notes/{nid}',
        'exerciseCatalog/{entryId}',
        'liveSessions/{athleteId}',
        'plans/{clientId}',
        'plans/{clientId}/versions/{n}',
        'programs/{programId}',
        'schedules/{clientId}',
        'sharedGyms/{gymKey}',
        'sleepSchedules/{userId}',
        'users/{userId}',
        'users/{userId}/activities/{activityId}',
        'users/{userId}/clientNotes/{noteId}',
        'users/{userId}/conditions/{conditionId}',
        'users/{userId}/decisions/{decisionId}',
        'users/{userId}/decisions/{decisionId}/evidence/{cat}',
        'users/{userId}/grants/{coachId}',
        'users/{userId}/gyms/{gymId}',
        'users/{userId}/injuries/{injuryId}',
        // sealed coaching documents with their own shape rules (before the generic meta/* above them)
        'users/{userId}/meta/calendarSettings',
        'users/{userId}/meta/chatKeys',
        'users/{userId}/meta/selfCoach',
        'users/{userId}/meta/signalState',
        'users/{userId}/meta/{docId}',
        'users/{userId}/notices/{noticeId}',
        'users/{userId}/outbox/{messageId}',
        'users/{userId}/pings/{pingId}',
        'users/{userId}/push/{deviceId}',
        'users/{userId}/reminderDismissals/{dismissId}',
        'users/{userId}/restPeriods/{periodId}',
        'users/{userId}/shares/{category}',
        'users/{userId}/sleeps/{sleepId}',
        'users/{userId}/workouts/{workoutId}',
      ].filter(Boolean),
    );
  });

  it('server-only collections cannot be written by any role', () => {
    const admin = { uid: 'a', token: { role: 'admin' } };
    for (const p of [
      `assignments/${C}`,
      `coaching/${C}`,
      `coaching/${C}/summary/x`,
      `conversations/${CID}/requests/r1`,
      `users/${C}/audit/e1`,
      `users/${C}/consentLog/e1`,
      `users/${C}/trainerNotes/n1`,
      'credentials/x',
      'usernames/x',
      'invites/x',
      'signKeys/x/keys/k',
    ])
      for (const auth of [member, trainer, admin])
        for (const op of ['create', 'update', 'delete'] as const)
          expect(
            decide(rules, op, p, { auth, db: { [p]: { a: 1 } }, data: { a: 2 } }).allowed,
            `${op} ${p}`,
          ).toBe(false);
    // nothing is readable signed out
    for (const p of [
      `users/${C}`,
      `schedules/${C}`,
      'config/flags',
      'programs/p',
      'liveSessions/x',
    ])
      expect(decide(rules, 'get', p, { auth: null, db: { [p]: { a: 1 } } }).allowed, p).toBe(false);
  });
});

// ============================================== size caps vs client constants

describe('size caps: rules functions match the client registry (drift)', () => {
  const CAPS: [string, string, number][] = [
    ['sealedCk', 'default', MAX_PAYLOAD_BYTES],
    ['sealedCkPlan', 'plans', PLAN_MAX_BYTES],
    ['sealedCkSchedule', 'schedules', SCHEDULE_MAX_BYTES],
  ];
  /** base64 characters of an AES-GCM envelope sealed at the cap: padded payload + 16-byte tag */
  const b64len = (bytes: number) => Math.ceil((bytes + 16) / 3) * 4;

  it.each(CAPS)(
    '%s accepts what the client seals at its cap and refuses 10% more',
    (name, _label, cap) => {
      expect(fn(name, sealedShape(b64len(cap)))).toBe(true);
      // the rules never allow more than 10% above what the client may seal
      expect(fn(name, sealedShape(b64len(Math.ceil(cap * 1.1))))).toBe(false);
      expect(fn(name, sealedShape(99))).toBe(false); // below the minimum
      expect(fn(name, { ...sealedShape(), keyEpoch: 0 })).toBe(false);
      expect(fn(name, { enc: enc() })).toBe(false); // no keyEpoch
      expect(fn(name, { ...sealedShape(), enc: { ...enc(), salt: 'x' } })).toBe(false); // no salt, only { v, iv, ct }
      expect(fn(name, { ...sealedShape(), enc: { ...enc(), iv: 'A'.repeat(12) } })).toBe(false);
    },
  );

  it('each registry collection that has a maxBytes is bound to a rules function with the same cap', () => {
    const maxed = Object.entries(NEW_COLLECTIONS).filter(([, s]) => 'maxBytes' in s);
    expect(maxed.map(([k]) => k).sort()).toEqual(['plans', 'schedules', 'versions']);
    for (const [name, spec] of maxed) {
      const rulesFn = name === 'schedules' ? 'sealedCkSchedule' : 'sealedCkPlan';
      const bytes = (spec as { maxBytes: number }).maxBytes;
      expect(fn(rulesFn, sealedShape(b64len(bytes))), name).toBe(true);
    }
  });

  it('the real sealer produces documents the cap accepts, at the largest payload it allows', async () => {
    const { w } = await enforced();
    await w.publishKey();
    const ring = (await w.clientRings.current(CID)) as ChatKeyRing;
    const ctx = { messageId: C, fromUid: T, at: NOW };
    const fill = async (
      name: 'schedules' | 'plans' | 'notes',
      cap: number,
      extra: Doc,
      secretKey: string,
    ) => {
      // the largest string that still seals
      let lo = 0;
      let hi = cap;
      let best: Doc | null = null;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        try {
          best = await sealOrThrow(
            name,
            { ...extra, [secretKey]: 'x'.repeat(mid) },
            { vault: w.cv, ring, ctx },
          );
          lo = mid + 1;
        } catch {
          hi = mid - 1;
        }
      }
      return best!;
    };
    const sched = await fill(
      'schedules',
      SCHEDULE_MAX_BYTES,
      { clientId: C, trainerId: T, rev: 1, updatedAt: NOW },
      'cancelled',
    );
    expect(fn('sealedCkSchedule', sched)).toBe(true);
    expect(fn('sealedCkPlan', sched)).toBe(true); // the plan cap is bigger than the schedule cap
    expect(fn('sealedCk', sched)).toBe(false); // the chat / note cap (8000 bytes) refuses it
    const plan = await fill(
      'plans',
      PLAN_MAX_BYTES,
      { clientId: C, trainerId: T, programId: 'p', liveVersion: 0, rev: 1, updatedAt: NOW },
      'dayNotes',
    );
    expect(fn('sealedCkPlan', plan)).toBe(true);
    expect(fn('sealedCkSchedule', plan)).toBe(false); // 180000 bytes do not fit the schedule cap
    const note = await fill(
      'notes',
      MAX_PAYLOAD_BYTES,
      { id: 'n', by: T, at: NOW, updatedAt: NOW },
      'text',
    );
    expect(fn('sealedCk', note)).toBe(true);
  });
});

// ========================================= helpers, truth tables

describe('rules helpers', () => {
  it('validCk: exactly the wrap shape', () => {
    expect(fn('validCk', ckWrap())).toBe(true);
    expect(fn('validCk', { ...ckWrap(), extra: 1 })).toBe(false);
    expect(fn('validCk', { ...ckWrap(), ct: 'A'.repeat(63) })).toBe(false);
    expect(fn('validCk', { ...ckWrap(), fp: 'a'.repeat(15) })).toBe(false);
    expect(fn('validCk', { ...ckWrap(), epoch: 0 })).toBe(false);
    expect(fn('validCk', { ...ckWrap(), epk: { ...ckWrap().epk, d: 'private!' } })).toBe(false);
  });

  it('inConv / activeConv follow coaching.status and the conversation parties', () => {
    const db = {
      [`conversations/${CID}`]: { clientId: C, trainerId: T, active: true },
      [`coaching/${C}`]: { trainerId: T, status: 'active' },
      [`users/${T}`]: { role: 'trainer', status: 'active' },
      'users/x': { role: 'member', status: 'active' },
    };
    const call = (name: string, auth: Ctx['auth'], d = db) =>
      callRulesFn(rules, name, [CID], { auth, db: d });
    expect(call('inConv', member)).toBe(true);
    expect(call('inConv', trainer)).toBe(true);
    expect(call('inConv', { uid: 'x', token: { role: 'trainer' } })).toBe(false);
    expect(call('activeConv', trainer)).toBe(true);
    const ended = { ...db, [`coaching/${C}`]: { trainerId: T, status: 'ended' } };
    expect(call('inConv', trainer, ended)).toBe(false); // a removed trainer reads nothing
    expect(call('inConv', member, ended)).toBe(true); // the client keeps their side
    expect(call('activeConv', member, ended)).toBe(false); // nobody writes into an ended conversation
    // a member-role token cannot act as the coach even when the uid matches
    expect(call('inConv', { uid: T, token: { role: 'member' } })).toBe(false);
  });

  it('epochOk: the document uses the published epoch; the client may write epoch 1 before the first wrap', () => {
    const conv = (e?: number) => ({
      [`conversations/${CID}`]: {
        clientId: C,
        trainerId: T,
        ...(e === undefined ? {} : { keyEpoch: e }),
      },
    });
    const ok = (auth: Ctx['auth'], e: number, db: Record<string, Doc>) =>
      callRulesFn(rules, 'epochOk', [CID, e], { auth, db });
    expect(ok(member, 2, conv(2))).toBe(true);
    expect(ok(member, 1, conv(2))).toBe(false); // stale epoch
    expect(ok(member, 1, conv(0))).toBe(true);
    expect(ok(trainer, 1, conv(0))).toBe(false); // the trainer never can
    expect(ok(trainer, 1, conv())).toBe(false);
  });
});

// ================================================== real client write shapes

describe('client write shapes against the rules (real adapters)', () => {
  it('key publish: only the client writes ck + keyEpoch; the trainer cannot', async () => {
    const { w, c } = await enforced();
    await w.publishKey();
    expect(c.denied).toEqual([]);
    expect(c.allowedWrites).toContain(`update:conversations/${CID}`);
    const conv = (await w.fs.get(`conversations/${CID}`))!;
    expect(conv.keyEpoch).toBe(1);
    // the trainer tries to replace the wrap
    await denied(w.tfs.update(`conversations/${CID}`, { ck: conv.ck, keyEpoch: 2 }));
    await denied(w.tfs.update(`conversations/${CID}`, { active: false }));
    // the client cannot move the epoch backwards, nor smuggle another field
    await denied(
      w.cfs.update(`conversations/${CID}`, { ck: { ...(conv.ck as Doc), epoch: 0 }, keyEpoch: 0 }),
    );
    await denied(w.cfs.update(`conversations/${CID}`, { ck: conv.ck, keyEpoch: 1, trainerId: C }));
    // a trainer device unwraps it
    const cur = await w.trainerProvider().current(CID);
    expect(cur.epoch).toBe(1);
  });

  it('rotation: the client writes ck + the keyring wrap of the old epoch, in an order the rules accept', async () => {
    const { w, c, t } = await enforced();
    await w.publishKey();
    await w.fs.update(`conversations/${CID}`, { rotateDue: true }); // the server asks for a rotation
    const ring2 = await w.clientRings.current(CID);
    expect(ring2.epoch).toBe(2);
    await w.fs.update(`conversations/${CID}`, { rotateDue: false });
    expect(c.denied).toEqual([]);
    // the wrap of epoch 1 is stored for the trainer's key and the trainer reads it
    expect(w.fs.has(`conversations/${CID}/keyring/1`)).toBe(true);
    expect(c.allowedWrites.some((x) => x.endsWith(`keyring/1`))).toBe(true);
    const tp = w.trainerProvider();
    expect((await tp.past(CID, 2)).has(1)).toBe(true);
    expect(t.denied).toEqual([]);
    // only the client writes the ring, only past epochs, only for the right epoch number, never deleted
    const row = (await w.fs.get(`conversations/${CID}/keyring/1`))!;
    await denied(w.tfs.set(`conversations/${CID}/keyring/3`, { ...row, epoch: 3, ck: ckWrap(3) }));
    await denied(w.cfs.set(`conversations/${CID}/keyring/2`, { ...row, epoch: 2, ck: ckWrap(2) })); // = current, not past
    await denied(w.cfs.set(`conversations/${CID}/keyring/1`, { ...row, epoch: 5, ck: ckWrap(5) })); // path != epoch
    await denied(w.cfs.set(`conversations/${CID}/keyring/1`, { ...row, extra: 1 }));
    await denied(w.tfs.set(`conversations/${CID}/keyring/1`, row)); // a valid row, but written by the trainer
    await denied(w.cfs.del(`conversations/${CID}/keyring/1`));
    await denied(w.tfs.del(`conversations/${CID}/keyring/1`));
  });

  it('a removed trainer reads no key, no ring, no schedule and no plan; the client keeps theirs', async () => {
    const { w } = await enforced();
    await w.publishKey();
    await w.fs.update(`conversations/${CID}`, { rotateDue: true });
    await w.clientRings.current(CID);
    w.fs.seed(`schedules/${C}`, {
      clientId: C,
      trainerId: T,
      rev: 1,
      updatedAt: 1,
      ...sealedShape(),
    });
    w.fs.seed(`plans/${C}`, {
      clientId: C,
      trainerId: T,
      programId: 'p',
      liveVersion: 1,
      rev: 1,
      updatedAt: 1,
      ...sealedShape(),
    });
    await w.tfs.get(`schedules/${C}`);
    await w.tfs.get(`conversations/${CID}/keyring/1`);
    await w.fs.update(`coaching/${C}`, { status: 'ended' }); // what coachEnd does
    await denied(w.tfs.get(`schedules/${C}`));
    await denied(w.tfs.get(`plans/${C}`));
    await denied(w.tfs.get(`conversations/${CID}/keyring/1`));
    await denied(w.tfs.getDocs(`conversations/${CID}/keyring`, {}));
    await w.cfs.get(`schedules/${C}`);
    await w.cfs.get(`conversations/${CID}/keyring/1`);
  });

  it('notes and schedules: the trainer writes them sealed; the client cannot; stale epochs and big docs are refused', async () => {
    const { w } = await enforced();
    await w.publishKey();
    const tring = await w.trainerRings.current(CID);
    const ctx = { messageId: 'n1', fromUid: T, at: NOW };
    const note = await sealOrThrow(
      'notes',
      { id: 'n1', by: T, at: NOW, updatedAt: NOW, text: 'knee' },
      { vault: w.tv, ring: tring, ctx },
    );
    await w.tfs.set(`conversations/${CID}/notes/n1`, note);
    await denied(w.cfs.set(`conversations/${CID}/notes/n2`, { ...note, id: 'n2' })); // the client writes no coach notes
    await denied(w.tfs.set(`conversations/${CID}/notes/n3`, { ...note, id: 'n3', keyEpoch: 2 })); // not the published epoch
    await denied(w.tfs.set(`conversations/${CID}/notes/n4`, { ...note, id: 'n4', by: C })); // authorship
    await denied(
      w.tfs.set(`conversations/${CID}/notes/n5`, { ...note, id: 'n5', plaintext: 'knee' }),
    ); // undeclared field

    const sctx = { messageId: C, fromUid: T, at: NOW };
    const open = { clientId: C, trainerId: T, rev: 1, updatedAt: NOW };
    const big = await sealOrThrow(
      'schedules',
      { ...open, cancelled: 'x'.repeat(110_000) },
      { vault: w.tv, ring: tring, ctx: sctx },
    );
    await w.tfs.set(`schedules/${C}`, big); // 8000 bytes would have been too-large before iteration 12
    await denied(w.cfs.set(`schedules/${C}`, { ...big, rev: 2 }));
    await denied(w.tfs.set(`schedules/${C}`, { ...big, rev: 3 })); // rev must be +1
    const next = await sealOrThrow(
      'schedules',
      { ...open, rev: 2, cancelled: 'y' },
      { vault: w.tv, ring: tring, ctx: sctx },
    );
    await w.tfs.set(`schedules/${C}`, next);
    await denied(w.tfs.set(`schedules/${C}`, { ...next, rev: 3, enc: enc(170_000) })); // above the 120000-byte cap
    await denied(w.tfs.del(`schedules/${C}`));
  });

  it('program port: draft, send (programs/prg-*), publish; the member reads exactly the assigned program', async () => {
    const { w, t, c } = await enforced();
    await w.publishKey();
    w.trainerBook.start();
    w.clientBook.start();
    await w.trainerBook.ready();
    await w.clientBook.ready();
    // the Admin SDK side of publishPlanVersion (functions bypass rules)
    w.fs.onCall('publishPlanVersion', async (data) => {
      const n = Number(data.n);
      const plan = (await w.fs.get(`plans/${C}`))!;
      const live = Number(plan.liveVersion ?? 0);
      if (live > 0) await w.fs.update(`plans/${C}/versions/${live}`, { state: 'superseded' });
      const ver = (await w.fs.get(`plans/${C}/versions/${n}`))!;
      await w.fs.update(`plans/${C}/versions/${n}`, { state: 'live', publishedAt: NOW });
      await w.fs.update(`plans/${C}`, {
        liveVersion: n,
        programId: ver.programId,
        rev: Number(plan.rev) + 1,
        updatedAt: NOW,
      });
      await w.fs.update(`programs/${String(ver.programId)}`, { status: 'active', updatedAt: NOW });
      await w.fs.set(`assignments/${C}`, {
        memberId: C,
        programId: ver.programId,
        assignedBy: T,
        startedAt: NOW,
      });
      return { liveVersion: n };
    });
    const base = buildFixtureWorld().clients[0];
    const roster = [{ ...base, id: C, name: 'Oleh', program: 'UL', trainerDays: ['Tue'] }] as never;
    const port = createFirestoreProgramPort({
      fs: t,
      vault: w.tv,
      trainer: { id: T, name: 'Iryna' },
      book: w.trainerBook,
      roster: () => roster,
    });
    const draft = { ...olehDraft(T), name: 'Upper/Lower 4x' };
    await port.saveDraft(C, { draft, trainerDays: ['Tue'], baseRev: 0 });
    expect(w.fs.has(`programs/prg-${C}-1`)).toBe(false);
    const sent = await port.send(C, { draft, trainerDays: ['Tue'], baseRev: 1 });
    expect(t.denied).toEqual([]);
    expect(t.allowedWrites).toEqual(
      expect.arrayContaining([
        `create:plans/${C}`,
        `create:plans/${C}/versions/1`,
        `create:programs/prg-${C}-1`,
      ]),
    );

    // the member: reads the live version, not a draft; reads the assigned program only
    await c.get(`plans/${C}/versions/1`);
    await port.saveDraft(C, {
      draft: { ...draft, name: 'v2' },
      trainerDays: ['Tue'],
      baseRev: sent.rev,
    });
    await denied(c.get(`plans/${C}/versions/2`)); // a draft is the trainer's
    await c.get(`programs/prg-${C}-1`);
    w.fs.seed('programs/other', { id: 'other', authorId: 'someone' });
    await denied(c.get('programs/other'));
    // the member cannot publish, claim a program as the trainer's, or edit the trainer's program
    await denied(w.cfs.set(`programs/prg-${C}-9`, { id: 'x', authorId: T }));
    await denied(w.cfs.update(`programs/prg-${C}-1`, { name: 'mine now' }));
    await denied(w.cfs.set(`assignments/${C}`, { memberId: C, programId: 'other', assignedBy: C }));
    await denied(
      w.cfs.set(`plans/${C}`, {
        clientId: C,
        trainerId: C,
        programId: 'p',
        rev: 9,
        updatedAt: 1,
        ...sealedShape(),
      }),
    );
    // the member port reads the layer under the rules too
    const cp = createFirestoreClientPort({
      fs: c,
      vault: w.cv,
      uid: C,
      plan: { ringFor: w.clientBook.ringFor, ready: w.clientBook.ready },
    });
    w.fs.onCall('coachMyLink', () => ({
      linked: true,
      trainer: { id: T, name: 'Iryna' },
      since: NOW,
      cid: CID,
      mode: 'app',
      consentVersion: 1,
    }));
    const snap = await new Promise<{ program: { version: number } | null }>((res, rej) => {
      const off = cp.subscribe((s) => s.program && (off(), res(s as never)), rej);
    });
    expect(snap.program!.version).toBe(1);
    expect(c.denied.filter((d) => d.path.includes('versions/2'))).toHaveLength(1); // only the deliberate probe above
  });
});

// ======================================================== live session doc

describe('liveSessions: the writer and the allow-list', () => {
  const wk = (over: Partial<Workout> = {}): Workout =>
    ({
      id: 'w1',
      startedAt: NOW - 60_000,
      finishedAt: null,
      autoFinished: false,
      gymId: 'g1',
      dayName: 'Lower A',
      exercises: [
        {
          id: 'e1',
          name: 'Squat',
          position: 0,
          sets: [{ id: 's', reps: 5, weight: 100, isWarmup: false }],
        },
      ],
      ...over,
    }) as unknown as Workout;
  const input = (over: Partial<LiveWriterInput> = {}): LiveWriterInput => ({
    active: true,
    trainerId: T,
    cid: CID,
    totals: 'full',
    workouts: [wk()],
    athleteName: 'Anna',
    gymName: () => 'Gym',
    ...over,
  });
  async function live() {
    const { w, c, t } = await enforced();
    await w.publishKey();
    w.clientBook.start();
    await w.clientBook.ready();
    const writer = createLiveWriter({
      fs: c,
      vault: w.cv,
      uid: C,
      ring: async () => w.clientBook.ringFor(C)!,
    });
    return { w, c, t, writer };
  }

  it('start, heartbeat, finish and consent-off are all accepted by the rules', async () => {
    const { w, c, writer } = await live();
    await writer.sync(input());
    w.fs.setNow(NOW + LIVE_BEAT_MS + 1);
    await writer.beat();
    await writer.sync(input({ workouts: [wk({ finishedAt: NOW + LIVE_BEAT_MS })] }));
    await writer.sync(input({ totals: 'off' }));
    expect(c.denied).toEqual([]);
    expect(
      c.allowedWrites.filter((x) => x.endsWith(`liveSessions/${C}`)).map((x) => x.split(':')[0]),
    ).toEqual(['create', 'update', 'update', 'delete']);
    expect(w.fs.has(`liveSessions/${C}`)).toBe(false);
  });

  it('a doc with a set, a weight, a note or the wrong trainer is refused', async () => {
    const { w, c, t, writer } = await live();
    await writer.sync(input());
    const doc = (await w.fs.get(`liveSessions/${C}`))!;
    for (const extra of [
      { sets: [{ reps: 5 }] },
      { weight: 100 },
      { notes: 'x' },
      { exercise: 'Squat' },
    ])
      await denied(c.set(`liveSessions/${C}`, { ...doc, ...extra }));
    await denied(c.set(`liveSessions/${C}`, { ...doc, trainerId: 'someone-else' }));
    await denied(c.set(`liveSessions/${C}`, { ...doc, id: 'other' }));
    await denied(c.set(`liveSessions/${C}`, { ...doc, updatedAt: 'now' }));
    await denied(c.set(`liveSessions/${C}`, { ...doc, enc: enc(20_000) }));
    // the trainer reads it (only his client's) and cannot write it
    await t.get(`liveSessions/${C}`);
    await denied(t.update(`liveSessions/${C}`, { updatedAt: 1 }));
    w.fs.seed('liveSessions/stranger', { ...doc, id: 'stranger', trainerId: 'another-trainer' });
    await denied(t.get('liveSessions/stranger'));
    // the legacy presence-only shape stays valid
    await c.set(`liveSessions/${C}`, { id: C, trainerId: T, startedAt: 1, updatedAt: 2 });
  });
});
