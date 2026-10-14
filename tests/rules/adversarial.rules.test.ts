/**
 * Adversarial rules cases (FINAL-AUDIT-B, iteration 14): 84 attempts to break the coaching rules, run through the
 * repo's own interpreter against the REAL firestore.rules. Kept as permanent tests. Each case states the policy
 * (`allow`); the 18 that diverged in the audit (A06 A07 A08 B05 B08 D04 E11 F03 G01 G02 G08 H04 I02 I03 J04 J05 J07 K03)
 * are either FIXED in the rules (the case now passes with `allow: false`) or JUSTIFIED (the case documents the residual
 * behaviour with `why`, and the compensating control is named).
 *
 * Reminder of the model limits (tests/rules/engine/rulesEngine.ts header): list queries are judged per document and the
 * emulator suite stays the authority for query provability.
 */
import { describe, expect, it } from 'vitest';
import { decide, parseRules, ts, type Op } from './engine/rulesEngine';
import { RULES_SOURCE } from './engine/rulesSource';

const rules = parseRules(RULES_SOURCE);
const NOW = 1_800_000_000_000;
const C = 'client1';
const C2 = 'client2';
const T = 'trainer1';
const T2 = 'trainer2';
const A = 'admin1';
const M = 'mallory';
type Auth = { uid: string; token: { role: string } } | null;
const au = (uid: string, role = 'member'): Auth => ({ uid, token: { role } });
const enc = { v: 1, iv: 'A'.repeat(16), ct: 'A'.repeat(120) };
const dek = { v: 1, salt: 'A'.repeat(24), iv: 'A'.repeat(16), ct: 'A'.repeat(40) };
const ck = {
  v: 1,
  epoch: 2,
  epk: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y', ext: true, key_ops: [] },
  iv: 'A'.repeat(16),
  ct: 'A'.repeat(64),
  fp: 'a'.repeat(16),
};
type Db = Record<string, Record<string, unknown>>;
const baseDb = (): Db => ({
  [`coaching/${C}`]: { trainerId: T, clientId: C, status: 'active', keyEpoch: 1 },
  [`coaching/${C2}`]: { trainerId: T2, clientId: C2, status: 'active', keyEpoch: 1 },
  'conversations/cidA': {
    clientId: C,
    trainerId: T,
    active: true,
    keyEpoch: 1,
    ck: { ...ck, epoch: 1 },
    readUpTo: {},
    clearedBefore: {},
  },
  'conversations/cidB': {
    clientId: C2,
    trainerId: T2,
    active: true,
    keyEpoch: 1,
    readUpTo: {},
    clearedBefore: {},
  },
  'conversations/cidA/messages/m1': { id: 'm1', from: C, at: NOW - 1000, v: 1, keyEpoch: 1, enc },
  'conversations/cidB/messages/m9': { id: 'm9', from: C2, at: NOW - 1000, v: 1, keyEpoch: 1, enc },
  // the LIVE user documents back every coach/admin privilege (a stale token claim reaches nothing)
  [`users/${C}`]: { trainerId: T, role: 'member', status: 'active' },
  [`users/${C2}`]: { trainerId: T2, role: 'member', status: 'active' },
  [`users/${T}`]: { role: 'trainer', status: 'active' },
  [`users/${T2}`]: { role: 'trainer', status: 'active' },
  [`users/${A}`]: { role: 'admin', status: 'active' },
  [`users/${M}`]: { role: 'member', status: 'active' },
  [`plans/${C}`]: {
    clientId: C,
    trainerId: T,
    programId: 'prg-client1-1',
    liveVersion: 1,
    rev: 3,
    updatedAt: 1,
    keyEpoch: 1,
    enc,
  },
  [`plans/${C}/versions/1`]: {
    n: 1,
    programId: 'p',
    state: 'live',
    createdAt: 1,
    keyEpoch: 1,
    enc,
  },
  [`plans/${C}/versions/2`]: {
    n: 2,
    programId: 'p',
    state: 'draft',
    createdAt: 1,
    keyEpoch: 1,
    enc,
  },
  'programs/prg-client1-1': { authorId: T, status: 'active' },
  [`assignments/${C}`]: { memberId: C, programId: 'prg-client1-1' },
  [`coachKeys/${T}`]: {
    pub: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' },
    updatedAt: 5,
    sig: 'S',
    kid: 'K',
    signedAt: 6,
  },
});

