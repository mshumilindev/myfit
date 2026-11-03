/**
 * SPO-440: rules of `calls/{callId}` and `calls/{callId}/ice/{id}`, through the repo's rules interpreter against the REAL
 * firestore.rules. Contract: the two participants read; nobody writes from a client (only the call functions, Admin SDK).
 */
import { describe, expect, it } from 'vitest';
import { decide, parseRules, type Ctx, type Doc, type Op } from './engine/rulesEngine';
import { RULES_SOURCE } from './engine/rulesSource';

const rules = parseRules(RULES_SOURCE);
const as = (uid: string, role = 'member') => ({ uid, token: { role } });
const world = (): Record<string, Doc> => ({
  'users/t1': { role: 'trainer', status: 'active' },
  'users/c1': { role: 'member', status: 'active' },
  'users/c2': { role: 'member', status: 'active' },
  'users/t2': { role: 'trainer', status: 'active' },
  'users/m1': { role: 'manager', status: 'active' },
  'users/s1': { role: 'member', status: 'suspended' },
  'users/a1': { role: 'admin', status: 'active' },
  'coaching/c1': { trainerId: 't1', status: 'active' },
  'calls/call1': { callerId: 't1', calleeId: 'c1', clientId: 'c1', state: 'ringing' },
  'calls/call1/ice/i1': { from: 't1', candidate: { candidate: 'x' } },
});
const ok = (op: Op, path: string, auth: Ctx['auth'], data?: Doc) =>
  decide(rules, op, path, { auth, db: world(), data, time: 1_800_000_000_000 }).allowed;

describe('calls rules', () => {
  it('both participants read the call and its ICE candidates', () => {
    for (const a of [as('t1', 'trainer'), as('c1')]) {
      expect(ok('get', 'calls/call1', a)).toBe(true);
      expect(ok('list', 'calls/call1', a)).toBe(true);
      expect(ok('get', 'calls/call1/ice/i1', a)).toBe(true);
      expect(ok('list', 'calls/call1/ice/i1', a)).toBe(true);
    }
  });
  it('nobody else reads: another client, another trainer, a manager, an admin, signed out', () => {
    for (const a of [as('c2'), as('t2', 'trainer'), as('m1', 'manager'), as('a1', 'admin'), null]) {
      expect(ok('get', 'calls/call1', a)).toBe(false);
      expect(ok('get', 'calls/call1/ice/i1', a)).toBe(false);
    }
  });
  it('a suspended participant reads nothing', () => {
    const w = world();
    w['calls/call2'] = { callerId: 's1', calleeId: 't1' };
    const o = decide(rules, 'get', 'calls/call2', { auth: as('s1'), db: w, time: 1 });
    expect(o.allowed).toBe(false);
  });
  it('nobody writes from a client, not even a participant: create, update, delete, on the call and on ICE', () => {
    const forged = { callerId: 'c1', calleeId: 't1', clientId: 'c1', state: 'active' };
    for (const a of [as('t1', 'trainer'), as('c1'), as('a1', 'admin'), as('m1', 'manager')]) {
      expect(ok('create', 'calls/new1', a, forged)).toBe(false);
      expect(ok('update', 'calls/call1', a, { ...forged, callerId: 't1', calleeId: 'c1' })).toBe(
        false,
      );
      expect(ok('delete', 'calls/call1', a)).toBe(false);
      expect(ok('create', 'calls/call1/ice/i9', a, { from: a.uid })).toBe(false);
      expect(ok('update', 'calls/call1/ice/i1', a, { from: a.uid })).toBe(false);
      expect(ok('delete', 'calls/call1/ice/i1', a)).toBe(false);
    }
  });
  it('an ICE document of a call that does not exist is not readable', () => {
    expect(ok('get', 'calls/ghost/ice/i1', as('c1'))).toBe(false);
  });
});
