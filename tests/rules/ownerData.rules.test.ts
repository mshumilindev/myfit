/**
 * SPO-58 / SPO-51: adversarial rules cases for the data a person owns under `users/{uid}/…`.
 * Runs the REAL firestore.rules through the repo's interpreter (no emulator needed). For every sub-path:
 *   - nobody who is not the owner (signed out, another member, a trainer, an admin) can read, list or write it;
 *   - the owner can do exactly what the table says;
 *   - the sealed documents refuse plaintext siblings, extra fields, a wrong envelope and an oversized envelope.
 * A guard fails when a new `match` appears under `users/{userId}` without a row here.
 */
import { describe, expect, it } from 'vitest';
import { decide, parseRules, type MatchDef, type Op } from './engine/rulesEngine';
import { RULES_SOURCE } from './engine/rulesSource';

const rules = parseRules(RULES_SOURCE);
const NOW = 1_800_000_000_000;
const OWNER = 'owner1';
type Auth = { uid: string; token: { role: string } } | null;
const au = (uid: string, role = 'member'): Auth => ({ uid, token: { role } });
const STRANGERS: [string, Auth][] = [
  ['signed out', null],
  ['another member', au('mallory')],
  ['a trainer', au('trainer1', 'trainer')],
  ['an admin', au('admin1', 'admin')],
];
const OPS: Op[] = ['get', 'list', 'create', 'update', 'delete'];

const env = (ct = 'A'.repeat(120)) => ({ v: 1, salt: 'A'.repeat(24), iv: 'A'.repeat(16), ct });
/** A sealed document the client writes: only the stamp in the open, the rest inside `enc`. */
const stamped = () => ({ updatedAt: 5, enc: env() });

interface Row {
  /** pattern under users/{userId}, e.g. `/meta/goals` */
  pattern: string;
  /** a concrete path below users/OWNER */
  path: string;
  /** operations the owner may do (with `valid` as the written data) */
  owner: Op[];
  /** data that satisfies the write rule (omit when the owner cannot write) */
  valid?: Record<string, unknown>;
  /** the stored document the write starts from (default: `valid` with a stamp) */
  before?: Record<string, unknown>;
}

const SEALED_META = [
  'goals',
  'home',
  'mastery',
  'coach',
  'exercisePrefs',
  'sleepPrefs',
  'widgetData',
  'challenges',
  'atlasChatState',
  'selfCoach',
  'calendarSettings',
] as const;
const ALL: Op[] = ['get', 'list', 'create', 'update', 'delete'];
const READ_DELETE: Op[] = ['get', 'list', 'delete'];
const READ_ONLY: Op[] = ['get', 'list'];

const ROWS: Row[] = [
  { pattern: '/sessionState/{deviceId}', path: 'sessionState/d1', owner: ['get'] },
  { pattern: '/workouts/{workoutId}', path: 'workouts/w1', owner: ALL, valid: { id: 'w1' } },
  { pattern: '/gyms/{gymId}', path: 'gyms/g1', owner: ALL, valid: { id: 'g1' } },
  { pattern: '/restPeriods/{periodId}', path: 'restPeriods/r1', owner: ALL, valid: { id: 'r1' } },
  { pattern: '/injuries/{injuryId}', path: 'injuries/i1', owner: ALL, valid: { id: 'i1' } },
  { pattern: '/conditions/{conditionId}', path: 'conditions/c1', owner: ALL, valid: { id: 'c1' } },
  { pattern: '/activities/{activityId}', path: 'activities/a1', owner: ALL, valid: { id: 'a1' } },
  { pattern: '/sleeps/{sleepId}', path: 'sleeps/s1', owner: ALL, valid: { id: 's1' } },
  { pattern: '/meta/{docId}', path: 'meta/body', owner: ALL, valid: { updatedAt: 5 } },
  { pattern: '/meta/chatKeys', path: 'meta/chatKeys', owner: ALL, valid: { v: 1, enc: env() } },
  { pattern: '/meta/signalState', path: 'meta/signalState', owner: ALL, valid: stamped() },
  ...SEALED_META.map((m) => ({
    pattern: `/meta/${m}`,
    path: `meta/${m}`,
    owner: ALL,
    valid: stamped(),
  })),
  {
    pattern: '/atlasChat/{msgId}',
    path: 'atlasChat/m1',
    owner: ALL,
    valid: { id: 'm1', at: 1, updatedAt: 2, enc: env() },
  },
  { pattern: '/pings/{pingId}', path: 'pings/p1', owner: READ_DELETE },
  { pattern: '/grants/{coachId}', path: 'grants/c1', owner: ALL, valid: { v: 1 } },
  { pattern: '/push/{deviceId}', path: 'push/d1', owner: ALL, valid: { token: 'tok' } },
  {
    pattern: '/outbox/{messageId}',
    path: 'outbox/o1',
    owner: ALL,
    valid: { dueAt: 5, title: 't', body: 'b' },
  },
  { pattern: '/reminderDismissals/{dismissId}', path: 'reminderDismissals/x', owner: READ_DELETE },
  {
    pattern: '/notices/{noticeId}',
    path: 'notices/n1',
    owner: ['get', 'list', 'update'],
    valid: { updatedAt: 1, readAt: 5 },
    before: { updatedAt: 1, readAt: null },
  },
  { pattern: '/audit/{entryId}', path: 'audit/e1', owner: READ_ONLY },
  { pattern: '/trainerNotes/{noteId}', path: 'trainerNotes/t1', owner: READ_ONLY },
  {
    pattern: '/clientNotes/{noteId}',
    path: 'clientNotes/n1',
    owner: ALL,
    valid: { id: 'n1', clientId: 'c', at: 1, updatedAt: 2, enc: env() },
  },
  {
    pattern: '/decisions/{decisionId}',
    path: 'decisions/d1',
    owner: ALL,
    valid: { id: 'd1', clientId: 'c', kind: 'k', status: 's', enc: env() },
  },
  {
    pattern: '/decisions/{decisionId}/evidence/{cat}',
    path: 'decisions/d1/evidence/sleep',
    owner: ALL,
    valid: { category: 'sleep', enc: env() },
  },
  {
    pattern: '/shares/{category}',
    path: 'shares/sleep',
    owner: ALL,
    valid: { category: 'sleep', level: 'full', asOf: 1, v: 1, enc: env() },
  },
  { pattern: '/consentLog/{entryId}', path: 'consentLog/e1', owner: READ_ONLY },
  { pattern: '/consentRecords/{recordId}', path: 'consentRecords/r1', owner: READ_ONLY },
];