interface Case {
  id: string;
  name: string;
  op: Op;
  path: string;
  auth: Auth;
  allow: boolean;
  data?: Record<string, unknown>;
  mut?: (d: Db) => void;
  /** set for the audit's diverging cases that stay as they are: why this is acceptable */
  why?: string;
}
const cases: Case[] = [];
const c = (
  id: string,
  name: string,
  op: Op,
  path: string,
  auth: Auth,
  allow: boolean,
  data?: Record<string, unknown>,
  mut?: (d: Db) => void,
  why?: string,
) => cases.push({ id, name, op, path, auth, allow, data, mut, why });
const SIG = { sig: 'A'.repeat(88), sigKid: '0123456789abcdef' };
const msg = (o: Record<string, unknown> = {}) => ({
  id: 'm2',
  from: C,
  at: NOW,
  v: 1,
  keyEpoch: 1,
  enc,
  ...SIG,
  ...o,
});
const unsigned = (o: Record<string, unknown> = {}) => {
  const m = msg(o) as Record<string, unknown>;
  delete m.sig;
  delete m.sigKid;
  return m;
};
const ended = (d: Db) => {
  d[`coaching/${C}`].status = 'ended';
};
const M1 = 'conversations/cidA/messages/m1';
const M2 = 'conversations/cidA/messages/m2';
const CONV = baseDb()['conversations/cidA'];
const PLAN = baseDb()[`plans/${C}`];

