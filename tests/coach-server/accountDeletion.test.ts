/**
 * Account deletion (SPO-285): the shared cascade and `deleteMyAccount`, on the in-memory Kv with fake ports (no Firebase,
 * no emulator, nothing real is ever deleted). "Registry empty after deletion" lists every path of the data registry
 * (SPO-252 R1-R43) and asserts it is gone, then sweeps what is left for any trace of the account.
 */
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryKv, type MemoryKv } from '../../functions/src/coach/memoryKv';
import {
  ATTEMPT_MAX,
  deleteAccountCascade,
  deleteTrainerAuthoredNotes,
  deleteMyAccountHandler,
  type DeleteMyAccountPorts,
} from '../../functions/src/accountDeletionCore';
import { coachAccept, coachInvite, type Actor, type Ctx } from '../../functions/src/coach/service';
import { conversationId } from '../../functions/src/coach/logic';

const T0 = Date.UTC(2026, 9, 22, 9, 0, 0);
const PEPPER = randomBytes(32);
const enc = { v: 1, iv: 'A'.repeat(16), ct: 'C'.repeat(120) };
let kv: MemoryKv;
let storage: Set<string>;
let calls: string[];
let failOn: string | null;
let n = 0;

const ctx = (): Ctx => ({
  kv,
  now: () => T0,
  pepper: PEPPER,
  newToken: () => `tok${(++n).toString().padStart(12, '0')}`,
  notify: async () => undefined,
});
const ports = (): DeleteMyAccountPorts => ({
  verifyPassword: (plain, hash) => hash === `h:${plain}`,
  async revokeSessions() {
    calls.push('revoke');
  },
  async deleteTree(path) {
    calls.push(`tree:${path}`);
    for (const p of kv.paths()) if (p === path || p.startsWith(`${path}/`)) await kv.del(p);
  },
  async deleteStorage(prefix) {
    calls.push(`storage:${prefix}`);
    if (failOn === 'storage') throw new Error('storage down');
    for (const o of [...storage]) if (o.startsWith(prefix)) storage.delete(o);
  },
  async walkTrainerAuthoredNotes(uid) {
    calls.push('legacy-notes-walk');
    for (const p of kv.paths())
      if (/^users\/[^/]+\/trainerNotes\/[^/]+$/.test(p) && (await kv.get(p))?.trainerId === uid)
        await kv.del(p);
  },
  async deleteAuthUser(uid) {
    calls.push(`auth:${uid}`);
    if (failOn === 'auth') throw new Error('auth down');
  },
});
const call = (uid: string | undefined, data: unknown) =>
  deleteMyAccountHandler(ctx(), ports(), { uid, data, now: T0 });
const body = { password: 'pw', confirm: true };
async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    const x = e as { code?: string; message?: string };
    if (x.code) return `${x.code}:${x.message}`;
    throw e;
  }
  return 'ok';
}
const user = (id: string, role: string, extra: Record<string, unknown> = {}) =>
  kv.set(`users/${id}`, {
    role,
    status: 'active',
    firstName: id,
    username: id,
    usernameLower: id,
    trainerId: null,
    ...extra,
  });
async function account(id: string, role = 'member', extra: Record<string, unknown> = {}) {
  await user(id, role, extra);
  await kv.set(`credentials/${id}`, { passwordHash: 'h:pw' });
  await kv.set(`usernames/${id}`, { userId: id });
  await kv.set(`users/${id}/workouts/w1`, { id: 'w1', enc });
}

