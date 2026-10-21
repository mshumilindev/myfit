import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  ALL_OFF,
  CATEGORIES,
  DAY,
  LEVELS,
  MODES,
  canDecide,
  conversationId,
  consentChanges,
  downgrades,
  effectiveRequest,
  expiredRequests,
  gateCategory,
  inviteLimit,
  inviteProblem,
  keyFingerprint,
  nextEpoch,
  parseConsent,
  rateLimited,
  redactForLog,
  requestProblem,
  rotationDue,
  unreadFor,
  unreadMap,
  auditId,
  type CoachingDoc,
  type CoachInviteDoc,
} from '../../functions/src/coach/logic';
import { computeConversationId } from '../../client/src/coachCrypto/conversationId';
import { fingerprint } from '../../client/src/vaultGrants';

const NOW = Date.UTC(2026, 9, 10, 9, 0, 0);

describe('conversation id and key fingerprint (server == client)', () => {
  it('is byte-identical to the client definition', async () => {
    const pepper = randomBytes(32);
    for (const [c, t] of [
      ['client-1', 'trainer-1'],
      ['uid-with-long-name-0123456789', 't'],
    ]) {
      expect(conversationId(pepper, c, t)).toBe(await computeConversationId(pepper, c, t));
    }
  });
  it('is opaque, stable, 26 chars of base32, and differs per pair and per pepper', () => {
    const p = randomBytes(32);
    const id = conversationId(p, 'c1', 't1');
    expect(id).toMatch(/^[a-z2-7]{26}$/);
    expect(id).not.toContain('c1');
    expect(conversationId(p, 'c1', 't1')).toBe(id);
    expect(conversationId(p, 'c1', 't2')).not.toBe(id);
    expect(conversationId(p, 't1', 'c1')).not.toBe(id);
    expect(conversationId(randomBytes(32), 'c1', 't1')).not.toBe(id);
  });
  it('refuses a weak pepper and bad uids', () => {
    expect(() => conversationId(randomBytes(8), 'a', 'b')).toThrow('weak-pepper');
    expect(() => conversationId(randomBytes(32), 'a:b', 'c')).toThrow('bad-uid');
    expect(() => conversationId(randomBytes(32), 'a/b', 'c')).toThrow('bad-uid');
    expect(() => conversationId(randomBytes(32), '', 'c')).toThrow('bad-uid');
  });
  it('fingerprints a coach key like the client', async () => {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveKey',
    ]);
    const pub = await crypto.subtle.exportKey('jwk', pair.publicKey);
    expect(keyFingerprint(pub)).toBe(await fingerprint(pub));
  });
});

const coaching = (over: Partial<CoachingDoc> = {}): CoachingDoc => ({
  clientId: 'c1',
  trainerId: 't1',
  status: 'active',
  mode: 'app',
  consent: { ...ALL_OFF },
  consentVersion: 1,
  keyEpoch: 1,
  inviteId: null,
  createdAt: 0,
  acceptedAt: 0,
  endedAt: null,
  endedBy: null,
  updatedAt: 0,
  ...over,
});

describe('consent gate: modes x categories x levels (R-BE-CON-2)', () => {
  for (const mode of MODES)
    for (const cat of CATEGORIES)
      for (const level of LEVELS)
        it(`${mode} / ${cat} / ${level}`, () => {
          const r = gateCategory(
            coaching({ mode, consent: { ...ALL_OFF, [cat]: level } }),
            cat,
            NOW,
          );
          if (mode === 'program') expect(r).toEqual({ state: 'not-applicable' });
          else if (level === 'off') expect(r).toEqual({ state: 'locked' });
          else expect(r).toEqual({ state: 'ok', level, asOf: NOW });
        });
  it('never opens another category and refuses a non-active relationship', () => {
    const c = coaching({ consent: { ...ALL_OFF, totals: 'full' } });
    expect(gateCategory(c, 'sets', NOW)).toEqual({ state: 'locked' });
    expect(() => gateCategory(coaching({ status: 'ended' }), 'totals', NOW)).toThrow('not-active');
    expect(() => gateCategory(coaching({ status: 'pending' }), 'totals', NOW)).toThrow(
      'not-active',
    );
  });
});