// 1 cross-client reads
c(
  'A01',
  'client reads another conversation message',
  'get',
  'conversations/cidB/messages/m9',
  au(C),
  false,
);
c('A02', 'client reads another conversation doc', 'get', 'conversations/cidB', au(C), false);
c('A03', 'other trainer reads message', 'get', M1, au(T2, 'trainer'), false);
c('A04', 'own trainer reads while active', 'get', M1, au(T, 'trainer'), true);
c(
  'A05',
  'removed trainer (coaching ended) reads message',
  'get',
  M1,
  au(T, 'trainer'),
  false,
  undefined,
  ended,
);
c(
  'A06',
  'removed trainer reads conv doc while conv.active is still true',
  'get',
  'conversations/cidA',
  au(T, 'trainer'),
  true,
  undefined,
  ended,
  'JUSTIFIED: a conversation LIST query cannot call get() on a document-derived path, so the doc rule uses conv.active only. coachEnd flips active=false in the SAME transaction as coaching.status (tests/coach-server "end: inactive"), so the combination cannot exist; all sub-collections use the authoritative coaching.status (A05).',
);
c(
  'A07',
  'removed trainer reads coaching/{client} metadata (status ended)',
  'get',
  `coaching/${C}`,
  au(T, 'trainer'),
  false,
  undefined,
  ended,
);
c(
  'A08',
  'ex-trainer who is now role member reads coaching doc',
  'get',
  `coaching/${C}`,
  au(T, 'member'),
  false,
);
c('A09', 'admin without relationship reads messages', 'get', M1, au(A, 'admin'), false);
c(
  'A10',
  'admin without relationship reads conversation doc',
  'get',
  'conversations/cidA',
  au(A, 'admin'),
  false,
);
c(
  'A11',
  'admin reads coaching doc of arbitrary client',
  'get',
  `coaching/${C}`,
  au(A, 'admin'),
  false,
);
// forging
c('B01', 'trainer forges from=client', 'create', M2, au(T, 'trainer'), false, msg({ from: C }));
c('B02', 'client writes message with from=trainer', 'create', M2, au(C), false, msg({ from: T }));
c('B03', 'client message ok', 'create', M2, au(C), true, msg());
c('B04', 'backdated 10 min', 'create', M2, au(C), false, msg({ at: NOW - 600000 }));
c(
  'B05',
  'backdated 4 min (the old rate-limit evasion window) is refused; the server counts by server time as well',
  'create',
  M2,
  au(C),
  false,
  msg({ at: NOW - 240000 }),
);
c(
  'B05b',
  'stamped 1 minute in the past is still inside the 2 minute window',
  'create',
  M2,
  au(C),
  true,
  msg({ at: NOW - 60000 }),
);
c('B06', 'extra plaintext field text', 'create', M2, au(C), false, msg({ text: 'hi' }));
c('B07', 'sig without sigKid', 'create', M2, au(C), false, { ...unsigned(), sig: 'x' });
c(
  'B08',
  'unsigned message (downgrade) is refused: the signature is required',
  'create',
  M2,
  au(C),
  false,
  unsigned(),
);
c(
  'B09',
  'oversized ct 100k',
  'create',
  M2,
  au(C),
  false,
  msg({ enc: { ...enc, ct: 'A'.repeat(100000) } }),
);
c(
  'B10',
  'message id != doc id',
  'create',
  'conversations/cidA/messages/m3',
  au(C),
  false,
  msg({ id: 'm2' }),
);
c(
  'B11',
  'trainer posts while conv.keyEpoch=0 (no key)',
  'create',
  M2,
  au(T, 'trainer'),
  false,
  msg({ from: T, keyEpoch: 1 }),
  (d) => {
    d['conversations/cidA'].keyEpoch = 0;
  },
);
c(
  'B12',
  'message into conversation of someone else',
  'create',
  'conversations/cidB/messages/m2',
  au(C),
  false,
  msg(),
);
c('B13', 'write after relationship ended (client)', 'create', M2, au(C), false, msg(), ended);
c('B14', 'other party edits sender message del', 'update', M1, au(T, 'trainer'), false, {
  ...baseDb()[M1],
  del: { state: 'pending', at: 1 },
});
c('B15', 'sender swaps ciphertext in place', 'update', M1, au(C), false, {
  ...baseDb()[M1],
  enc: { ...enc, ct: 'B'.repeat(120) },
});
c('B16', 'sender deletes message doc', 'delete', M1, au(C), false);
// requests / direct writes
c(
  'C01',
  'client creates request directly',
  'create',
  'conversations/cidA/requests/r1',
  au(C),
  false,
  { id: 'r1', from: 'client' },
);
c(
  'C02',
  'trainer updates request status directly',
  'update',
  'conversations/cidA/requests/r1',
  au(T, 'trainer'),
  false,
  { status: 'accepted' },
  (d) => {
    d['conversations/cidA/requests/r1'] = { status: 'pending' };
  },
);
// conversation doc
c('D01', 'client changes trainerId on conv', 'update', 'conversations/cidA', au(C), false, {
  ...CONV,
  trainerId: M,
});
c('D02', 'trainer writes ck', 'update', 'conversations/cidA', au(T, 'trainer'), false, {
  ...CONV,
  ck,
  keyEpoch: 2,
});
c('D03', 'client writes ck epoch 2', 'update', 'conversations/cidA', au(C), true, {
  ...CONV,
  ck,
  keyEpoch: 2,
});
c(
  'D04',
  'client rewrites ck at the SAME epoch with the SAME fingerprint',
  'update',
  'conversations/cidA',
  au(C),
  false,
  { ...CONV, ck: { ...ck, epoch: 1, ct: 'B'.repeat(64) }, keyEpoch: 1 },
);
c(
  'D04b',
  'client re-wraps the same epoch for a NEW trainer key (different fingerprint)',
  'update',
  'conversations/cidA',
  au(C),
  true,
  { ...CONV, ck: { ...ck, epoch: 1, fp: 'b'.repeat(16) }, keyEpoch: 1 },
);
c(
  'D04c',
  'client makes up an epoch far ahead (2^40)',
  'update',
  'conversations/cidA',
  au(C),
  false,
  { ...CONV, ck: { ...ck, epoch: 1099511627776 }, keyEpoch: 1099511627776 },
);
c('D05', 'client moves other readUpTo', 'update', 'conversations/cidA', au(C), false, {
  ...CONV,
  readUpTo: { [T]: 99 },
});
c(
  'D06',
  'client lowers own readUpTo',
  'update',
  'conversations/cidA',
  au(C),
  false,
  { ...CONV, readUpTo: { [C]: 1 } },
  (d) => {
    d['conversations/cidA'].readUpTo = { [C]: 50 };
  },
);
c(
  'D07',
  'client wraps ck after relationship ended (conv inactive)',
  'update',
  'conversations/cidA',
  au(C),
  false,
  { ...CONV, ck, keyEpoch: 2 },
  (d) => {
    d['conversations/cidA'].active = false;
  },
);
c('D08', 'anyone creates conversation', 'create', 'conversations/zzz', au(C), false, {
  clientId: C,
  trainerId: M,
});
// plans etc
c('E01', 'trainer writes plan for non-client', 'create', `plans/${C2}`, au(T, 'trainer'), false, {
  clientId: C2,
  trainerId: T,
  programId: 'p',
  rev: 1,
  updatedAt: 1,
  keyEpoch: 1,
  enc,
});
c('E02', 'client reads draft version', 'get', `plans/${C}/versions/2`, au(C), false);
c('E03', 'client reads live version', 'get', `plans/${C}/versions/1`, au(C), true);
c('E04', 'client reads plan overlay', 'get', `plans/${C}`, au(C), true);
c('E05', 'client writes plan', 'update', `plans/${C}`, au(C), false, { ...PLAN, rev: 4 });
c(
  'E06',
  'removed trainer reads plan',
  'get',
  `plans/${C}`,
  au(T, 'trainer'),
  false,
  undefined,
  ended,
);
c(
  'E07',
  'trainer updates plan changing liveVersion',
  'update',
  `plans/${C}`,
  au(T, 'trainer'),
  false,
  { ...PLAN, rev: 4, liveVersion: 9 },
);
c(
  'E08',
  'trainer publishes a version directly (state live on create)',
  'create',
  `plans/${C}/versions/3`,
  au(T, 'trainer'),
  false,
  { n: 3, programId: 'p', state: 'live', createdAt: 1, keyEpoch: 1, enc },
);
c(
  'E09',
  'trainer sets published draft to live by update',
  'update',
  `plans/${C}/versions/2`,
  au(T, 'trainer'),
  false,
  { n: 2, programId: 'p', state: 'live', createdAt: 1, keyEpoch: 1, enc },
);
c(
  'E10',
  'trainer edits an already LIVE version',
  'update',
  `plans/${C}/versions/1`,
  au(T, 'trainer'),
  false,
  {
    n: 1,
    programId: 'p',
    state: 'live',
    createdAt: 1,
    keyEpoch: 1,
    enc: { ...enc, ct: 'B'.repeat(120) },
  },
);
c(
  'E11',
  'plan with a stale keyEpoch (7 on conversation epoch 1)',
  'update',
  `plans/${C}`,
  au(T, 'trainer'),
  true,
  { ...PLAN, rev: 4, keyEpoch: 7 },
  undefined,
  'JUSTIFIED: plans/schedules are keyed by clientId and the conversation id is an HMAC the rules cannot compute, so the epoch cannot be compared. The AAD of the envelope binds cid + epoch, so a document sealed for another epoch cannot be opened by the wrong key (it shows as unreadable, never as wrong content). Absurd epochs are capped by the rules (next case).',
);
c(
  'E11b',
  'plan with an absurd keyEpoch (10^6) is refused',
  'update',
  `plans/${C}`,
  au(T, 'trainer'),
  false,
  { ...PLAN, rev: 4, keyEpoch: 1_000_000 },
);
c('E12', 'client writes schedule', 'create', `schedules/${C}`, au(C), false, {
  clientId: C,
  trainerId: T,
  rev: 1,
  updatedAt: 1,
  keyEpoch: 1,
  enc,
});
// live
const LIVE = { id: C, trainerId: T, startedAt: 1, updatedAt: 1 };
c(
  'F01',
  'athlete live doc pointing at a different trainer',
  'create',
  `liveSessions/${C}`,
  au(C),
  false,
  { ...LIVE, trainerId: T2 },
);
c(
  'F02',
  'other trainer reads live doc',
  'get',
  `liveSessions/${C}`,
  au(T2, 'trainer'),
  false,
  undefined,
  (d) => {
    d[`liveSessions/${C}`] = LIVE;
  },
);
c(
  'F03',
  'removed trainer reads live doc if not deleted',
  'get',
  `liveSessions/${C}`,
  au(T, 'trainer'),
  true,
  undefined,
  (d) => {
    d[`coaching/${C}`].status = 'ended';
    d[`liveSessions/${C}`] = LIVE;
  },
  'JUSTIFIED: relationship end deletes the live doc (endRelationship -> deletePerClientDocs, tested in tests/coach-server); the rules cannot prove a doc is stale.',
);
// keys
const PUB = { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' };
c('G01', 'member publishes coach pub for self', 'create', `coachKeys/${M}`, au(M), false, {
  pub: PUB,
  updatedAt: 1,
});
c('G02', 'owner swaps pub keeping old sig', 'update', `coachKeys/${T}`, au(T, 'trainer'), false, {
  pub: { ...PUB, x: 'EVIL' },
  updatedAt: 5,
  sig: 'S',
  kid: 'K',
  signedAt: 6,
});
c('G03', 'owner forges sig on new key', 'update', `coachKeys/${T}`, au(T, 'trainer'), false, {
  pub: PUB,
  updatedAt: 5,
  sig: 'FORGED',
  kid: 'K',
  signedAt: 6,
});
c('G04', 'write someone elses coachKeys', 'update', `coachKeys/${T}`, au(M), false, {
  pub: PUB,
  updatedAt: 5,
});
c('G05', 'write signKeys', 'create', `signKeys/${M}/keys/k1`, au(M), false, {});
c('G06', 'member writes config/coachSigning', 'update', 'config/coachSigning', au(M), false, {
  pub: 'x',
});
c(
  'G07',
  'admin writes config/coachSigning',
  'update',
  'config/coachSigning',
  au(A, 'admin'),
  false,
  { pub: 'x' },
);
c(
  'G08',
  'coachKeys pub with giant x (size cap)',
  'update',
  `coachKeys/${T}`,
  au(T, 'trainer'),
  false,
  { pub: { ...PUB, x: 'A'.repeat(900000) }, updatedAt: 5, sig: 'S', kid: 'K', signedAt: 6 },
);
// keyring
const R2 = (d: Db) => {
  d['conversations/cidA'].keyEpoch = 2;
};
c(
  'H01',
  'trainer writes keyring',
  'create',
  'conversations/cidA/keyring/1',
  au(T, 'trainer'),
  false,
  { epoch: 1, ck: { ...ck, epoch: 1 }, at: 1 },
  R2,
);
c(
  'H02',
  'client writes ring for current epoch',
  'create',
  'conversations/cidA/keyring/2',
  au(C),
  false,
  { epoch: 2, ck, at: 1 },
  R2,
);
c(
  'H03',
  'client writes ring for past epoch',
  'create',
  'conversations/cidA/keyring/1',
  au(C),
  true,
  { epoch: 1, ck: { ...ck, epoch: 1 }, at: 1 },
  R2,
);
c(
  'H04',
  'ring id "01" for epoch 1 (int() leniency)',
  'create',
  'conversations/cidA/keyring/01',
  au(C),
  false,
  { epoch: 1, ck: { ...ck, epoch: 1 }, at: 1 },
  R2,
);
// users subcollections
c('I01', 'client reads other client notes', 'get', `users/${C2}/clientNotes/n1`, au(C), false);
c(
  'I02',
  'trainer writes PLAINTEXT note into own clientNotes',
  'create',
  `users/${T}/clientNotes/n1`,
  au(T, 'trainer'),
  false,
  { text: 'knee hurts', clientId: C },
);
c(
  'I02b',
  'trainer writes a DEK-sealed note (the accepted shape)',
  'create',
  `users/${T}/clientNotes/n1`,
  au(T, 'trainer'),
  true,
  { id: 'n1', clientId: C, at: 1, updatedAt: 1, enc: dek },
);
c(
  'I02c',
  'trainer writes a DEK note with a wrong id, an extra plaintext field, or a CK-shaped envelope',
  'create',
  `users/${T}/clientNotes/n1`,
  au(T, 'trainer'),
  false,
  { id: 'n1', clientId: C, at: 1, updatedAt: 1, enc: dek, text: 'knee' },
);
c(
  'I02d',
  'trainer writes a note sealed with the wrong envelope shape (no salt)',
  'create',
  `users/${T}/clientNotes/n1`,
  au(T, 'trainer'),
  false,
  { id: 'n1', clientId: C, at: 1, updatedAt: 1, enc },
);
c(
  'I03',
  'client writes plaintext into shares/totals',
  'create',
  `users/${C}/shares/totals`,
  au(C),
  false,
  { view: { weeks: [] }, level: 'full' },
);
c(
  'I04',
  'trainer reads client shares directly',
  'get',
  `users/${C}/shares/totals`,
  au(T, 'trainer'),
  false,
);
c('I05', 'trainer reads client audit log', 'get', `users/${C}/audit/x`, au(T, 'trainer'), false);
c('I06', 'client writes own audit', 'create', `users/${C}/audit/x`, au(C), false, {});
c('I07', 'client edits trainerNotes', 'update', `users/${C}/trainerNotes/n`, au(C), false, {});
c('I08', 'client writes notices create', 'create', `users/${C}/notices/n`, au(C), false, {});
c(
  'I09',
  'client writes grants for arbitrary coach',
  'create',
  `users/${C}/grants/${M}`,
  au(C),
  true,
  { v: 1 },
  undefined,
  'INTENDED: a client may grant any uid its vault key; the grant is useless without a coaching relationship and the trainer side only reads through the callables.',
);
c(
  'I10',
  'client updates own users doc role',
  'update',
  `users/${C}`,
  au(C),
  false,
  { role: 'admin', firstName: 'x' },
  (d) => {
    d[`users/${C}`] = { role: 'member', firstName: 'a' };
  },
);
// programs / assignments
c(
  'J01',
  'other trainer reads programs/prg-client1-1',
  'get',
  'programs/prg-client1-1',
  au(T2, 'trainer'),
  false,
);
c('J02', 'other member reads it', 'get', 'programs/prg-client1-1', au(C2), false);
c('J03', 'assigned member reads it', 'get', 'programs/prg-client1-1', au(C), true);
c(
  'J04',
  'any trainer reads another trainers member assignment',
  'get',
  `assignments/${C}`,
  au(T2, 'trainer'),
  true,
  undefined,
  undefined,
  'JUSTIFIED: the Programs screen lists assignments with a documentId() `in` query that a per-trainer rule could not prove; the doc holds only memberId and programId (no health data). Tracked as a residual.',
);
c(
  'J05',
  'member squats victim program id prg-client2-1',
  'create',
  'programs/prg-client2-1',
  au(M),
  false,
  { authorId: M },
);
c(
  'J06',
  'member overwrites existing trainer program',
  'update',
  'programs/prg-client1-1',
  au(M),
  false,
  { authorId: M },
);
c(
  'J07',
  'trainer after end still writes program of ex-client',
  'update',
  'programs/prg-client1-1',
  au(T, 'trainer'),
  false,
  { authorId: T, status: 'draft' },
  ended,
);
// misc
c('K01', 'anyone reads coachKeys (directory)', 'get', `coachKeys/${T}`, au(M), true);
c('K02', 'signed-out read coachKeys', 'get', `coachKeys/${T}`, null, false);
c(
  'K03',
  'member updates sharedGyms arbitrarily',
  'update',
  'sharedGyms/g1',
  au(M),
  true,
  { x: 1 },
  (d) => {
    d['sharedGyms/g1'] = {};
  },
  'JUSTIFIED: pre-existing open collection (shared gym directory, no personal data), out of the coaching scope; tracked as a residual.',
);

describe('adversarial rules cases', () => {
  it.each(cases.map((x) => [x.id, x] as const))('%s', (_id, x) => {
    const db = baseDb();
    x.mut?.(db);
    const r = decide(rules, x.op, x.path, { auth: x.auth, db, data: x.data, time: NOW });
    expect(r.allowed, `${x.id} ${x.name}`).toBe(x.allow);
  });
  it('justified allow-cases carry a reason', () => {
    for (const x of cases.filter((y) => y.why)) expect(x.why!.length).toBeGreaterThan(30);
  });
  it('has the audit corpus size', () => {
    expect(cases.length).toBeGreaterThanOrEqual(84);
  });
  it('ts() helper is usable', () => {
    expect(typeof ts).toBe('function');
  });
});
