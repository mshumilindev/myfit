/**
 * SPO-198 — a trainer who leaves a team keeps the coach-client link, the team's managers lose the trainer's clients,
 * and the clients stop reading the old team (interpreter in `engine/`, not the emulator). The state below is what
 * `teamLeave` leaves behind: membership `removed`, `users/{trainer}.teamId` back to the trainer's own uid, `coaching`
 * untouched (tests/coach-server/teamFunctions.test.ts proves the function side).
 */
import { describe, expect, it } from 'vitest';
import { decide, parseRules, type Ctx, type Doc, type Op } from './engine/rulesEngine';
import { RULES_SOURCE } from './engine/rulesSource';

const rules = parseRules(RULES_SOURCE);
const CID2 = 'bcdefghijklmnopqrstuvwxyza';
const enc = { v: 1, iv: 'A'.repeat(16), ct: 'A'.repeat(120) };
const as = (uid: string, role: string) => ({ uid, token: { role } });
const mgr = as('m1', 'manager');
const trainer2 = as('t2', 'trainer');
const client2 = as('c2', 'member');
const NOW = 1_699_900_000_000;

const joined = (): Record<string, Doc> => ({
  'users/m1': { role: 'manager', status: 'active' },
  'users/t1': { role: 'trainer', status: 'active' },
  'users/t2': { role: 'trainer', status: 'active', teamId: 't1' },
  'users/c2': { role: 'member', status: 'active' },
  'coaching/c2': { trainerId: 't2', status: 'active' },
  'teams/t1': { ownerId: 't1' },
  'teams/t1/members/t1': { role: 'trainer', status: 'active' },
  'teams/t1/members/t2': { role: 'trainer', status: 'active' },
  'teams/t1/members/m1': { role: 'manager', status: 'active' },
  [`conversations/${CID2}`]: { clientId: 'c2', trainerId: 't2', keyEpoch: 1, active: true },
  'schedules/c2': { clientId: 'c2', trainerId: 't2', rev: 1, updatedAt: 1, keyEpoch: 1, enc },
});
const left = (): Record<string, Doc> => ({
  ...joined(),
  'users/t2': { role: 'trainer', status: 'active', teamId: 't2' },
  'teams/t1/members/t2': { role: 'trainer', status: 'removed' },
});
const next = { clientId: 'c2', trainerId: 't2', rev: 2, updatedAt: 2, keyEpoch: 1, enc };
const ok = (op: Op, path: string, auth: Ctx['auth'], db: Record<string, Doc>, data?: Doc) =>
  decide(rules, op, path, { auth, db, data, time: NOW }).allowed;

describe('a trainer leaves the team', () => {
  it('while a member, the team manager reads and writes the trainer client schedule (sanity)', () => {
    const db = joined();
    expect(ok('get', 'schedules/c2', mgr, db)).toBe(true);
    expect(ok('update', 'schedules/c2', mgr, db, { ...next, updatedBy: 'm1' })).toBe(true);
    expect(ok('get', 'teams/t1/members/m1', client2, db)).toBe(true);
  });

  it('the trainer keeps the coach-client link: coaching, schedule read and write, conversation', () => {
    const db = left();
    expect(ok('get', 'coaching/c2', trainer2, db)).toBe(true);
    expect(ok('get', 'schedules/c2', trainer2, db)).toBe(true);
    expect(ok('update', 'schedules/c2', trainer2, db, next)).toBe(true);
    expect(ok('get', 'coaching/c2', client2, db)).toBe(true);
    expect(ok('get', 'schedules/c2', client2, db)).toBe(true);
  });

  it('the old team managers lose the trainer clients at once', () => {
    const db = left();
    expect(ok('get', 'schedules/c2', mgr, db)).toBe(false);
    expect(ok('update', 'schedules/c2', mgr, db, { ...next, updatedBy: 'm1' })).toBe(false);
    expect(ok('get', `conversations/${CID2}/requests/r1`, mgr, db)).toBe(false);
  });

  it('the clients no longer read the old team, and the leaver reads no team they are not in', () => {
    const db = left();
    expect(ok('get', 'teams/t1/members/m1', client2, db)).toBe(false);
    expect(ok('get', 'teams/t1/members/t1', trainer2, db)).toBe(false);
    expect(ok('get', 'teams/t1', trainer2, db)).toBe(false);
  });
});
