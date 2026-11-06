/**
 * SPO-511: the enabled add-ons (`addons`) and the install queue (`addonsQueue`) ride on
 * `users/{uid}/meta/prefs` next to the theme. Pins that only the owner reads and writes them
 * (a trainer or another member can't) and that no rule change was needed.
 */
import { describe, expect, it } from 'vitest';
import { decide, parseRules, type Op } from './engine/rulesEngine';
import { RULES_SOURCE } from './engine/rulesSource';

const rules = parseRules(RULES_SOURCE);
const NOW = 1_800_000_000_000;
type Auth = { uid: string; token: { role: string } } | null;
const au = (uid: string, role = 'member'): Auth => ({ uid, token: { role } });
const db = {
  'users/member1': { role: 'member', status: 'active' },
  'users/member2': { role: 'member', status: 'active' },
  'users/trainer1': { role: 'trainer', status: 'active' },
};
const PATH = 'users/member1/meta/prefs';
const run = (op: Op, auth: Auth, data?: Record<string, unknown>) =>
  decide(rules, op, PATH, { auth, db, data, time: NOW }).allowed;
const fields = {
  addons: ['learn'],
  addonsUpdatedAt: NOW,
  addonsQueue: ['apex'],
  addonsQueueUpdatedAt: NOW,
};

describe('meta/prefs add-on lists', () => {
  it('the owner reads and writes their own lists', () => {
    expect(run('get', au('member1'))).toBe(true);
    expect(run('create', au('member1'), fields)).toBe(true);
    expect(run('update', au('member1'), fields)).toBe(true);
  });
  it('another member, a trainer and a signed-out client can neither read nor write them', () => {
    for (const auth of [au('member2'), au('trainer1', 'trainer'), null]) {
      expect(run('get', auth)).toBe(false);
      expect(run('create', auth, fields)).toBe(false);
      expect(run('update', auth, fields)).toBe(false);
    }
  });
});
