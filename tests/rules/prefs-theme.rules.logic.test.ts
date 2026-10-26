/**
 * SPO-366: the synced theme (`theme`) rides on `users/{uid}/meta/prefs`, the
 * same open settings doc as the Today layout. Pins that the owner can write it, nobody else can
 * read or write it, and that no rule change was needed.
 */
import { describe, expect, it } from 'vitest';
import { decide, parseRules, type Op } from './engine/rulesEngine';
import { RULES_SOURCE } from './engine/rulesSource';

const rules = parseRules(RULES_SOURCE);
const NOW = 1_800_000_000_000;
type Auth = { uid: string; token: { role: string } } | null;
const au = (uid: string): Auth => ({ uid, token: { role: 'member' } });
const db = {
  'users/member1': { role: 'member', status: 'active' },
  'users/member2': { role: 'member', status: 'active' },
};
const PATH = 'users/member1/meta/prefs';
const run = (op: Op, auth: Auth, data?: Record<string, unknown>) =>
  decide(rules, op, PATH, { auth, db, data, time: NOW }).allowed;
const theme = { theme: 'cyberpunk' };

describe('meta/prefs theme fields', () => {
  it('the owner reads and writes their own theme', () => {
    expect(run('get', au('member1'))).toBe(true);
    expect(run('create', au('member1'), theme)).toBe(true);
    expect(run('update', au('member1'), theme)).toBe(true);
  });
  it('another user and a signed-out client can neither read nor write it', () => {
    for (const auth of [au('member2'), null]) {
      expect(run('get', auth)).toBe(false);
      expect(run('create', auth, theme)).toBe(false);
      expect(run('update', auth, theme)).toBe(false);
    }
  });
});
