import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const h = vi.hoisted(() => {
  class HttpError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    HttpError,
    callFn: vi.fn(),
    uid: 'u1' as string | null,
    role: 'member' as string,
    snap: null as null | {
      next: (s: unknown) => void;
      error: (e: Error) => void;
      opts: unknown;
    },
  };
});

vi.mock('../api', () => ({
  HttpError: h.HttpError,
  callFn: h.callFn,
  currentUid: () => h.uid,
  getRole: () => h.role,
}));
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  onSnapshot: (
    _c: unknown,
    opts: unknown,
    next: (s: unknown) => void,
    error: (e: Error) => void,
  ) => {
    h.snap = { next, error, opts };
    return () => {
      h.snap = null;
    };
  },
}));

import {
  applySnapshot,
  grantConsent,
  gateNeedsOf,
  legalGateOf,
  toConsentRecord,
  useConsentRecords,
  useLegalGate,
  withdrawConsent,
  type ConsentRecordsState,
} from './consentApi';
import { markVerifiedClear } from './gateVerified';
import { REQUIRED_KINDS, currentVersion, type ConsentRecord } from './consents';

const good = { kind: 'atlas-ai', action: 'grant', version: '2026-10-21', at: 5 };
const required = (): ConsentRecord[] =>
  REQUIRED_KINDS.map((k, i) => ({
    id: `${i}`,
    kind: k,
    action: 'grant',
    version: currentVersion(k),
    at: i + 1,
  }));
const snapshot = (docs: ConsentRecord[], fromCache: boolean) => ({
  docs: docs.map((d) => ({ id: d.id, data: () => ({ ...d, id: undefined }) })),
  metadata: { fromCache },
});

beforeEach(() => {
  h.callFn.mockReset();
  h.uid = 'u1';
  h.role = 'member';
  h.snap = null;
  localStorage.clear();
});

describe('toConsentRecord', () => {
  it('maps a well-formed doc, keeping optional lists of strings', () => {
    expect(
      toConsentRecord('i1', { ...good, textHash: 'h', categories: ['a', 1], engines: ['g'] }),
    ).toEqual({
      id: 'i1',
      kind: 'atlas-ai',
      action: 'grant',
      version: '2026-10-21',
      at: 5,
      textHash: 'h',
      categories: ['a'],
      engines: ['g'],
    });
  });

  it('drops anything malformed instead of trusting it', () => {
    for (const bad of [
      null,
      'x',
      5,
      { ...good, kind: 'marketing' },
      { ...good, kind: undefined },
      { ...good, action: 'revoke' },
      { ...good, version: 20261021 },
      { ...good, at: '5' },
      { ...good, at: undefined },
    ])
      expect(toConsentRecord('i', bad), JSON.stringify(bad)).toBeNull();
  });
});

describe('grantConsent / withdrawConsent', () => {
  it('sends the action and defaults the version to the current one', async () => {
    h.callFn.mockResolvedValue({ id: 'a', at: 1 });
    await grantConsent({ kind: 'atlas-ai' });
    await withdrawConsent({ kind: 'terms', version: '2026-10-21' });
    expect(h.callFn).toHaveBeenNthCalledWith(1, 'recordConsent', {
      kind: 'atlas-ai',
      action: 'grant',
      version: currentVersion('atlas-ai'),
    });
    expect(h.callFn).toHaveBeenNthCalledWith(2, 'recordConsent', {
      kind: 'terms',
      action: 'withdraw',
      version: '2026-10-21',
    });
  });

  it('omits undefined fields (the callable SDK would send them as null and the server answers bad-textHash)', async () => {
    h.callFn.mockResolvedValue({ id: 'a', at: 1 });
    await grantConsent({ kind: 'age-18', textHash: undefined });
    const body = h.callFn.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    expect('textHash' in body).toBe(false);
    expect(body).toMatchObject({ kind: 'age-18', action: 'grant' });
  });

  it('treats already-exists (409) as success and rethrows everything else', async () => {
    h.callFn.mockRejectedValueOnce(new h.HttpError(409, 'retry'));
    await expect(grantConsent({ kind: 'atlas-ai' })).resolves.toEqual({ id: '', at: 0 });
    h.callFn.mockRejectedValueOnce(new h.HttpError(429, 'Too many requests.'));
    await expect(grantConsent({ kind: 'atlas-ai' })).rejects.toThrow('Too many');
    h.callFn.mockRejectedValueOnce(new h.HttpError(503, 'offline'));
    await expect(withdrawConsent({ kind: 'atlas-ai' })).rejects.toThrow('offline');
  });
});

