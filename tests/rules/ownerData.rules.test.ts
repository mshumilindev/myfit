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
import { ROWS, SEALED_META, env } from './ownerData.rows';

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