describe('consent parsing and changes', () => {
  it('defaults everything to off and rejects unknown levels', () => {
    expect(parseConsent(undefined, ALL_OFF)).toEqual(ALL_OFF);
    expect(parseConsent({ sets: 'full' }, ALL_OFF).sets).toBe('full');
    expect(() => parseConsent({ sets: 'all' }, ALL_OFF)).toThrow('bad-level:sets');
    expect(parseConsent({ nonsense: 'full' }, ALL_OFF)).toEqual(ALL_OFF); // unknown categories are ignored
  });
  it('program mode forces the request off', () => {
    expect(effectiveRequest('program', { totals: 'full' })).toEqual(ALL_OFF);
    expect(effectiveRequest('app', { totals: 'full' }).totals).toBe('full');
  });
  it('detects downgrades only', () => {
    const from = { ...ALL_OFF, totals: 'full', sets: 'effects', body: 'off' } as typeof ALL_OFF;
    const to = { ...ALL_OFF, totals: 'effects', sets: 'full', body: 'effects' } as typeof ALL_OFF;
    const ch = consentChanges(from, to);
    expect(ch.map((c) => c.category)).toEqual(['totals', 'sets', 'body']);
    expect(downgrades(ch).map((c) => c.category)).toEqual(['totals']);
  });
});

const inv = (o: Partial<CoachInviteDoc> = {}): CoachInviteDoc => ({
  kind: 'coach-link',
  token: 'tok',
  trainerId: 't1',
  mode: 'app',
  request: ALL_OFF,
  targetUserId: null,
  displayName: 'Oleh',
  createdAt: NOW,
  expiresAt: NOW + 7 * DAY,
  claimedAt: null,
  claimedBy: null,
  revokedAt: null,
  ...o,
});

describe('invites', () => {
  it('reports expired, revoked, claimed, wrong kind and not-for-you', () => {
    expect(inviteProblem(inv(), NOW)).toBeNull();
    expect(inviteProblem(inv({ expiresAt: NOW }), NOW)).toBe('expired');
    expect(inviteProblem(inv({ revokedAt: 1 }), NOW)).toBe('revoked');
    expect(inviteProblem(inv({ claimedAt: 1 }), NOW)).toBe('claimed');
    expect(inviteProblem({ ...inv(), kind: 'invite' } as never, NOW)).toBe('wrong-kind');
    expect(inviteProblem(null, NOW)).toBe('wrong-kind');
    expect(inviteProblem(inv({ targetUserId: 'u9' }), NOW, 'u1')).toBe('not-for-you');
    expect(inviteProblem(inv({ targetUserId: 'u9' }), NOW, 'u9')).toBeNull();
  });
  it('limits: 50 pending and 20 per 24 h', () => {
    const own = (n: number, createdAt = NOW) => Array.from({ length: n }, () => inv({ createdAt }));
    expect(inviteLimit(own(19), NOW)).toBe('ok');
    expect(inviteLimit(own(20), NOW)).toBe('too-many-today');
    expect(
      inviteLimit(
        own(50, NOW - 2 * DAY).map((i) => ({ ...i, expiresAt: NOW + DAY })),
        NOW,
      ),
    ).toBe('too-many-pending');
    expect(
      inviteLimit(
        own(60, NOW - 9 * DAY).map((i) => ({ ...i, expiresAt: NOW - 2 * DAY })),
        NOW,
      ),
    ).toBe('ok');
  });
});

