/**
 * SPO-58: adversarial rules cases for every collection OUTSIDE `users/{uid}` (ownerData.rules.test.ts covers those).
 * Runs the real firestore.rules through the repo's interpreter. Three layers:
 *   1. generic: a signed-out caller can do NOTHING anywhere; an unrelated member can write nowhere, except the
 *      one documented open directory (sharedGyms);
 *   2. server-only collections (credentials, usernames, invites, emails, teams, …): no client write, whatever the role;
 *   3. role-gated collections (config, exerciseCatalog, coachKeys, signKeys, assignments, sleepSchedules).
 * A guard fails when a new top-level `match` appears that is not classified here.
 */
import { describe, expect, it } from 'vitest';
import { decide, parseRules, type MatchDef, type Op } from './engine/rulesEngine';
import { RULES_SOURCE } from './engine/rulesSource';

const rules = parseRules(RULES_SOURCE);
const NOW = 1_800_000_000_000;
type Auth = { uid: string; token: { role: string } } | null;
const au = (uid: string, role = 'member'): Auth => ({ uid, token: { role } });
const OPS: Op[] = ['get', 'list', 'create', 'update', 'delete'];
const WRITES: Op[] = ['create', 'update', 'delete'];

const SIGNED_OUT: Auth = null;
const MALLORY = au('mallory');
const TRAINER = au('trainer1', 'trainer');
const ADMIN = au('admin1', 'admin');

/** Every `match` outside users/{userId}, as `/a/{x}/b/{y}`, with `{x}` filled in as `x1`. */
function topLevel(): { pattern: string; path: string }[] {
  const out: { pattern: string; path: string }[] = [];
  const walk = (m: MatchDef, base: string) => {
    for (const c of m.children) {
      const here = `${base}/${c.segs.join('/')}`;
      if (here === '/users/{userId}') continue;
      if (c.allows.length)
        out.push({ pattern: here, path: here.replace(/\{\w+(=\*\*)?\}/g, 'x1').slice(1) });
      walk(c, here);
    }
  };
  const docs = rules.root.children[0] ?? rules.root;
  walk(docs, '');
  return out;
}

/** The rules re-read the caller's profile (role, suspension): the live roles the tokens claim. */
const PROFILES = {
  'users/admin1': { role: 'admin', status: 'active' },
  'users/trainer1': { role: 'trainer', status: 'active' },
  'users/mallory': { role: 'member', status: 'active' },
};
const run = (op: Op, path: string, auth: Auth, data: Record<string, unknown> = {}, db = {}) =>
  decide(rules, op, path, { auth, db: { ...PROFILES, ...db }, data, time: NOW }).allowed;

const ALL = topLevel();

/** Server-only: written by Cloud Functions (Admin SDK bypasses rules), never by a client. */
const SERVER_ONLY_PREFIXES = [
  '/credentials',
  '/usernames',
  '/invites',
  '/emails',
  '/teams',
  '/teamInvites',
  '/teamRequests',
  '/assignments',
  '/calls',
  '/coaching',
  '/signKeys',
];
/** Nobody, not even the owner or an admin, may touch these from a client. */
const NO_CLIENT_ACCESS = ['/credentials/x1', '/usernames/x1', '/invites/x1', '/emails/x1'];
/** The one directory every signed-in person may add to (no personal data; tracked residual in adversarial.rules.test.ts). */
const OPEN_WRITE = ['/sharedGyms/{gymKey}'];

