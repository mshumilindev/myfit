import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  fns: new Map<string, ReturnType<typeof vi.fn>>(),
  snapshots: [] as {
    target: unknown;
    next: (s: unknown) => void;
    err: () => void;
  }[],
}));

vi.mock('../firebase', () => ({ db: { __db: true }, functions: { __fn: true } }));
vi.mock('firebase/functions', () => ({
  httpsCallable: (_f: unknown, name: string) => {
    const fn = vi.fn();
    h.fns.set(name, fn);
    return fn;
  },
}));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  where: (f: string, op: string, v: string) => ({ f, op, v }),
  query: (c: unknown, ...w: unknown[]) => ({ c, w }),
  onSnapshot: (target: unknown, next: (s: unknown) => void, err: () => void) => {
    h.snapshots.push({ target, next, err });
    return vi.fn();
  },
}));

import { browserCallDevices, firebaseCallApi, firebaseCallWire } from './callsFirebase';
import { CALL_PREFS_KEY } from './callPrefs';
import type { CallDoc, CallError } from './callPorts';

const fn = (name: string) => h.fns.get(name) as ReturnType<typeof vi.fn>;
const lastSnap = () => h.snapshots[h.snapshots.length - 1];

beforeEach(() => {
  h.snapshots.length = 0;
  for (const f of h.fns.values()) f.mockReset();
  localStorage.clear();
});

describe('firebaseCallApi', () => {
  it('start returns the callable data', async () => {
    fn('callStart').mockResolvedValue({ data: { state: 'ringing' } });
    const a = {
      callId: 'c1',
      peerId: 'p',
      kind: 'voice' as const,
      offer: { type: 'offer' as const, sdp: 's' },
      relayOnly: false,
    };
    await expect(firebaseCallApi.start(a)).resolves.toEqual({ state: 'ringing' });
    expect(fn('callStart')).toHaveBeenCalledWith(a);
  });

  it('answer / active / end / ice pass their arguments and resolve to void', async () => {
    for (const n of ['callAnswer', 'callActive', 'callEnd', 'callIce'])
      fn(n).mockResolvedValue({ data: { ok: true } });
    await expect(firebaseCallApi.answer({ callId: 'c', accept: false })).resolves.toBeUndefined();
    expect(fn('callAnswer')).toHaveBeenCalledWith({ callId: 'c', accept: false });
    await expect(firebaseCallApi.active('c')).resolves.toBeUndefined();
    expect(fn('callActive')).toHaveBeenCalledWith({ callId: 'c' });
    await expect(firebaseCallApi.end('c', 'hangup')).resolves.toBeUndefined();
    expect(fn('callEnd')).toHaveBeenCalledWith({ callId: 'c', reason: 'hangup' });
    await expect(firebaseCallApi.ice('c', { candidate: 'x' })).resolves.toBeUndefined();
    expect(fn('callIce')).toHaveBeenCalledWith({ callId: 'c', candidate: { candidate: 'x' } });
  });

  it('turn returns the ice servers', async () => {
    const iceServers = [{ urls: 'turn:t' }];
    fn('callTurn').mockResolvedValue({ data: { iceServers } });
    await expect(firebaseCallApi.turn('c')).resolves.toEqual({ iceServers });
    expect(fn('callTurn')).toHaveBeenCalledWith({ callId: 'c' });
  });

  it('a callable error becomes { code (prefix stripped), reason }', async () => {
    fn('callStart').mockRejectedValue({
      code: 'functions/failed-precondition',
      details: { reason: 'already-in-call' },
      message: 'nope',
    });
    const err = (await firebaseCallApi
      .start({
        callId: 'c',
        peerId: 'p',
        kind: 'voice',
        offer: { type: 'offer', sdp: '' },
        relayOnly: false,
      })
      .catch((e: CallError) => e)) as CallError;
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('nope');
    expect(err.code).toBe('failed-precondition');
    expect(err.reason).toBe('already-in-call');
  });

  it('an error without fields still throws an Error with a default message', async () => {
    fn('callActive').mockRejectedValue({});
    const err = (await firebaseCallApi.active('c').catch((e: CallError) => e)) as CallError;
    expect(err.message).toBe('call failed');
    expect(err.code).toBeUndefined();
    expect(err.reason).toBeUndefined();
  });
});