describe('unread and requests', () => {
  const conv = { clientId: 'c', trainerId: 't', readUpTo: { t: 100 }, clearedBefore: { c: 50 } };
  it('counts the other side after the read/clear marker, skipping deleted and pending-delete', () => {
    const msgs = [
      { from: 'c', at: 90 },
      { from: 'c', at: 120 },
      { from: 'c', at: 130, deleted: true },
      { from: 'c', at: 140, del: { state: 'pending' } },
      { from: 't', at: 40 },
      { from: 't', at: 60 },
    ];
    expect(unreadFor('t', conv, msgs)).toBe(1);
    expect(unreadFor('c', conv, msgs)).toBe(1);
    expect(unreadMap(conv, msgs)).toEqual({ c: 1, t: 1 });
  });
  it('request open-field checks', () => {
    const ok = { createdAt: NOW, expiresAt: NOW + DAY, slotKey: 'k1' };
    expect(requestProblem(ok, NOW, [])).toBeNull();
    expect(requestProblem({ ...ok, createdAt: NOW - 10 * 60_000 }, NOW, [])).toBe('bad-time');
    expect(requestProblem({ ...ok, expiresAt: NOW + 15 * DAY }, NOW, [])).toBe('ttl');
    expect(requestProblem({ ...ok, expiresAt: NOW }, NOW, [])).toBe('ttl');
    expect(requestProblem(ok, NOW, [{ slotKey: 'k1', status: 'pending' }])).toBe('duplicate-slot');
    expect(requestProblem(ok, NOW, [{ slotKey: 'k1', status: 'declined' }])).toBeNull();
    expect(requestProblem({ ...ok, slotKey: '' }, NOW, [])).toBe('bad-slot');
  });
  it('state machine: the other side answers, the creator cancels, nothing leaves a decided state', () => {
    const r = { from: 'client' as const, status: 'pending' as const };
    expect(canDecide(r, 'trainer', 'accepted')).toBe(true);
    expect(canDecide(r, 'trainer', 'declined')).toBe(true);
    expect(canDecide(r, 'client', 'accepted')).toBe(false);
    expect(canDecide(r, 'client', 'cancelled')).toBe(true);
    expect(canDecide(r, 'trainer', 'cancelled')).toBe(false);
    expect(canDecide(r, 'trainer', 'expired')).toBe(false);
    expect(canDecide({ ...r, status: 'accepted' }, 'trainer', 'declined')).toBe(false);
    // a counter-proposal is an answer of the OTHER side (the old request becomes `countered`)
    expect(canDecide(r, 'trainer', 'countered')).toBe(true);
    expect(canDecide(r, 'client', 'countered')).toBe(false);
    expect(canDecide({ from: 'trainer', status: 'pending' }, 'client', 'countered')).toBe(true);
    expect(canDecide({ ...r, status: 'countered' }, 'trainer', 'accepted')).toBe(false);
  });
  it('expiry picks pending requests past expiresAt only', () => {
    const rs = [
      { status: 'pending' as const, expiresAt: NOW - 1 },
      { status: 'pending' as const, expiresAt: NOW + 1 },
      { status: 'accepted' as const, expiresAt: NOW - 1 },
    ];
    expect(expiredRequests(rs, NOW)).toEqual([rs[0]]);
  });
});

describe('rotation, rate limit, audit id, redaction', () => {
  it('rotates every 90 days and epochs go up by one', () => {
    expect(rotationDue(NOW - 89 * DAY, NOW)).toBe(false);
    expect(rotationDue(NOW - 90 * DAY, NOW)).toBe(true);
    expect(nextEpoch(1)).toBe(2);
    expect(nextEpoch(7)).toBe(8);
  });
  it('rate limit allows 30 per minute, not 31', () => {
    const ats = (n: number) => Array.from({ length: n }, (_, i) => NOW - i * 1000);
    expect(rateLimited(ats(30), NOW)).toBe(false);
    expect(rateLimited(ats(31), NOW)).toBe(true);
    expect(
      rateLimited(
        ats(31).map((a) => a - 120_000),
        NOW,
      ),
    ).toBe(false);
  });
  it('audit id is per reader, subject, category, via and UTC day', () => {
    const a = auditId('t', 'c', 'sets', 'client360', NOW);
    expect(auditId('t', 'c', 'sets', 'client360', NOW + 1000)).toBe(a);
    expect(auditId('t', 'c', 'sets', 'queue', NOW)).not.toBe(a);
    expect(auditId('t', 'c', 'sets', 'client360', NOW + DAY)).not.toBe(a);
    expect(auditId('t', 'c2', 'sets', 'client360', NOW)).not.toBe(a);
  });
  it('redaction hides sealed/secret fields and every string value', () => {
    const out = JSON.stringify(
      redactForLog({
        id: 'abc',
        enc: { ct: 'SECRETCT' },
        text: 'hello',
        nested: { ck: 'KEY', n: 3 },
      }),
    );
    expect(out).not.toMatch(/SECRETCT|hello|KEY|abc/);
    expect(out).toContain('"n":3');
  });
  it('the handlers never log bodies: only the allowed console calls exist', () => {
    const src = readFileSync(resolve(process.cwd(), 'functions/src/coach/handlers.ts'), 'utf8');
    const calls = src.match(/console\.\w+\([^;]*;/g) ?? [];
    expect(calls).toHaveLength(3); // error path, sweep counts, reminders counts;
    for (const c of calls) expect(c).not.toMatch(/req\.|body\(|\.data|message/);
    const svc = readFileSync(resolve(process.cwd(), 'functions/src/coach/service.ts'), 'utf8');
    expect(svc).not.toMatch(/console\./);
  });
});
