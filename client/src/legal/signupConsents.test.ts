import { markVerifiedClear, wasVerifiedClear } from './gateVerified';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  uid: 'u1' as string | null,
  grant: vi.fn(),
  withdraw: vi.fn(),
}));
vi.mock('../api', () => ({ currentUid: () => h.uid }));
vi.mock('./consentApi', () => ({ grantConsent: h.grant, withdrawConsent: h.withdraw }));

import { LEGAL_VERSIONS, currentVersion } from './consents';
import { LOCAL_OFF_KEY, localOffKinds, markLocalOff } from './localOff';
import {
  CONSENT_QUEUE_KEY,
  buildSignupGrants,
  enqueueConsents,
  flushPendingConsents,
  pendingConsentKinds,
  prepareDirectGrant,
  pruneConsentsOf,
  WITHDRAW_REFUSAL_LIMIT,
  recordGateConsents,
  onConsentDropped,
  recordSignupConsents,
  sendConsentDurably,
} from './signupConsents';
import { sha256Hex } from './textHash';
import { trainerTermsHashInput } from './trainerTerms';

const queued = () => JSON.parse(localStorage.getItem(CONSENT_QUEUE_KEY) ?? '[]');

beforeEach(() => {
  localStorage.clear();
  h.uid = 'u1';
  h.grant.mockReset();
  h.withdraw.mockReset();
});

describe('buildSignupGrants', () => {
  it('has terms, policy-ack, age-18 with the current versions; hashes on the two documents only', async () => {
    const g = await buildSignupGrants('en');
    expect(g.map((x) => x.kind)).toEqual(['terms', 'policy-ack', 'age-18']);
    expect(g[0].version).toBe(LEGAL_VERSIONS.terms);
    expect(g[1].version).toBe(LEGAL_VERSIONS.policy);
    expect(g[2].version).toBe(LEGAL_VERSIONS.age);
    expect(g[0].textHash).toMatch(/^[0-9a-f]{64}$/);
    expect(g[1].textHash).toMatch(/^[0-9a-f]{64}$/);
    expect(g[0].textHash).not.toBe(g[1].textHash);
    expect(g[2].textHash).toBeUndefined();
  });
  it('hashes the text in the shown language', async () => {
    const en = await buildSignupGrants('en');
    const uk = await buildSignupGrants('uk');
    expect(uk[0].textHash).not.toBe(en[0].textHash);
  });
});

describe('recordSignupConsents', () => {
  it('grants the three kinds with versions and hashes, and leaves nothing queued', async () => {
    h.grant.mockResolvedValue({ id: 'x', at: 1 });
    await recordSignupConsents('en');
    expect(h.grant).toHaveBeenCalledTimes(3);
    const calls = h.grant.mock.calls.map((c) => c[0]);
    expect(calls.map((c) => c.kind)).toEqual(['terms', 'policy-ack', 'age-18']);
    expect(calls[0]).toMatchObject({ version: LEGAL_VERSIONS.terms });
    expect(calls[0].textHash).toMatch(/^[0-9a-f]{64}$/);
    expect(calls[2].textHash).toBeUndefined();
    expect(localStorage.getItem(CONSENT_QUEUE_KEY)).toBeNull();
  });

  it('offline: does not throw, keeps all three queued, and a later flush sends them', async () => {
    h.grant.mockRejectedValue(new Error('offline'));
    await expect(recordSignupConsents('en')).resolves.toBeUndefined();
    expect(queued()[0].items.map((i: { kind: string }) => i.kind)).toEqual([
      'terms',
      'policy-ack',
      'age-18',
    ]);
    h.grant.mockReset();
    h.grant.mockResolvedValue({ id: 'x', at: 2 });
    await flushPendingConsents();
    expect(h.grant).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem(CONSENT_QUEUE_KEY)).toBeNull();
  });

  it('a partial failure keeps only the failed consent', async () => {
    h.grant
      .mockResolvedValueOnce({ id: 'a', at: 1 })
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValueOnce({ id: 'c', at: 1 });
    await recordSignupConsents('en');
    expect(queued()[0].items.map((i: { kind: string }) => i.kind)).toEqual(['policy-ack']);
  });

  it('only the signed-in account sends its own queue', async () => {
    h.grant.mockRejectedValue(new Error('offline'));
    await recordSignupConsents('en');
    h.grant.mockReset();
    h.grant.mockResolvedValue({ id: 'x', at: 1 });
    h.uid = 'someone-else';
    await flushPendingConsents();
    expect(h.grant).not.toHaveBeenCalled();
    expect(queued()).toHaveLength(1);
  });

  it('does nothing without a signed-in account', async () => {
    h.uid = null;
    await recordSignupConsents('en');
    expect(h.grant).not.toHaveBeenCalled();
    expect(localStorage.getItem(CONSENT_QUEUE_KEY)).toBeNull();
  });
});

