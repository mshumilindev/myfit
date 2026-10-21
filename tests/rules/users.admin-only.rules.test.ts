/**
 * SPO-141: the data behind the admin-only Users app is closed at the rules level, not only by a hidden tile.
 * Cross-user profile reads/lists and privilege edits never go through client rules (admin work runs in the
 * `admin*` Cloud Functions with `requireRole(['admin'])`), so even an admin token cannot list or read another
 * user's document directly from the client.
 */
import { describe, expect, it } from 'vitest';
import { decide, parseRules, type Op } from './engine/rulesEngine';
import { RULES_SOURCE } from './engine/rulesSource';

const rules = parseRules(RULES_SOURCE);
const NOW = 1_800_000_000_000;
type Auth = { uid: string; token: { role: string } } | null;
const au = (uid: string, role: string): Auth => ({ uid, token: { role } });
const db = {
  'users/member1': { role: 'member', status: 'active' },
  'users/member2': { role: 'member', status: 'active' },
  'users/trainer1': { role: 'trainer', status: 'active' },
  'users/admin1': { role: 'admin', status: 'active' },
};
const run = (op: Op, path: string, auth: Auth, data?: Record<string, unknown>) =>
  decide(rules, op, path, { auth, db, data, time: NOW }).allowed;

describe('users documents are not readable or editable across accounts from the client', () => {
  const cases: [string, Auth][] = [
    ['member', au('member1', 'member')],
    ['trainer', au('trainer1', 'trainer')],
    ['admin', au('admin1', 'admin')],
  ];
  for (const [who, auth] of cases) {
    it(`${who} cannot list users`, () => {
      expect(run('list', 'users', auth)).toBe(false);
    });
    it(`${who} cannot read another user's profile document`, () => {
      expect(run('get', 'users/member2', auth)).toBe(false);
    });
    it(`${who} cannot change another user's role or status`, () => {
      expect(run('update', 'users/member2', auth, { role: 'admin' })).toBe(false);
    });
  }
  it('signed-out cannot read a profile', () => {
    expect(run('get', 'users/member1', null)).toBe(false);
  });
  it('a member cannot promote themselves (role is not in the self-editable keys)', () => {
    expect(run('update', 'users/member1', au('member1', 'member'), { role: 'admin' })).toBe(false);
  });
  it('a user can still read their own profile (Me keeps working)', () => {
    expect(run('get', 'users/member1', au('member1', 'member'))).toBe(true);
  });
});
