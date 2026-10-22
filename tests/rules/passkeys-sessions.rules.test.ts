/**
 * SPO-211/212: passkey keys, their challenges, the per-address attempt counters and the per-device session records are
 * server-only. No rule matches them, so every client operation (even by the owner) is denied; only the Cloud Functions
 * (Admin SDK) touch them. This pins that, so a future broad `match` cannot open them by accident.
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
  'users/admin1': { role: 'admin', status: 'active' },
  'passkeys/cred1': { userId: 'member1', publicKey: 'x', counter: 0 },
  'passkeyChallenges/ch1': { challenge: 'x', userId: 'member1', expiresAt: NOW + 1 },
  'passkeyAttempts/1.2.3.4': { count: 1, windowStart: NOW },
  'users/member1/sessions/dev-00000001': { label: 'Chrome', revokedAt: null },
};
const run = (op: Op, path: string, auth: Auth, data?: Record<string, unknown>) =>
  decide(rules, op, path, { auth, db, data, time: NOW }).allowed;

const ops: Op[] = ['get', 'list', 'create', 'update', 'delete'];
const targets: [string, string, Auth][] = [
  ['passkey (owner)', 'passkeys/cred1', au('member1', 'member')],
  ['passkey (admin)', 'passkeys/cred1', au('admin1', 'admin')],
  ['passkey (signed out)', 'passkeys/cred1', null],
  ['challenge (owner)', 'passkeyChallenges/ch1', au('member1', 'member')],
  ['challenge (signed out)', 'passkeyChallenges/ch1', null],
  ['attempt counter (owner)', 'passkeyAttempts/1.2.3.4', au('member1', 'member')],
  ['own session record', 'users/member1/sessions/dev-00000001', au('member1', 'member')],
  ['own session record (admin)', 'users/member1/sessions/dev-00000001', au('admin1', 'admin')],
];

describe('passkeys and session records are closed to every client', () => {
  for (const [what, path, auth] of targets)
    for (const op of ops)
      it(`${op} ${what} is denied`, () => {
        expect(run(op, path, auth, { userId: 'member1', revokedAt: null })).toBe(false);
      });
  it('listing the sessions collection is denied too', () => {
    expect(run('list', 'users/member1/sessions', au('member1', 'member'))).toBe(false);
  });
});