const AI = currentVersion('atlas-ai');
const GEO = currentVersion('geo-search');

describe("recordGateConsents (the legal gate's Continue)", () => {
  const hex = /^[0-9a-f]{64}$/;

  it('a new trainer: terms, policy-ack, age-18 AND trainer-terms queued in one go, each with its hash/version', async () => {
    h.grant.mockResolvedValue({ id: 'x', at: 1 });
    let release: (v: unknown) => void = () => undefined;
    h.grant.mockReturnValueOnce(new Promise((r) => (release = r))); // offline / slow: only the queue is certain
    const p = recordGateConsents('en', { base: true, trainer: true });
    await vi.waitFor(() => expect(queued()[0]?.items).toHaveLength(4)); // durable before anything is sent
    expect(queued()[0].items.map((i: { kind: string }) => i.kind)).toEqual([
      'terms',
      'policy-ack',
      'age-18',
      'trainer-terms',
    ]);
    release({ id: 'x', at: 1 });
    await p;
    const calls = h.grant.mock.calls.map((c) => c[0]);
    expect(calls.map((c) => c.kind)).toEqual(['terms', 'policy-ack', 'age-18', 'trainer-terms']);
    expect(calls[0].textHash).toMatch(hex);
    expect(calls[1].textHash).toMatch(hex);
    expect(calls[2].textHash).toBeUndefined();
    expect(calls[3]).toMatchObject({ version: LEGAL_VERSIONS['trainer-terms'] });
    expect(calls[3].textHash).toBe(await sha256Hex(trainerTermsHashInput('en')));
    expect(queued()).toEqual([]);
  });

  it('only the trainer part: one trainer-terms grant, nothing else; only the base part: the three', async () => {
    h.grant.mockResolvedValue({ id: 'x', at: 1 });
    await recordGateConsents('en', { base: false, trainer: true });
    expect(h.grant.mock.calls.map((c) => c[0].kind)).toEqual(['trainer-terms']);
    h.grant.mockClear();
    await recordGateConsents('en', { base: true, trainer: false });
    expect(h.grant.mock.calls.map((c) => c[0].kind)).toEqual(['terms', 'policy-ack', 'age-18']);
  });

  it('the hash follows the language shown; nothing needed or signed out writes nothing', async () => {
    h.grant.mockResolvedValue({ id: 'x', at: 1 });
    await recordGateConsents('uk', { base: false, trainer: true });
    expect(h.grant.mock.calls[0][0].textHash).toBe(await sha256Hex(trainerTermsHashInput('uk')));
    expect(h.grant.mock.calls[0][0].textHash).not.toBe(
      await sha256Hex(trainerTermsHashInput('en')),
    );
    h.grant.mockClear();
    await recordGateConsents('en', { base: false, trainer: false });
    h.uid = null;
    await recordGateConsents('en', { base: true, trainer: true });
    expect(h.grant).not.toHaveBeenCalled();
    expect(queued()).toEqual([]);
  });

  it('an offline failure keeps every kind queued for the next flush', async () => {
    h.grant.mockRejectedValue(Object.assign(new Error('offline'), { status: 503 }));
    await recordGateConsents('en', { base: true, trainer: true });
    expect(pendingConsentKinds('u1')).toEqual(['terms', 'policy-ack', 'age-18', 'trainer-terms']);
  });
});

describe('optional choices in the queue', () => {
  it('sends categories and engines when queued, and lists the pending kinds per account', async () => {
    h.grant.mockRejectedValue(new Error('offline'));
    enqueueConsents('u1', [
      { kind: 'atlas-ai', version: AI, categories: ['plan'], engines: ['gemini'] },
      { kind: 'geo-search', version: GEO },
    ]);
    enqueueConsents('u2', [{ kind: 'health:cycle', version: currentVersion('health:cycle') }]);
    expect(pendingConsentKinds('u1')).toEqual(['atlas-ai', 'geo-search']);
    expect(pendingConsentKinds('nobody')).toEqual([]);
    await flushPendingConsents();
    expect(h.grant).toHaveBeenCalledWith({
      kind: 'atlas-ai',
      version: AI,
      textHash: undefined,
      categories: ['plan'],
      engines: ['gemini'],
    });
    expect(h.grant.mock.calls[1][0]).not.toHaveProperty('categories');
    expect(pendingConsentKinds('u1')).toHaveLength(2); // all failed: nothing is dropped
  });
});