/** Every user subcollection document the data registry lists (SPO-252 R8-R37 under `users/{uid}`). */
const USER_SUBPATHS = [
  'workouts/w1',
  'gyms/g1',
  'restPeriods/r1',
  'injuries/i1',
  'conditions/c1',
  'activities/a1',
  'sleeps/s1',
  'meta/body',
  'meta/cycle',
  'meta/nicotine',
  'meta/alcohol',
  'meta/supplements',
  'meta/coachShare',
  'meta/conditionPrefs',
  'meta/nutritionLog',
  'meta/nutritionFoods',
  'meta/nutritionGoal',
  'meta/nutritionProfile',
  'meta/goals',
  'meta/home',
  'meta/mastery',
  'meta/coach',
  'meta/chatKeys',
  'pings/p1',
  'reminderDismissals/d1',
  'push/dev1',
  'outbox/o1',
  'grants/t9',
  'shares/sleep',
  'notices/n1',
  'audit/au1',
  'trainerNotes/tn1',
  'clientNotes/cn1',
  'decisions/d1',
  'decisions/d1/evidence/sets',
  'consentLog/cl1',
  'consentRecords/cr1',
  'sessions/dev1',
  'keyLog/2026-10-22-1',
];

const A = 's1'; // the account that is deleted: a trainer who owns a team, with a client and everything else
const B = 'b1'; // a bystander with the same kinds of data
const NAME_FIRST = 'Zorian';
const NAME_LAST = 'Vexley';
const CID = () => conversationId(PEPPER, 'c1', A);

async function seedFull() {
  await account(A, 'trainer', {
    teamId: A,
    usernameLower: 's1name',
    firstName: NAME_FIRST,
    lastName: NAME_LAST,
  });
  await account('c1', 'member');
  await account('m1', 'manager', { teamId: A });
  await account('d1', 'member', { trainerId: A }); // legacy trainee
  await account(B, 'trainer', { teamId: B, usernameLower: 'b1name' });
  for (const id of [A, B]) {
    for (const p of USER_SUBPATHS) await kv.set(`users/${id}/${p}`, { id: p, owner: id, enc });
    await kv.set(`sleepSchedules/${id}`, { userId: id });
    await kv.set(`passkeys/pk-${id}`, { userId: id, publicKey: 'k' });
    await kv.set(`passkeyChallenges/ch-${id}`, { userId: id, challenge: 'x' });
    await kv.set(`loginAttempts/1.2.3.4|${id}name`, {
      count: 1,
      windowStart: T0,
      identifier: `${id}name`,
    });
    await kv.set(`invites/inv-${id}`, { userId: id, kind: 'invite' });
    await kv.set(`assignments/${id}`, { programId: `prg-${id}` });
    await kv.set(`programs/prg-${id}`, { authorId: id });
    await kv.set(`teams/${id}`, { ownerUid: id });
    await kv.set(`teams/${id}/members/${id}`, {
      uid: id,
      role: 'trainer',
      status: 'active',
      owner: true,
    });
    await kv.set(`teams/${id}/activity/act-${id}`, { actorUid: id, kind: 'member-added' });
    await kv.set(`teamInvites/ti-${id}`, { teamId: id, invitedBy: id, status: 'pending' });
    await kv.set(`teamRequests/rm-${id}`, {
      teamId: id,
      clientId: 'c1',
      requestedBy: 'm1',
      trainerId: id,
    });
    storage.add(`avatars/${id}/photo`);
  }
  await kv.set(`teams/${A}/members/m1`, { uid: 'm1', role: 'manager', status: 'active' });
  await kv.set(`teams/${A}/acl/m1`, { activityScope: 'all' });
  await kv.set('assignments/x1', { programId: `prg-${A}` });
  await kv.set('users/c1/trainerNotes/legacy', { trainerId: A, text: 'note by A' });
  // what the account left in OTHER teams' queues, where the owned-team branch does not reach (SPO-285 N6)
  await kv.set('teamInvites/ti-other', { teamId: B, invitedBy: A, status: 'pending' });
  await kv.set('teamRequests/rq-client', {
    teamId: B,
    clientId: A,
    requestedBy: 'm1',
    trainerId: B,
  });
  await kv.set('teamRequests/rq-by', { teamId: B, clientId: 'c1', requestedBy: A, trainerId: B });
  await kv.set('teamRequests/rq-trainer', {
    teamId: B,
    clientId: 'c1',
    requestedBy: 'm1',
    trainerId: A,
  });
  // records OTHER people hold about the account, kept by design (audit / consentLog / notices of those people)
  await kv.set('users/c1/audit/kept-1', { readerId: A, readerName: `${NAME_FIRST} ${NAME_LAST}` });
  await kv.set('users/c1/consentLog/kept-1', { actor: A, kind: 'totals' });
  await kv.set('users/c1/notices/kept-1', {
    id: 'kept-1',
    kind: 'program-assigned',
    actor: A,
    detail: 'P',
  });
  // the client and the coaching data (conversation, schedule, plan, live doc, keys)
  const inv = await coachInvite(ctx(), { uid: A, role: 'trainer' } as Actor, {
    name: 'Oleh',
    mode: 'app',
    request: { totals: 'full' },
  });
  await coachAccept(ctx(), { uid: 'c1', role: 'member' } as Actor, {
    token: inv.inviteId,
    consent: { totals: 'full' },
  });
  await kv.set(`conversations/${CID()}/messages/m1`, { id: 'm1', from: 'c1', at: T0, enc });
  await kv.set(`conversations/${CID()}/notes/n1`, { id: 'n1', enc });
  await kv.set(`conversations/${CID()}/delegations/m1`, { enc });
  for (const p of ['schedules/c1', 'plans/c1', 'liveSessions/c1'])
    await kv.set(p, { clientId: 'c1' });
  await kv.set(`schedules/${A}`, { clientId: A });
  await kv.set(`coachKeys/${A}`, { pub: 'p' });
  await kv.set(`signKeys/${A}/keys/k1`, {});
}

