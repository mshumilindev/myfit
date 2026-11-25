/**
 * SPO-307 (R3, R18–R20): rules of programs started from the Train like a pro catalog, run without the emulator through the
 * repo's own interpreter against the REAL firestore.rules.
 */
import { describe, expect, it } from 'vitest';
import { decide, parseRules, type Op } from './engine/rulesEngine';
import { RULES_SOURCE } from './engine/rulesSource';

const rules = parseRules(RULES_SOURCE);
const NOW = 1_800_000_000_000;
const U = 'u1';
const V = 'victim1';
const au = (uid: string) => ({ uid, token: { role: 'member' } });
type Db = Record<string, Record<string, unknown>>;
const origin = { v: 1, id: 'linear-5x5-ab' };
const prog = (o: Record<string, unknown> = {}) => ({
  authorId: U,
  status: 'draft',
  name: 'x',
  items: [],
  ...o,
});
const run = (op: Op, path: string, uid: string, data: Record<string, unknown>, db: Db = {}) =>
  decide(rules, op, path, { auth: au(uid), db, data, time: NOW }).allowed;

describe('catalog programs rules', () => {
  const id = `programs/tl-${U}-linear-5x5-ab`;
  it('creates its own catalog program with origin', () => {
    expect(run('create', id, U, prog({ origin }))).toBe(true);
  });
  it('R19: cannot create a tl- id for another uid, with or without origin', () => {
    const other = `programs/tl-${V}-linear-5x5-ab`;
    expect(run('create', other, U, prog({ origin }))).toBe(false);
    expect(run('create', other, U, prog())).toBe(false);
    expect(run('create', `programs/tl-${U}`, U, prog())).toBe(false);
  });
  it('origin only goes with a tl- id and must be { v, id }', () => {
    expect(run('create', `programs/plain-1`, U, prog({ origin }))).toBe(false);
    expect(run('create', id, U, prog({ origin: { v: 1, id: 'a', extra: 1 } }))).toBe(false);
    expect(run('create', id, U, prog({ origin: { v: 'x', id: 'a' } }))).toBe(false);
  });
  it('an ordinary program is created and edited as before', () => {
    expect(run('create', 'programs/abc-1', U, prog())).toBe(true);
    const db: Db = { 'programs/abc-1': prog() };
    expect(run('update', 'programs/abc-1', U, prog({ name: 'renamed' }), db)).toBe(true);
  });
  it('R20: a catalog program can only change status and updatedAt', () => {
    const db: Db = { [id]: prog({ origin, status: 'active' }) };
    expect(run('update', id, U, prog({ origin, status: 'archived', updatedAt: 5 }), db)).toBe(true);
    expect(run('update', id, U, prog({ origin, name: 'renamed' }), db)).toBe(false);
    expect(run('update', id, U, prog({ origin, items: [{ day: 1 }] }), db)).toBe(false);
    expect(run('update', id, U, prog({ origin: { v: 1, id: 'other' } }), db)).toBe(false);
    expect(run('update', id, U, prog({}), db)).toBe(false); // dropping origin
  });
  it('an ordinary program cannot gain origin by an edit', () => {
    const db: Db = { 'programs/abc-1': prog() };
    expect(run('update', 'programs/abc-1', U, prog({ origin }), db)).toBe(false);
  });
  it('the owner can still delete it; others cannot', () => {
    const db: Db = { [id]: prog({ origin }) };
    expect(run('delete', id, U, {}, db)).toBe(true);
    expect(run('delete', id, V, {}, db)).toBe(false);
  });
});