const httpErr = (status: number) => Object.assign(new Error(`http ${status}`), { status });

describe('a grant the server refuses for good does not suppress the gate forever', () => {
  const items = () => queued()[0]?.items ?? [];
  const seed = () =>
    enqueueConsents('u1', [
      { kind: 'terms', version: currentVersion('terms'), textHash: 'a'.repeat(64) },
      { kind: 'age-18', version: currentVersion('age-18') },
    ]);

  it.each([400, 403, 404])(
    'drops an item the server refuses with %i and keeps going',
    async (status) => {
      h.grant.mockRejectedValueOnce(httpErr(status)).mockResolvedValue({ id: 'x', at: 1 });
      seed();
      await flushPendingConsents();
      expect(h.grant).toHaveBeenCalledTimes(2);
      expect(localStorage.getItem(CONSENT_QUEUE_KEY)).toBeNull();
      expect(pendingConsentKinds('u1')).toEqual([]);
    },
  );

  it.each([401, 408, 429, 500, 503])('keeps an item after a transient %i', async (status) => {
    h.grant.mockRejectedValue(httpErr(status));
    seed();
    await flushPendingConsents();
    expect(items()).toHaveLength(2);
  });

  it('409 (already recorded) counts as success', async () => {
    h.grant.mockRejectedValue(httpErr(409));
    seed();
    await flushPendingConsents();
    expect(localStorage.getItem(CONSENT_QUEUE_KEY)).toBeNull();
  });

  it('a terms grant without a hash (no WebCrypto) is refused with 400 and dropped, so the gate asks again', async () => {
    h.grant.mockRejectedValue(httpErr(400));
    enqueueConsents('u1', [{ kind: 'terms', version: currentVersion('terms') }]);
    expect(pendingConsentKinds('u1')).toEqual(['terms']);
    await flushPendingConsents();
    expect(pendingConsentKinds('u1')).toEqual([]);
    expect(localStorage.getItem(CONSENT_QUEUE_KEY)).toBeNull();
  });

  it('a queued grant of an older version is not "pending" (it can never be accepted), even before it is sent', () => {
    enqueueConsents('u1', [
      { kind: 'terms', version: '2020-01-01' },
      { kind: 'policy-ack', version: currentVersion('policy-ack') },
    ]);
    expect(pendingConsentKinds('u1')).toEqual(['policy-ack']);
    expect(pendingConsentKinds('u1', { ...LEGAL_VERSIONS, policy: '2099-01-01' })).toEqual([]);
  });

  it('queued withdrawals are not "pending grants"', () => {
    enqueueConsents('u1', [
      { kind: 'geo-search', action: 'withdraw', version: currentVersion('geo-search') },
    ]);
    expect(pendingConsentKinds('u1')).toEqual([]);
  });
});