/** Everything that must be gone after deleting A: path by registry row. */
const GONE: [row: string, path: string][] = [
  ['R1 profile', `users/${A}`],
  ['R2 password hash', `credentials/${A}`],
  ['R3 username reservation', 'usernames/s1'],
  ['R3 invite', `invites/inv-${A}`],
  ['R5 login counter', `loginAttempts/1.2.3.4|${A}name`],
  ['R6 passkey', `passkeys/pk-${A}`],
  ['R6 passkey challenge', `passkeyChallenges/ch-${A}`],
  ['R6 sessions', `users/${A}/sessions/dev1`],
  ['R24 sleep queue', `sleepSchedules/${A}`],
  ['R25 own program', `programs/prg-${A}`],
  ['R25 assignment of the account', `assignments/${A}`],
  ['R25 assignment onto its program', 'assignments/x1'],
  ['R27 coaching', 'coaching/c1'],
  ['R28 conversation', `conversations/${CID()}`],
  ['R29 messages', `conversations/${CID()}/messages/m1`],
  ['R30 shared notes', `conversations/${CID()}/notes/n1`],
  ['R31 delegations', `conversations/${CID()}/delegations/m1`],
  ['R31 schedule/plan/live of the client', 'schedules/c1'],
  ['R31 plan', 'plans/c1'],
  ['R31 live', 'liveSessions/c1'],
  ['R31 own schedule', `schedules/${A}`],
  ['R31 coach key', `coachKeys/${A}`],
  ['R31 sign key', `signKeys/${A}/keys/k1`],
  ['R32 legacy notes by the trainer', 'users/c1/trainerNotes/legacy'],
  ['R35 consentLog', `users/${A}/consentLog/cl1`],
  ['R35 consentRecords', `users/${A}/consentRecords/cr1`],
  ['R36 audit/keyLog', `users/${A}/keyLog/2026-10-22-1`],
  ['R38 team', `teams/${A}`],
  ['R38 members', `teams/${A}/members/m1`],
  ['R38 own member row', `teams/${A}/members/${A}`],
  ['R38 acl', `teams/${A}/acl/m1`],
  ['R39 activity', `teams/${A}/activity/act-${A}`],
  ['R38 team invite', `teamInvites/ti-${A}`],
  ['R38 team request', `teamRequests/rm-${A}`],
  ['R38 invite by the account in another team', 'teamInvites/ti-other'],
  ['R38 request about the account as client', 'teamRequests/rq-client'],
  ['R38 request made by the account', 'teamRequests/rq-by'],
  ['R38 request naming the account as trainer', 'teamRequests/rq-trainer'],
  ...USER_SUBPATHS.map((p): [string, string] => [`R8-R37 users/{uid}/${p}`, `users/${A}/${p}`]),
];