describe('legal gate states', () => {
  const st = (p: Partial<ConsentRecordsState>): ConsentRecordsState => ({
    records: [],
    loading: false,
    confirmed: false,
    error: null,
    ...p,
  });

  it('an empty cache-only snapshot is still loading, not an answer', () => {
    expect(applySnapshot([], { fromCache: true })).toMatchObject({
      loading: true,
      confirmed: false,
    });
    expect(applySnapshot([], { fromCache: false })).toMatchObject({
      loading: false,
      confirmed: true,
    });
    expect(applySnapshot(required(), { fromCache: true })).toMatchObject({
      loading: false,
      confirmed: false,
    });
  });

  it('is unknown while loading, on error, offline without data, and without a server answer', () => {
    expect(legalGateOf(st({ loading: true }))).toBe('unknown');
    expect(legalGateOf(st({ error: new Error('permission-denied') }))).toBe('unknown');
    expect(
      legalGateOf(st({ error: new Error('x'), records: required().slice(0, 1), confirmed: true })),
    ).toBe('unknown');
    expect(legalGateOf(st({}))).toBe('unknown');
    expect(legalGateOf(applySnapshot([], { fromCache: true }))).toBe('unknown');
    // partial records from the cache alone never lock anyone out
    expect(legalGateOf(applySnapshot(required().slice(0, 2), { fromCache: true }))).toBe('unknown');
  });

  it('is needed only when the server confirmed that a required consent is missing, withdrawn or stale', () => {
    expect(legalGateOf(applySnapshot([], { fromCache: false }))).toBe('needed');
    expect(legalGateOf(applySnapshot(required().slice(1), { fromCache: false }))).toBe('needed');
    const stale = required().map((r) => (r.kind === 'terms' ? { ...r, version: '2020-01-01' } : r));
    expect(legalGateOf(applySnapshot(stale, { fromCache: false }))).toBe('needed');
    const withdrawn = [
      ...required(),
      { ...required()[0], id: 'w', action: 'withdraw' as const, at: 99 },
    ];
    expect(legalGateOf(applySnapshot(withdrawn, { fromCache: false }))).toBe('needed');
  });

  it('is clear whenever the records we have already satisfy it, cache or server', () => {
    expect(legalGateOf(applySnapshot(required(), { fromCache: true }))).toBe('clear');
    expect(legalGateOf(applySnapshot(required(), { fromCache: false }))).toBe('clear');
    expect(legalGateOf(st({ records: required(), error: new Error('offline') }))).toBe('clear');
  });
});

describe('the gate for a trainer, manager or admin (Trainer Terms + DPA required)', () => {
  const tt = (over: Partial<ConsentRecord> = {}): ConsentRecord => ({
    id: 'tt',
    kind: 'trainer-terms',
    action: 'grant',
    version: currentVersion('trainer-terms'),
    at: 9,
    ...over,
  });
  const server = (records: ConsentRecord[]) => applySnapshot(records, { fromCache: false });
  const st = (p: Partial<ConsentRecordsState>): ConsentRecordsState => ({
    records: [],
    loading: false,
    confirmed: false,
    error: null,
    ...p,
  });

  it.each(['trainer', 'manager', 'admin'])(
    'a %s without a current trainer-terms record needs the gate, a member never does',
    (role) => {
      expect(legalGateOf(server(required()), true, role)).toBe('needed');
      expect(legalGateOf(server(required()), true, 'member')).toBe('clear');
      expect(legalGateOf(server(required()))).toBe('clear');
      expect(legalGateOf(server([...required(), tt()]), true, role)).toBe('clear');
    },
  );

  it('stale, withdrawn and never-answered trainer-terms all need it; only the trainer part is flagged', () => {
    expect(gateNeedsOf(required(), 'trainer')).toEqual({ base: false, trainer: true });
    expect(gateNeedsOf([...required(), tt({ version: '2020-01-01' })], 'trainer').trainer).toBe(
      true,
    );
    expect(gateNeedsOf([...required(), tt({ action: 'withdraw' })], 'admin').trainer).toBe(true);
    expect(gateNeedsOf([], 'manager')).toEqual({ base: true, trainer: true });
    expect(gateNeedsOf([], 'member')).toEqual({ base: true, trainer: false });
    expect(gateNeedsOf([...required(), tt()], 'trainer')).toEqual({ base: false, trainer: false });
  });

  it('the unknown states follow the existing gate: cached clear = unknown, none = unverified, never needed', () => {
    const unconfirmed = applySnapshot(required(), { fromCache: true });
    expect(legalGateOf(unconfirmed, true, 'trainer')).toBe('unknown');
    expect(legalGateOf(unconfirmed, false, 'trainer')).toBe('unverified');
    expect(legalGateOf(st({ loading: true }), true, 'trainer')).toBe('unknown');
    expect(legalGateOf(st({ error: new Error('x') }), false, 'trainer')).toBe('unverified');
  });

  it('useLegalGate reads the real role and the role-specific cached clear', () => {
    h.role = 'trainer';
    markVerifiedClear('u1'); // a member signature: it does not vouch for a trainer
    const { result } = renderHook(() => useLegalGate());
    expect(result.current).toBe('unverified');
    act(() => h.snap!.next(snapshot(required(), false)));
    expect(result.current).toBe('needed');
    act(() => h.snap!.next(snapshot([...required(), tt()], false)));
    expect(result.current).toBe('clear');
  });
});