describe('withdrawals use the same persisted queue', () => {
  const wd = { kind: 'geo-search', action: 'withdraw', version: GEO } as const;

  it('offline: the withdrawal stays queued (survives a reload) and a later flush sends it, then clears the local-off flag', async () => {
    markLocalOff('u1', 'geo-search');
    h.withdraw.mockRejectedValue(new Error('offline'));
    expect(await sendConsentDurably({ ...wd, engines: ['photon'] })).toBe(false);
    expect(queued()[0].items[0]).toMatchObject({ kind: 'geo-search', action: 'withdraw' });
    expect(localOffKinds('u1')).toEqual(['geo-search']);
    h.withdraw.mockReset().mockResolvedValue({ id: 'w', at: 1 });
    await flushPendingConsents();
    expect(h.withdraw).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'geo-search', engines: ['photon'] }),
    );
    expect(h.grant).not.toHaveBeenCalled();
    expect(localStorage.getItem(CONSENT_QUEUE_KEY)).toBeNull();
    expect(localStorage.getItem(LOCAL_OFF_KEY)).toBeNull();
  });

  it('online: returns true; a 409 is also success', async () => {
    h.withdraw.mockResolvedValue({ id: 'w', at: 1 });
    expect(await sendConsentDurably(wd)).toBe(true);
    h.withdraw.mockRejectedValue(httpErr(409));
    expect(await sendConsentDurably(wd)).toBe(true);
    expect(localStorage.getItem(CONSENT_QUEUE_KEY)).toBeNull();
  });

  it('a refused withdrawal returns false and keeps the local-off flag (the feature stays off)', async () => {
    markLocalOff('u1', 'geo-search');
    h.withdraw.mockRejectedValue(httpErr(400));
    expect(await sendConsentDurably(wd)).toBe(false);
    expect(localStorage.getItem(CONSENT_QUEUE_KEY)).toBeNull();
    expect(localOffKinds('u1')).toEqual(['geo-search']);
  });

  it('items go out in order, and a failed item holds back later items of the SAME kind only', async () => {
    const order: string[] = [];
    h.grant.mockImplementation(async (i: { kind: string }) => {
      order.push(`g:${i.kind}`);
      if (i.kind === 'geo-search') throw new Error('offline');
    });
    h.withdraw.mockImplementation(async (i: { kind: string }) => {
      order.push(`w:${i.kind}`);
    });
    enqueueConsents('u1', [
      { kind: 'geo-search', version: GEO },
      { kind: 'geo-search', action: 'withdraw', version: GEO },
      { kind: 'atlas-ai', action: 'withdraw', version: AI },
    ]);
    await flushPendingConsents();
    expect(order).toEqual(['g:geo-search', 'w:atlas-ai']);
    expect(queued()[0].items.map((i: { action?: string }) => i.action ?? 'grant')).toEqual([
      'grant',
      'withdraw',
    ]);
  });

  it('a direct grant first sends the queue; the unsent withdrawal is dropped only by commit() after the grant', async () => {
    h.withdraw.mockRejectedValue(new Error('offline'));
    await sendConsentDurably(wd);
    const commit = await prepareDirectGrant('geo-search');
    expect(queued()[0].items).toHaveLength(1); // still there until the grant succeeded
    commit();
    expect(localStorage.getItem(CONSENT_QUEUE_KEY)).toBeNull();
  });

  it('flush fails (offline / 5xx) and the grant fails: no commit, the withdrawal and the local-off flag stay', async () => {
    markLocalOff('u1', 'geo-search');
    h.withdraw.mockRejectedValue(httpErr(503));
    await sendConsentDurably(wd);
    await prepareDirectGrant('geo-search'); // the caller's grantConsent then throws: commit() is never called
    expect(queued()[0].items[0]).toMatchObject({ kind: 'geo-search', action: 'withdraw' });
    expect(localOffKinds('u1')).toEqual(['geo-search']);
  });

  it('commit() leaves a withdrawal queued AFTER prepare, and other kinds, alone', async () => {
    h.withdraw.mockRejectedValue(new Error('offline'));
    await sendConsentDurably(wd);
    const commit = await prepareDirectGrant('geo-search');
    await sendConsentDurably({ ...wd, version: 'v-new' });
    await sendConsentDurably({ kind: 'atlas-ai', action: 'withdraw', version: AI });
    commit();
    expect(
      queued()[0].items.map((i: { kind: string; version: string }) => `${i.kind}:${i.version}`),
    ).toEqual(['geo-search:v-new', `atlas-ai:${AI}`]);
  });

  it('a pass stops when the signed-in account changes mid-pass', async () => {
    enqueueConsents('u1', [
      { kind: 'geo-search', action: 'withdraw', version: GEO },
      { kind: 'atlas-ai', action: 'withdraw', version: AI },
    ]);
    h.withdraw.mockImplementation(async () => {
      h.uid = 'u2'; // switched while the first call is in flight
    });
    await flushPendingConsents();
    expect(h.withdraw).toHaveBeenCalledTimes(1);
    expect(queued()[0].items).toHaveLength(1); // the second stays for u1's next sign-in
  });

  it('a withdrawal refused with 403/404 is retried up to the limit, then dropped; the local-off flag stays', async () => {
    markLocalOff('u1', 'geo-search');
    h.withdraw.mockRejectedValue(httpErr(403));
    enqueueConsents('u1', [wd]);
    for (let n = 1; n < WITHDRAW_REFUSAL_LIMIT; n++) {
      await flushPendingConsents();
      expect(queued()[0].items).toHaveLength(1);
      expect(queued()[0].items[0].refused).toBe(n);
    }
    await flushPendingConsents();
    expect(localStorage.getItem(CONSENT_QUEUE_KEY)).toBeNull();
    expect(h.withdraw).toHaveBeenCalledTimes(WITHDRAW_REFUSAL_LIMIT);
    expect(localOffKinds('u1')).toEqual(['geo-search']);
  });

  it('a withdrawal that succeeds after a 404 clears the flag; a grant refused 404 is still dropped at once', async () => {
    markLocalOff('u1', 'geo-search');
    h.withdraw.mockRejectedValueOnce(httpErr(404)).mockResolvedValue({ id: 'w', at: 1 });
    enqueueConsents('u1', [wd]);
    await flushPendingConsents();
    expect(queued()[0].items).toHaveLength(1);
    await flushPendingConsents();
    expect(localStorage.getItem(CONSENT_QUEUE_KEY)).toBeNull();
    expect(localOffKinds('u1')).toEqual([]);
    h.grant.mockRejectedValue(httpErr(404));
    enqueueConsents('u1', [{ kind: 'geo-search', version: GEO }]);
    await flushPendingConsents();
    expect(localStorage.getItem(CONSENT_QUEUE_KEY)).toBeNull();
  });

  it("pruneConsentsOf removes only that account's queue and flags", () => {
    enqueueConsents('u1', [wd]);
    enqueueConsents('u2', [wd]);
    markLocalOff('u1', 'geo-search');
    markLocalOff('u2', 'geo-search');
    markVerifiedClear('u1');
    markVerifiedClear('u2');
    pruneConsentsOf('u1');
    expect(wasVerifiedClear('u1')).toBe(false);
    expect(wasVerifiedClear('u2')).toBe(true);
    expect(queued().map((x: { uid: string }) => x.uid)).toEqual(['u2']);
    expect(localOffKinds('u1')).toEqual([]);
    expect(localOffKinds('u2')).toEqual(['geo-search']);
  });

  it('callers that arrive during a pass wait for it', async () => {
    let release: () => void = () => undefined;
    h.withdraw.mockImplementation(() => new Promise<void>((r) => (release = r)));
    const first = sendConsentDurably(wd);
    const second = sendConsentDurably({ ...wd, kind: 'atlas-ai', version: AI });
    release();
    await vi.waitFor(() => expect(h.withdraw).toHaveBeenCalledTimes(2));
    release();
    expect(await first).toBe(true);
    expect(await second).toBe(true);
  });
});