beforeEach(() => {
  kv = createMemoryKv();
  storage = new Set();
  calls = [];
  failOn = null;
  n = 0;
});

describe('registry empty after deletion', () => {
  it('removes every registry path of the account, Storage and Auth, and leaves no trace', async () => {
    await seedFull();
    for (const [row, p] of GONE) expect(kv.has(p), `seeded ${row}`).toBe(true);
    expect(await code(call(A, body))).toBe('ok');
    for (const [row, p] of GONE) expect(kv.has(p), row).toBe(false);
    expect(storage.has(`avatars/${A}/photo`)).toBe(false); // R7
    expect(calls).toContain(`auth:${A}`); // R4
    // sweep: nothing left that is named after, points at, or names the account. The ONLY exceptions are the records other
    // people hold about it by design (their audit, consentLog and notices); no other kind under another user is excused.
    const KEPT = /^users\/[^/]+\/(audit|consentLog|notices)\//;
    const fullName = `${NAME_FIRST} ${NAME_LAST}`;
    for (const p of kv.paths()) {
      const d = JSON.stringify(await kv.get(p));
      const traces =
        p.split('/')[1] === A ||
        d.includes(`"${A}"`) ||
        d.includes(NAME_FIRST) ||
        d.includes(fullName);
      if (!traces) continue;
      expect(KEPT.test(p), `trace left: ${p}`).toBe(true);
    }
    // the notices the cascade itself wrote into the counterparts' accounts are neutral: no name, no uid (SPO-285 N1)
    const made = (await kv.list('users/c1/notices')).filter((r) => /^(tr|cr)-/.test(r.id)); // written by this deletion
    expect(made.map((r) => r.data.kind)).toContain('trainer-removed');
    for (const r of made) {
      expect(r.data.actor).toBeNull();
      expect(r.data.detail).toBeNull();
    }
  });

  it('ends the relationships but keeps the other side data; members of the owned team go back to their own team', async () => {
    await seedFull();
    await call(A, body);
    expect(kv.has('users/c1')).toBe(true);
    expect(kv.has('users/c1/workouts/w1')).toBe(true);
    expect(kv.has('credentials/c1')).toBe(true);
    expect((await kv.get('users/m1'))?.teamId).toBe('m1');
    expect((await kv.get('users/d1'))?.trainerId).toBeNull();
  });

  it('order: coaching and pointers first, the user tree after them, Auth last (then one more sweep of the tree)', async () => {
    await seedFull();
    await call(A, body);
    const i = (s: string) => calls.findIndex((c) => c === s);
    expect(i('revoke')).toBe(0);
    expect(i(`storage:avatars/${A}/`)).toBeLessThan(i(`tree:users/${A}`));
    expect(i(`tree:teams/${A}`)).toBeLessThan(i(`tree:users/${A}`));
    expect(i(`tree:users/${A}`)).toBeLessThan(i(`auth:${A}`));
    expect(calls.at(-1)).toBe(`tree:users/${A}`);
    expect(calls.at(-2)).toBe(`auth:${A}`);
  });

  it('a registry row is never invented: every top-level collection in firestore.rules is classified', () => {
    const rules = readFileSync('firestore.rules', 'utf8');
    const top = [...rules.matchAll(/^ {4}match \/([A-Za-z]+)\//gm)].map((m) => m[1]).sort();
    const CLEANED = [
      'assignments',
      'coachKeys',
      'coaching',
      'conversations',
      'credentials',
      'invites',
      'liveSessions',
      'plans',
      'programs',
      'schedules',
      'signKeys',
      'sleepSchedules',
      'teamInvites',
      'teamRequests',
      'teams',
      'usernames',
      'users',
    ];
    const SHARED_NO_PERSONAL_DATA = ['config', 'exerciseCatalog', 'sharedGyms'];
    expect(top.filter((c) => !CLEANED.includes(c) && !SHARED_NO_PERSONAL_DATA.includes(c))).toEqual(
      [],
    );
  });

  it('adminDeleteUser uses the same cascade (no second copy)', () => {
    const admin = readFileSync('functions/src/admin.ts', 'utf8');
    expect(admin).toContain('adminCascade(id)');
    expect(admin).not.toContain('recursiveDelete');
  });
});

describe('only the caller, only with a fresh proof', () => {
  it('leaves another account untouched, entirely', async () => {
    await seedFull();
    const before = new Map<string, string>();
    for (const p of kv.paths())
      if (p.includes(B) || p.startsWith(`users/${B}`))
        before.set(p, JSON.stringify(await kv.get(p)));
    await call(A, body);
    for (const [p, v] of before) expect(JSON.stringify(await kv.get(p)), p).toBe(v);
    expect(storage.has(`avatars/${B}/photo`)).toBe(true);
    expect(kv.has(`users/${B}/workouts/w1`)).toBe(true);
  });

  it('takes the target from the session only: a uid in the request is refused and nothing happens', async () => {
    await seedFull();
    expect(await code(call(B, { ...body, uid: A }))).toBe('invalid-argument:bad-input');
    expect(await code(call(B, { ...body, id: A }))).toBe('invalid-argument:bad-input');
    expect(kv.has(`users/${A}`)).toBe(true);
    expect(kv.has(`users/${B}`)).toBe(true);
  });

  it('refuses a signed-out caller, a missing confirm and bad input; nothing is deleted', async () => {
    await seedFull();
    expect(await code(call(undefined, body))).toBe('unauthenticated:Sign in first.');
    expect(await code(call(A, { password: 'pw' }))).toBe('invalid-argument:not-confirmed');
    expect(await code(call(A, { password: 'pw', confirm: 'yes' }))).toBe(
      'invalid-argument:not-confirmed',
    );
    expect(await code(call(A, null))).toBe('invalid-argument:bad-input');
    expect(await code(call(A, { confirm: true, password: 5 }))).toBe('invalid-argument:bad-input');
    expect(kv.has(`users/${A}`)).toBe(true);
    expect(calls).toEqual([]);
  });

  it('step-up is verified on the server: a wrong or empty password deletes nothing', async () => {
    await seedFull();
    expect(await code(call(A, { password: 'nope', confirm: true }))).toBe(
      'permission-denied:bad-password',
    );
    expect(await code(call(A, { password: '', confirm: true }))).toBe(
      'permission-denied:bad-password',
    );
    expect(kv.has(`users/${A}`)).toBe(true);
    expect(kv.has(`credentials/${A}`)).toBe(true);
    expect(calls).toEqual([]);
  });

  it('limits attempts: after the limit even the right password waits', async () => {
    await seedFull();
    for (let i = 0; i < ATTEMPT_MAX; i++)
      expect(await code(call(A, { password: 'bad', confirm: true }))).toBe(
        'permission-denied:bad-password',
      );
    expect(await code(call(A, body))).toBe('resource-exhausted:too-many-attempts');
    expect(kv.has(`users/${A}`)).toBe(true);
    // a later window starts again
    const later = await deleteMyAccountHandler(ctx(), ports(), {
      uid: A,
      data: body,
      now: T0 + 16 * 60_000,
    });
    expect(later).toEqual({ ok: true });
  });

  it('does not delete the last admin', async () => {
    await account('adm', 'admin');
    expect(await code(call('adm', body))).toBe('failed-precondition:last-admin');
    expect(kv.has('users/adm')).toBe(true);
    await account('adm2', 'admin');
    expect(await code(call('adm', body))).toBe('ok');
    expect(kv.has('users/adm')).toBe(false);
    expect(kv.has('users/adm2')).toBe(true);
  });
});

describe('idempotent and retryable', () => {
  it('a second call finishes without a password and changes nothing', async () => {
    await seedFull();
    await call(A, body);
    const after = kv.dump();
    expect(await code(call(A, { password: '', confirm: true }))).toBe('ok'); // user document is gone: only finalises
    expect(kv.dump()).toBe(after);
  });

  it('a failure in Storage leaves the account intact and the password still checkable; the retry completes', async () => {
    await seedFull();
    failOn = 'storage';
    await expect(call(A, body)).rejects.toThrow('storage down');
    expect(kv.has(`credentials/${A}`)).toBe(true);
    expect(kv.has(`users/${A}`)).toBe(true);
    failOn = null;
    expect(await code(call(A, body))).toBe('ok');
    for (const [row, p] of GONE) expect(kv.has(p), row).toBe(false);
  });

  it('a failure of the Auth delete (the last step) is finished by a retry', async () => {
    await seedFull();
    failOn = 'auth';
    await expect(call(A, body)).rejects.toThrow('auth down');
    expect(kv.has(`users/${A}`)).toBe(false); // data is gone, the sign-in record is not
    failOn = null;
    calls = [];
    expect(await code(call(A, { password: 'whatever', confirm: true }))).toBe('ok');
    expect(calls).toContain(`auth:${A}`);
  });
});

describe('a manager of someone else team', () => {
  it('leaves that team, loses the wrapped keys, and the owner team stays', async () => {
    await seedFull();
    await call('m1', body);
    expect(kv.has(`teams/${A}/members/m1`)).toBe(false);
    expect(kv.has(`teams/${A}/acl/m1`)).toBe(false);
    expect(kv.has(`conversations/${CID()}/delegations/m1`)).toBe(false);
    expect(kv.has(`teams/${A}`)).toBe(true);
    expect(kv.has(`teams/${A}/members/${A}`)).toBe(true);
    expect(kv.has(`users/${A}`)).toBe(true);
    expect(kv.has(`teamRequests/rm-${A}`)).toBe(false); // the request the manager made
  });

  it('deleteAccountCascade refuses an unsafe uid', async () => {
    await expect(deleteAccountCascade(ctx(), ports(), 'a/b')).rejects.toThrow('bad-user');
  });
});

/** Firestore transactions are serialisable; the in-memory Kv has no isolation, so tests that race calls queue `tx`. */
function serialised(base: MemoryKv): MemoryKv {
  let chain: Promise<unknown> = Promise.resolve();
  return {
    ...base,
    tx: <T>(fn: Parameters<MemoryKv['tx']>[0]) => {
      const run = chain.then(() => base.tx(fn)) as Promise<T>;
      chain = run.catch(() => undefined);
      return run;
    },
  } as MemoryKv;
}
const queues = new WeakMap<MemoryKv, MemoryKv>(); // ONE queue per store, shared by every racing call
const raced = (uid: string, data: unknown, verify: (p: string, h: string) => boolean) =>
  deleteMyAccountHandler(
    { ...ctx(), kv: queues.get(kv) ?? queues.set(kv, serialised(kv)).get(kv)! },
    { ...ports(), verifyPassword: verify },
    {
      uid,
      data,
      now: T0,
    },
  );

describe('attempt limiter (SPO-285 S4)', () => {
  it('is atomic: parallel wrong guesses never exceed the limit, the rest are refused unchecked', async () => {
    await account(A);
    let verified = 0;
    const verify = (p: string, h: string) => {
      verified++;
      return h === `h:${p}`;
    };
    const out = await Promise.all(
      Array.from({ length: 12 }, () => code(raced(A, { password: 'bad', confirm: true }, verify))),
    );
    expect(out.filter((o) => o === 'permission-denied:bad-password')).toHaveLength(ATTEMPT_MAX);
    expect(out.filter((o) => o === 'resource-exhausted:too-many-attempts')).toHaveLength(
      12 - ATTEMPT_MAX,
    );
    expect(verified).toBe(ATTEMPT_MAX); // the guesses beyond the limit never reach the hash
    expect(kv.has(`users/${A}`)).toBe(true);
  });

  it('counts only failed verifications: right passwords that stop at last-admin never lock the person out', async () => {
    await account('adm', 'admin');
    for (let i = 0; i < ATTEMPT_MAX * 2; i++)
      expect(await code(call('adm', body))).toBe('failed-precondition:last-admin');
    expect((await kv.get(`${'rateLimits'}/acctdel_adm`)) ?? { count: 0 }).toMatchObject({
      count: 0,
    });
    await account('adm2', 'admin');
    expect(await code(call('adm', body))).toBe('ok');
  });

  it('failures stay counted next to a success of another attempt', async () => {
    await account(A);
    for (let i = 0; i < 3; i++) await code(call(A, { password: 'bad', confirm: true }));
    expect((await kv.get('rateLimits/acctdel_s1'))?.count).toBe(3);
  });
});

describe('last admin (SPO-285 N5)', () => {
  it('a suspended admin does not count as "another admin"', async () => {
    await account('adm', 'admin');
    await account('adm2', 'admin', { status: 'suspended' });
    expect(await code(call('adm', body))).toBe('failed-precondition:last-admin');
    expect(kv.has('users/adm')).toBe(true);
  });

  it('two admins deleting at the same moment: exactly one goes, the other is the last admin', async () => {
    await account('adm', 'admin');
    await account('adm2', 'admin');
    const verify = (p: string, h: string) => h === `h:${p}`;
    const out = await Promise.all([
      code(raced('adm', body, verify)),
      code(raced('adm2', body, verify)),
    ]);
    expect(out.sort()).toEqual(['failed-precondition:last-admin', 'ok']);
    expect([kv.has('users/adm'), kv.has('users/adm2')].filter(Boolean)).toHaveLength(1);
  });
});

describe('an account without a password (SPO-285 S5, open)', () => {
  it('is refused with its own code, not as a wrong password; documents the gap: no step-up exists for it yet', async () => {
    await account('pk1');
    await kv.del('credentials/pk1');
    expect(await code(call('pk1', body))).toBe('failed-precondition:no-password-method');
    expect(kv.has('users/pk1')).toBe(true); // nothing is deleted, and it cannot delete itself until a passkey step-up exists
    expect(calls).toEqual([]);
    // it does not eat the attempt budget either
    expect(await kv.get('rateLimits/acctdel_pk1')).toBeNull();
  });
});

describe('legacy trainer notes (SPO-285 S6)', () => {
  it('are found by one collection-group query on trainerNotes.trainerId, no walk over users', async () => {
    await seedFull();
    await call(A, body);
    expect(kv.has('users/c1/trainerNotes/legacy')).toBe(false);
    expect(calls).not.toContain('legacy-notes-walk');
  });

  it('keeps another trainer notes', async () => {
    await seedFull();
    await kv.set('users/c1/trainerNotes/other', { trainerId: B, text: 'by B' });
    await call(A, body);
    expect(kv.has('users/c1/trainerNotes/other')).toBe(true);
  });

  it('falls back to the walk when the index is not deployed yet, and rethrows any other error', async () => {
    await seedFull();
    const noIndex = {
      ...kv,
      group: async () => {
        throw Object.assign(new Error('9 FAILED_PRECONDITION: The query requires an index'), {
          code: 9,
        });
      },
    } as MemoryKv;
    await deleteTrainerAuthoredNotes(noIndex, ports(), A);
    expect(calls).toContain('legacy-notes-walk');
    expect(kv.has('users/c1/trainerNotes/legacy')).toBe(false);
    const broken = {
      ...kv,
      group: async () => {
        throw new Error('network');
      },
    } as MemoryKv;
    await expect(deleteTrainerAuthoredNotes(broken, ports(), A)).rejects.toThrow('network');
  });

  it('the index entry exists in firestore.indexes.json', () => {
    const idx = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')) as {
      fieldOverrides: {
        collectionGroup: string;
        fieldPath: string;
        indexes: { queryScope: string }[];
      }[];
    };
    const o = idx.fieldOverrides.find(
      (f) => f.collectionGroup === 'trainerNotes' && f.fieldPath === 'trainerId',
    );
    expect(o?.indexes.map((i) => i.queryScope)).toContain('COLLECTION_GROUP');
  });
});