/** Every `match` below users/{userId}, as `/a/{x}/b/{y}`. */
function usersPatterns(): string[] {
  const out: string[] = [];
  const rel = (m: MatchDef, base: string) => {
    for (const c of m.children) {
      const here = `${base}/${c.segs.join('/')}`;
      out.push(here);
      rel(c, here);
    }
  };
  const find = (m: MatchDef): MatchDef | null => {
    for (const c of m.children) {
      if (c.segs.join('/') === 'users/{userId}') return c;
      const f = find(c);
      if (f) return f;
    }
    return null;
  };
  const users = find(rules.root);
  if (users) rel(users, '');
  return out;
}

const decideOp = (op: Op, path: string, auth: Auth, data?: Record<string, unknown>, db = {}) =>
  decide(rules, op, `users/${OWNER}/${path}`, { auth, db, data, time: NOW }).allowed;

describe('owner data rules (SPO-58)', () => {
  it('guard: every match under users/{userId} has a row here', () => {
    const real = usersPatterns().sort();
    expect(real.length).toBeGreaterThan(20);
    expect(ROWS.map((r) => r.pattern).sort()).toEqual(real);
  });

  describe.each(ROWS.map((r) => [r.pattern, r] as const))('%s', (_p, row) => {
    const existing = {
      [`users/${OWNER}/${row.path}`]: row.before ?? { ...(row.valid ?? {}), updatedAt: 1 },
    };

    it.each(STRANGERS)('%s cannot read, list or write it', (_n, auth) => {
      for (const op of OPS)
        expect(decideOp(op, row.path, auth, row.valid, existing), op).toBe(false);
    });

    it('the owner can do exactly what is listed, nothing more', () => {
      const me = au(OWNER);
      for (const op of OPS) {
        const want = row.owner.includes(op);
        expect(decideOp(op, row.path, me, row.valid, existing), op).toBe(want);
      }
    });
  });

  describe('sealed documents refuse anything but a sealed envelope', () => {
    const sealedRows = ROWS.filter((r) => SEALED_META.some((m) => r.pattern === `/meta/${m}`));
    it.each(sealedRows.map((r) => [r.pattern, r] as const))('%s', (_p, row) => {
      const me = au(OWNER);
      const w = (d: Record<string, unknown>, op: Op = 'create') =>
        decideOp(op, row.path, me, d, {});
      expect(w({ updatedAt: 5, enc: env() })).toBe(true);
      // plaintext sibling next to the envelope
      expect(w({ updatedAt: 5, enc: env(), note: 'secret' })).toBe(false);
      // plaintext only, no envelope
      expect(w({ updatedAt: 5, name: 'secret' })).toBe(false);
      // envelope with an extra key, a wrong version, a short iv, a missing stamp
      expect(w({ updatedAt: 5, enc: { ...env(), extra: 1 } })).toBe(false);
      expect(w({ updatedAt: 5, enc: { ...env(), v: 2 } })).toBe(false);
      expect(w({ updatedAt: 5, enc: { ...env(), iv: 'short' } })).toBe(false);
      expect(w({ enc: env() })).toBe(false);
      // a stamp that is not a number
      expect(w({ updatedAt: 'now', enc: env() })).toBe(false);
      // an envelope that is not a map / too small / huge
      expect(w({ updatedAt: 5, enc: 'abc' })).toBe(false);
      expect(w({ updatedAt: 5, enc: env('A') })).toBe(false);
      expect(w({ updatedAt: 5, enc: env('A'.repeat(900_000)) })).toBe(false);
      // the same holds for an update
      expect(w({ updatedAt: 5, name: 'secret' }, 'update')).toBe(false);
    });
  });

  describe('the profile document', () => {
    const me = au(OWNER);
    const base = { firstName: 'A', lastName: 'B', role: 'member', status: 'active', username: 'u' };
    const db = { [`users/${OWNER}`]: base };
    const d = (op: Op, auth: Auth, data?: Record<string, unknown>) =>
      decide(rules, op, `users/${OWNER}`, { auth, db, data, time: NOW }).allowed;

    it('only the owner can read it; nobody lists, creates or deletes it from a client', () => {
      expect(d('get', me)).toBe(true);
      for (const [, a] of STRANGERS) expect(d('get', a)).toBe(false);
      for (const a of [me, ...STRANGERS.map((s) => s[1])]) {
        expect(d('list', a)).toBe(false);
        expect(d('create', a, base)).toBe(false);
        expect(d('delete', a)).toBe(false);
      }
    });
    it('the owner may change the display name and avatar only', () => {
      expect(d('update', me, { ...base, firstName: 'New' })).toBe(true);
      expect(d('update', me, { ...base, avatarExt: 'png' })).toBe(true);
    });
    it('privilege escalation is refused: role, status, username, trainer', () => {
      for (const patch of [
        { role: 'admin' },
        { role: 'trainer' },
        { status: 'banned' },
        { username: 'someone-else' },
        { trainerId: 'mallory' },
        { firstName: 'x', role: 'admin' },
      ])
        expect(d('update', me, { ...base, ...patch }), JSON.stringify(patch)).toBe(false);
    });
    it('display names are bounded and must be text', () => {
      expect(d('update', me, { ...base, firstName: 'x'.repeat(61) })).toBe(false);
      expect(d('update', me, { ...base, lastName: 'x'.repeat(61) })).toBe(false);
      expect(d('update', me, { ...base, firstName: 7 })).toBe(false);
      expect(d('update', me, { ...base, firstName: 'x'.repeat(60) })).toBe(true);
    });
    it('another user cannot edit it, whatever the role', () => {
      for (const [, a] of STRANGERS)
        expect(d('update', a, { ...base, firstName: 'Evil' })).toBe(false);
    });
  });

  describe('legacy and server-owned collections accept no new client data', () => {
    it.each([
      'pings/p1',
      'reminderDismissals/x',
      'audit/e1',
      'trainerNotes/t1',
      'consentLog/e1',
      'consentRecords/r1',
    ])('%s', (path) => {
      for (const op of ['create', 'update'] as Op[])
        expect(decideOp(op, path, au(OWNER), { any: 'thing', updatedAt: 1 }, {})).toBe(false);
    });
    it('notices: the owner may only mark one as read', () => {
      const db = { [`users/${OWNER}/notices/n1`]: { text: 't', readAt: null } };
      const me = au(OWNER);
      expect(decideOp('update', 'notices/n1', me, { text: 't', readAt: 9 }, db)).toBe(true);
      expect(decideOp('update', 'notices/n1', me, { text: 'edited', readAt: 9 }, db)).toBe(false);
      expect(decideOp('update', 'notices/n1', me, { text: 't', readAt: 'x' }, db)).toBe(false);
      expect(decideOp('create', 'notices/n2', me, { text: 'forged', readAt: 1 }, db)).toBe(false);
    });
  });

  describe('small bounds', () => {
    const me = au(OWNER);
    it('push tokens are text under 4096 characters', () => {
      expect(decideOp('create', 'push/d1', me, { token: 'x'.repeat(4095) })).toBe(true);
      expect(decideOp('create', 'push/d1', me, { token: 'x'.repeat(4096) })).toBe(false);
      expect(decideOp('create', 'push/d1', me, { token: 5 })).toBe(false);
    });
    it('outbox messages are bounded (title 120, body 400) and need a due time', () => {
      const ok = { dueAt: 5, title: 't', body: 'b' };
      expect(decideOp('create', 'outbox/o1', me, ok)).toBe(true);
      expect(decideOp('create', 'outbox/o1', me, { ...ok, title: 'x'.repeat(121) })).toBe(false);
      expect(decideOp('create', 'outbox/o1', me, { ...ok, body: 'x'.repeat(401) })).toBe(false);
      expect(decideOp('create', 'outbox/o1', me, { ...ok, dueAt: 'soon' })).toBe(false);
    });
    it('a sealed note must carry its own id and clientId', () => {
      const ok = { id: 'n1', clientId: 'c', at: 1, updatedAt: 2, enc: env() };
      expect(decideOp('create', 'clientNotes/n1', me, ok)).toBe(true);
      expect(decideOp('create', 'clientNotes/n1', me, { ...ok, id: 'other' })).toBe(false);
      expect(decideOp('create', 'clientNotes/n1', me, { ...ok, text: 'plain' })).toBe(false);
    });
  });
});
