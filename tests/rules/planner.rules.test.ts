/**
 * SPO-573: Planner data under `users/{uid}/…` against the REAL firestore.rules (repo interpreter, no emulator).
 * The generic table (ownerData.rows.ts) already proves strangers, trainers and admins reach nothing; here the
 * shapes the table cannot express: an alert carries no content, only a known state, and the sealed availability
 * document refuses plaintext.
 */
import { describe, expect, it } from 'vitest';
import { decide, parseRules, type Op } from './engine/rulesEngine';
import { RULES_SOURCE } from './engine/rulesSource';
import { env } from './ownerData.rows';

const rules = parseRules(RULES_SOURCE);
const NOW = 1_800_000_000_000;
const OWNER = 'owner1';
const me = { uid: OWNER, token: { role: 'member' } };
const ok = (op: Op, path: string, data?: Record<string, unknown>, db = {}) =>
  decide(rules, op, `users/${OWNER}/${path}`, { auth: me, db, data, time: NOW }).allowed;

const alert = { state: 'ringing', rev: 1, updatedAt: 5 };
const stored = { [`users/${OWNER}/plannerAlerts/a1`]: alert };

describe('plannerAlerts: no content, only state', () => {
  it('accepts every state the server and devices use', () => {
    for (const state of ['ringing', 'snoozed', 'dismissed'])
      expect(ok('create', 'plannerAlerts/a1', { ...alert, state })).toBe(true);
  });

  it('accepts the optional fields (snooze time, device, event id, due time)', () => {
    expect(
      ok(
        'update',
        'plannerAlerts/a1',
        {
          ...alert,
          state: 'snoozed',
          snoozeUntil: 9,
          by: 'd1',
          eventId: 'e1',
          dueAt: 7,
        },
        stored,
      ),
    ).toBe(true);
  });

  it('refuses a title, a note or any field outside the list', () => {
    for (const extra of [{ title: 'Physio' }, { note: 'x' }, { body: 'x' }, { enc: env() }])
      expect(ok('create', 'plannerAlerts/a1', { ...alert, ...extra }), JSON.stringify(extra)).toBe(
        false,
      );
  });

  it('refuses an unknown state, a non-integer rev and a missing stamp', () => {
    expect(ok('create', 'plannerAlerts/a1', { ...alert, state: 'done' })).toBe(false);
    expect(ok('create', 'plannerAlerts/a1', { ...alert, rev: '1' })).toBe(false);
    expect(ok('create', 'plannerAlerts/a1', { state: 'ringing', rev: 1 })).toBe(false);
  });
});

describe('meta/planner: sealed availability', () => {
  const sealed = { updatedAt: 5, enc: env() };
  it('takes an envelope and refuses plaintext hours or sharing flags beside it', () => {
    expect(ok('create', 'meta/planner', sealed)).toBe(true);
    expect(ok('create', 'meta/planner', { ...sealed, availability: { 0: [[1, 2]] } })).toBe(false);
    expect(ok('create', 'meta/planner', { ...sealed, shareAvailability: true })).toBe(false);
    expect(ok('create', 'meta/planner', { updatedAt: 5, shareAvailability: true })).toBe(false);
  });
});