const snap = (id: string, data: object | undefined) => ({
  id,
  exists: () => data !== undefined,
  data: () => data,
});

describe('firebaseCallWire.watchCall', () => {
  it('delivers the doc with its id, null when missing or on error', () => {
    const cb = vi.fn();
    const off = firebaseCallWire.watchCall('c1', cb);
    expect(typeof off).toBe('function');
    expect((lastSnap().target as { path: string }).path).toBe('calls/c1');
    lastSnap().next(snap('c1', { callerId: 'a', state: 'ringing' }));
    expect(cb).toHaveBeenLastCalledWith({ id: 'c1', callerId: 'a', state: 'ringing' });
    lastSnap().next(snap('c1', undefined));
    expect(cb).toHaveBeenLastCalledWith(null);
    cb.mockClear();
    lastSnap().err();
    expect(cb).toHaveBeenCalledWith(null);
  });
});

describe('firebaseCallWire.watchIce', () => {
  const change = (type: string, id: string, data: object) => ({
    type,
    doc: { id, data: () => data },
  });
  it('emits only added candidates written by the other side', () => {
    const cb = vi.fn();
    firebaseCallWire.watchIce('c1', 'me', cb);
    expect((lastSnap().target as { path: string }).path).toBe('calls/c1/ice');
    const cand = { candidate: 'cand' };
    lastSnap().next({
      docChanges: () => [
        change('added', 'i1', { from: 'peer', candidate: cand }),
        change('added', 'i2', { from: 'me', candidate: cand }),
        change('modified', 'i3', { from: 'peer', candidate: cand }),
        change('added', 'i4', { from: 'peer' }),
        change('added', 'i5', { candidate: cand }),
      ],
    });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({ id: 'i1', candidate: cand });
    expect(() => lastSnap().err()).not.toThrow();
  });
});

describe('firebaseCallWire.watchIncoming', () => {
  const added = (type: string, id: string, createdAt: number) => ({
    type,
    doc: { id, data: () => ({ callerId: 'p', calleeId: 'me', createdAt }) },
  });
  it('queries ringing calls for the callee and rings only for fresh added docs', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const cb = vi.fn();
    firebaseCallWire.watchIncoming('me', cb);
    const q = lastSnap().target as { w: { f: string; v: string }[] };
    expect(q.w).toEqual([
      { f: 'calleeId', op: '==', v: 'me' },
      { f: 'state', op: '==', v: 'ringing' },
    ]);
    lastSnap().next({
      docChanges: () => [
        added('added', 'fresh', 1_000_000 - 5_000),
        added('added', 'stale', 1_000_000 - 61_000),
        added('removed', 'gone', 1_000_000),
      ],
    });
    expect(cb).toHaveBeenCalledTimes(1);
    expect((cb.mock.calls[0][0] as CallDoc).id).toBe('fresh');
    expect(() => lastSnap().err()).not.toThrow();
    vi.useRealTimers();
  });
});

describe('browserCallDevices', () => {
  it('getMedia uses the saved device choices', async () => {
    const getUserMedia = vi.fn(async () => ({}) as MediaStream);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    localStorage.setItem(
      CALL_PREFS_KEY,
      JSON.stringify({ mic: 'mic-1', cam: 'cam-1', camOn: true }),
    );
    await browserCallDevices.getMedia('video');
    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: expect.objectContaining({ deviceId: { exact: 'mic-1' } }),
        video: expect.objectContaining({ deviceId: { exact: 'cam-1' } }),
      }),
    );
  });

  it('createPeer builds an RTCPeerConnection with the config; online/now read the browser', () => {
    const seen: RTCConfiguration[] = [];
    class FakePc {
      constructor(public cfg: RTCConfiguration) {
        seen.push(cfg);
      }
    }
    vi.stubGlobal('RTCPeerConnection', FakePc);
    const cfg = { iceServers: [], iceTransportPolicy: 'relay' as const };
    const pc = browserCallDevices.createPeer(cfg) as unknown as FakePc;
    expect(pc).toBeInstanceOf(FakePc);
    expect(seen[0]).toBe(cfg);
    expect(typeof browserCallDevices.online()).toBe('boolean');
    expect(Math.abs(browserCallDevices.now() - Date.now())).toBeLessThan(1000);
    vi.unstubAllGlobals();
  });
});