describe('useConsentRecords / useLegalGate', () => {
  it('subscribes with metadata changes and walks unknown -> needed as the server answers', () => {
    markVerifiedClear('u1'); // this device saw the server confirm the consents before
    const { result } = renderHook(() => useLegalGate());
    expect(result.current).toBe('unknown');
    expect((h.snap!.opts as { includeMetadataChanges: boolean }).includeMetadataChanges).toBe(true);
    act(() => h.snap!.next(snapshot([], true)));
    expect(result.current).toBe('unknown'); // empty cache must not lock out a device that saw the consents confirmed
    act(() => h.snap!.next(snapshot([], false)));
    expect(result.current).toBe('needed');
    act(() => h.snap!.next(snapshot(required(), false)));
    expect(result.current).toBe('clear');
  });

  it('is unverified (not unknown) while nothing was ever confirmed on this device', () => {
    const { result } = renderHook(() => useLegalGate());
    expect(result.current).toBe('unverified');
    act(() => h.snap!.next(snapshot([], true)));
    expect(result.current).toBe('unverified');
    act(() => h.snap!.error(new Error('offline')));
    expect(result.current).toBe('unverified');
    const idle: ConsentRecordsState = {
      records: [],
      loading: false,
      confirmed: false,
      error: null,
    };
    expect(legalGateOf(idle, true)).toBe('unknown');
    expect(legalGateOf(idle, false)).toBe('unverified');
    expect(legalGateOf(applySnapshot([], { fromCache: false }), false)).toBe('needed');
    expect(legalGateOf(applySnapshot(required(), { fromCache: true }), false)).toBe('clear');
  });

  it('stays unknown on a listener error and drops malformed docs', () => {
    const { result } = renderHook(() => useConsentRecords());
    act(() =>
      h.snap!.next({
        docs: [{ id: 'bad', data: () => ({ kind: 'nope' }) }, ...snapshot(required(), false).docs],
        metadata: { fromCache: false },
      }),
    );
    expect(result.current.records).toHaveLength(3);
    act(() => h.snap!.error(new Error('offline')));
    expect(result.current.error?.message).toBe('offline');
    expect(legalGateOf(result.current)).toBe('clear');
  });

  it('retry drops the failed listener and subscribes again (state back to loading, error cleared)', () => {
    const { result } = renderHook(() => useConsentRecords());
    act(() => h.snap!.error(Object.assign(new Error('x'), { code: 'permission-denied' })));
    expect(result.current.error).not.toBeNull();
    expect(result.current.loading).toBe(false);
    const first = h.snap;
    act(() => result.current.retry());
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(h.snap).not.toBe(first); // a fresh onSnapshot subscription
    act(() => h.snap!.next(snapshot(required(), false)));
    expect(result.current.confirmed).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('logs a clear deploy hint for permission-denied / not-found, not for network errors', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderHook(() => useConsentRecords());
    act(() => h.snap!.error(Object.assign(new Error('x'), { code: 'permission-denied' })));
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]![0])).toMatch(/consentRecords not deployed/);
    expect(log.mock.calls[0]![1]).toBe('permission-denied');
    act(() => h.snap!.error(Object.assign(new Error('x'), { code: 'unavailable' })));
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });

  it('logs the deploy hint when the recordConsent callable is missing (404) or refused (403)', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.callFn.mockRejectedValueOnce(new h.HttpError(404, 'not-found'));
    await expect(grantConsent({ kind: 'atlas-ai' })).rejects.toBeInstanceOf(h.HttpError);
    expect(String(log.mock.calls[0]![0])).toMatch(/not deployed/);
    log.mockRestore();
  });

  it('never shows account A records to account B, not even for one render', () => {
    const seen: { uid: string | null; n: number; loading: boolean }[] = [];
    const { rerender } = renderHook(() => {
      const r = useConsentRecords();
      seen.push({ uid: h.uid, n: r.records.length, loading: r.loading });
      return r;
    });
    act(() => h.snap!.next(snapshot(required(), false)));
    expect(seen.at(-1)).toMatchObject({ uid: 'u1', n: 3, loading: false });
    h.uid = 'u2';
    seen.length = 0;
    rerender();
    expect(seen.length).toBeGreaterThan(0);
    for (const s of seen) expect(s).toMatchObject({ uid: 'u2', n: 0, loading: true });
    act(() => h.snap!.next(snapshot([], false)));
    expect(seen.at(-1)).toMatchObject({ uid: 'u2', n: 0, loading: false });
  });

  it('is idle and unknown when signed out, and does not subscribe', () => {
    h.uid = null;
    const { result } = renderHook(() => useLegalGate());
    expect(result.current).toBe('unknown');
    expect(h.snap).toBeNull();
  });
});