describe('flush runner is per account', () => {
  it("an account switch does not swallow the other account's flush", async () => {
    enqueueConsents('u1', [{ kind: 'terms', version: LEGAL_VERSIONS.terms }]);
    enqueueConsents('u2', [{ kind: 'terms', version: LEGAL_VERSIONS.terms }]);
    let release: (v: unknown) => void = () => undefined;
    h.grant.mockReturnValueOnce(new Promise((r) => (release = r))); // u1's pass hangs
    h.grant.mockResolvedValue({ id: 'x', at: 1 });
    const p1 = flushPendingConsents();
    h.uid = 'u2';
    await flushPendingConsents(); // must run u2's own pass, not wait for / return u1's
    expect(queued().map((x: { uid: string }) => x.uid)).toEqual(['u1']);
    h.uid = 'u1';
    release({ id: 'x', at: 1 });
    await p1;
  });
});

describe('recordGateConsents reports a permanent refusal', () => {
  it('false when the server refused a grant for good (dropped: neither queued nor recorded); true when only offline', async () => {
    h.grant.mockRejectedValue(Object.assign(new Error('bad'), { status: 400 }));
    const seen: string[] = [];
    const off = onConsentDropped((u, k) => seen.push(`${u}:${k}`));
    await expect(recordGateConsents('en', { base: false, trainer: true })).resolves.toBe(false);
    off();
    expect(seen).toEqual(['u1:trainer-terms']);
    expect(pendingConsentKinds('u1')).toEqual([]);
    h.grant.mockReset();
    h.grant.mockRejectedValue(new Error('offline'));
    await expect(recordGateConsents('en', { base: false, trainer: true })).resolves.toBe(true);
    expect(pendingConsentKinds('u1')).toEqual(['trainer-terms']);
  });
});