describe('top-level collections (SPO-58)', () => {
  it('guard: the walk finds the collections, and each is classified by one of the layers', () => {
    expect(ALL.length).toBeGreaterThan(30);
    const known = [
      ...SERVER_ONLY_PREFIXES,
      '/conversations',
      '/schedules',
      '/plans',
      '/liveSessions',
      '/sleepSchedules',
      '/coachKeys',
      '/config',
      '/exerciseCatalog',
      '/sharedGyms',
      '/programs',
    ];
    for (const { pattern } of ALL)
      expect(
        known.some(
          (k) => pattern === k || pattern.startsWith(`${k}/`) || pattern.startsWith(`${k}/{`),
        ),
        pattern,
      ).toBe(true);
  });

  describe('1. generic', () => {
    it.each(ALL.map((x) => [x.pattern, x] as const))('%s: signed out can do nothing', (_p, x) => {
      for (const op of OPS) expect(run(op, x.path, SIGNED_OUT), op).toBe(false);
    });
    it.each(ALL.filter((x) => !OPEN_WRITE.includes(x.pattern)).map((x) => [x.pattern, x] as const))(
      '%s: an unrelated member writes nothing',
      (_p, x) => {
        for (const op of WRITES) expect(run(op, x.path, MALLORY, {}), op).toBe(false);
      },
    );
    it('the shared gym directory is the only open write, and only an admin deletes', () => {
      expect(run('create', 'sharedGyms/g1', MALLORY, { name: 'Gym' })).toBe(true);
      expect(run('delete', 'sharedGyms/g1', MALLORY)).toBe(false);
      expect(run('delete', 'sharedGyms/g1', TRAINER)).toBe(false);
      expect(run('delete', 'sharedGyms/g1', ADMIN)).toBe(true);
    });
  });

  describe('2. server-only collections accept no client write, whatever the role', () => {
    const paths = ALL.filter((x) =>
      SERVER_ONLY_PREFIXES.some((p) => x.pattern.startsWith(`${p}/`)),
    );
    it.each(paths.map((x) => [x.pattern, x] as const))('%s', (_p, x) => {
      for (const [who, auth] of [
        ['member', MALLORY],
        ['self', au('x1')],
        ['trainer', TRAINER],
        ['admin', ADMIN],
      ] as const)
        for (const op of WRITES) {
          // coachKeys/signKeys style paths are not in this list; conversations have their own message rules (layer 3)
          expect(run(op, x.path, auth, { any: 'thing' }), `${who} ${op}`).toBe(false);
        }
    });
    it.each(NO_CLIENT_ACCESS)('%s: no read either, not even for an admin or the owner', (path) => {
      const p = path.slice(1);
      for (const auth of [SIGNED_OUT, MALLORY, au('x1'), TRAINER, ADMIN])
        for (const op of OPS) expect(run(op, p, auth, { any: 'thing' }), `${op}`).toBe(false);
    });
  });

  describe('3. role-gated collections', () => {
    it('config: everyone signed in reads it; only an admin writes flags, and nothing else', () => {
      expect(run('get', 'config/flags', MALLORY)).toBe(true);
      expect(run('get', 'config/flags', SIGNED_OUT)).toBe(false);
      for (const auth of [MALLORY, TRAINER])
        expect(run('update', 'config/flags', auth, { a: 1 })).toBe(false);
      expect(run('update', 'config/flags', ADMIN, { a: 1 })).toBe(true);
      expect(run('update', 'config/other', ADMIN, { a: 1 })).toBe(false);
      expect(run('create', 'config/secrets', ADMIN, { a: 1 })).toBe(false);
    });
    it('a role claim alone is not enough: the live profile must agree, and a suspended admin is a plain member', () => {
      const forged = au('mallory', 'admin');
      expect(run('update', 'config/flags', forged, { a: 1 })).toBe(false);
      expect(run('delete', 'exerciseCatalog/e1', forged)).toBe(false);
      const suspended = { 'users/admin1': { role: 'admin', status: 'suspended' } };
      expect(run('update', 'config/flags', ADMIN, { a: 1 }, suspended)).toBe(false);
      expect(run('delete', 'sharedGyms/g1', ADMIN, {}, suspended)).toBe(false);
    });
    it('exerciseCatalog: trainers and admins edit, only an admin deletes, members only read', () => {
      expect(run('get', 'exerciseCatalog/e1', MALLORY)).toBe(true);
      expect(run('create', 'exerciseCatalog/e1', MALLORY, { name: 'x' })).toBe(false);
      expect(run('update', 'exerciseCatalog/e1', MALLORY, { name: 'x' })).toBe(false);
      expect(run('delete', 'exerciseCatalog/e1', TRAINER)).toBe(false);
      expect(run('delete', 'exerciseCatalog/e1', ADMIN)).toBe(true);
      expect(run('delete', 'exerciseCatalog/e1', MALLORY)).toBe(false);
    });
    it('signKeys and coachKeys: public keys are readable by any signed-in user, never writable for someone else', () => {
      expect(run('get', 'signKeys/u1/keys/k1', MALLORY)).toBe(true);
      expect(run('get', 'signKeys/u1/keys/k1', SIGNED_OUT)).toBe(false);
      expect(run('get', 'coachKeys/u1', MALLORY)).toBe(true);
      expect(run('get', 'coachKeys/u1', SIGNED_OUT)).toBe(false);
      for (const auth of [SIGNED_OUT, MALLORY, TRAINER, ADMIN])
        expect(run('update', 'coachKeys/u1', auth, { pub: 'k' }), 'someone else').toBe(false);
      expect(run('delete', 'coachKeys/u1', au('u1', 'trainer'))).toBe(false);
    });
    it('a plain member cannot publish a coach key for themselves', () => {
      expect(run('create', 'coachKeys/mallory', MALLORY, { pub: 'k' })).toBe(false);
    });
    it('assignments: the member reads their own, a stranger does not, nobody writes', () => {
      expect(run('get', 'assignments/m1', au('m1'))).toBe(true);
      expect(run('get', 'assignments/m1', MALLORY)).toBe(false);
      for (const auth of [au('m1'), TRAINER, ADMIN])
        for (const op of WRITES) expect(run(op, 'assignments/m1', auth, {})).toBe(false);
    });
    it('sleepSchedules: only the owner touches their own queue entry', () => {
      expect(run('create', 'sleepSchedules/u1', au('u1'), { x: 1 })).toBe(true);
      for (const auth of [SIGNED_OUT, MALLORY, TRAINER, ADMIN])
        for (const op of OPS) expect(run(op, 'sleepSchedules/u1', auth, { x: 1 }), op).toBe(false);
    });
    it('conversations: a client can never create or delete one, and an outsider reads nothing in it', () => {
      for (const auth of [MALLORY, TRAINER, ADMIN, au('x1')]) {
        expect(run('create', 'conversations/c1', auth, { clientId: 'x1' })).toBe(false);
        expect(run('delete', 'conversations/c1', auth)).toBe(false);
        expect(run('delete', 'conversations/c1/messages/m1', auth)).toBe(false);
        expect(run('delete', 'conversations/c1/keyring/1', auth)).toBe(false);
      }
      const db = {
        'conversations/c1': { clientId: 'client1', trainerId: 'trainer9', status: 'active' },
      };
      for (const p of [
        'conversations/c1',
        'conversations/c1/messages/m1',
        'conversations/c1/notes/n1',
        'conversations/c1/keyring/1',
      ])
        expect(run('get', p, MALLORY, {}, db), p).toBe(false);
    });
  });
});
