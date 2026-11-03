import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoopbackPorts } from './callsLoopback';

vi.mock('../firebase', () => ({ db: {}, functions: {} }));
vi.mock('firebase/firestore', () => ({}));
vi.mock('firebase/functions', () => ({ httpsCallable: () => vi.fn() }));

type Reply = { ok: true; v: unknown } | { ok: false; code?: string; reason?: string };
type Rpc = (name: string, args: unknown) => Promise<Reply>;

async function load(rpc?: Rpc) {
  vi.resetModules();
  window.__callsRpc = rpc;
  const m = await import('./callsLoopback');
  return m.loopbackPorts();
}

const ok = (v: unknown): Reply => ({ ok: true, v });
const tick = (ms = 100) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.setItem('spotter.uid', 'u1');
});
afterEach(() => {
  vi.useRealTimers();
  delete window.__callsRpc;
  delete window.__callsE2E;
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('loopbackPorts', () => {
  it('is null without the e2e binding, and the answer is remembered', async () => {
    vi.resetModules();
    delete window.__callsRpc;
    const m = await import('./callsLoopback');
    expect(m.loopbackPorts()).toBeNull();
    window.__callsRpc = async () => ok(1);
    expect(m.loopbackPorts()).toBeNull();
  });

  it('with the binding it returns the same ports each time', async () => {
    vi.resetModules();
    window.__callsRpc = async () => ok(1);
    const m = await import('./callsLoopback');
    const p = m.loopbackPorts();
    expect(p).not.toBeNull();
    expect(m.loopbackPorts()).toBe(p);
  });
});

describe('api over the rpc binding', () => {
  it('adds the uid and routes every method to its rpc name', async () => {
    const rpc = vi.fn<Rpc>(async () => ok({ state: 'ringing' }));
    const p = (await load(rpc)) as LoopbackPorts;
    const offer = { type: 'offer' as const, sdp: 's' };
    await p.api.start({ callId: 'c', peerId: 'x', kind: 'voice', offer, relayOnly: false });
    await p.api.answer({ callId: 'c', accept: true });
    await p.api.active('c');
    await p.api.end('c', 'hangup');
    await p.api.ice('c', { candidate: 'k' });
    await p.api.turn('c');
    expect(rpc.mock.calls.map((c) => c[0])).toEqual([
      'start',
      'answer',
      'active',
      'end',
      'ice',
      'turn',
    ]);
    expect(rpc.mock.calls[0][1]).toMatchObject({ uid: 'u1', callId: 'c', peerId: 'x' });
    expect(rpc.mock.calls[3][1]).toEqual({ uid: 'u1', callId: 'c', reason: 'hangup' });
    expect(rpc.mock.calls[4][1]).toEqual({ uid: 'u1', callId: 'c', candidate: { candidate: 'k' } });
  });

  it('an empty uid is sent when none is stored', async () => {
    localStorage.removeItem('spotter.uid');
    const rpc = vi.fn<Rpc>(async () => ok(null));
    const p = (await load(rpc)) as LoopbackPorts;
    await p.api.active('c');
    expect(rpc.mock.calls[0][1]).toEqual({ uid: '', callId: 'c' });
  });

  it('a failed reply is thrown with code and reason', async () => {
    const p = (await load(async () => ({
      ok: false,
      code: 'failed-precondition',
      reason: 'already-in-call',
    }))) as LoopbackPorts;
    const e = await p.api.active('c').catch((x: unknown) => x as Error & { code?: string });
    expect((e as Error).message).toBe('already-in-call');
    expect((e as { code?: string }).code).toBe('failed-precondition');
    expect((e as { reason?: string }).reason).toBe('already-in-call');
  });

  it('a failed reply with only a code, or nothing, still has a message', async () => {
    let reply: Reply = { ok: false, code: 'unavailable' };
    const p = (await load(async () => reply)) as LoopbackPorts;
    expect(((await p.api.active('c').catch((x: unknown) => x)) as Error).message).toBe(
      'unavailable',
    );
    reply = { ok: false };
    expect(((await p.api.active('c').catch((x: unknown) => x)) as Error).message).toBe(
      'call failed',
    );
  });
});

describe('wire polling', () => {
  it('watchCall emits on the first poll and then only when the doc changes', async () => {
    let doc: unknown = { id: 'c', state: 'ringing' };
    const rpc = vi.fn<Rpc>(async () => ok(doc));
    const p = (await load(rpc)) as LoopbackPorts;
    const cb = vi.fn();
    const off = p.wire.watchCall('c', cb);
    await tick(0);
    expect(rpc).toHaveBeenCalledWith('getCall', { uid: 'u1', callId: 'c' });
    expect(cb).toHaveBeenCalledTimes(1);
    await tick();
    expect(cb).toHaveBeenCalledTimes(1);
    doc = { id: 'c', state: 'active' };
    await tick();
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenLastCalledWith({ id: 'c', state: 'active' });
    off();
    doc = null;
    const n = rpc.mock.calls.length;
    await tick(500);
    expect(rpc.mock.calls.length).toBe(n);
  });

  it('a throwing poll is retried on the next tick', async () => {
    let fail = true;
    const rpc = vi.fn<Rpc>(async () => {
      if (fail) throw new Error('boom');
      return ok({ id: 'c' });
    });
    const p = (await load(rpc)) as LoopbackPorts;
    const cb = vi.fn();
    const off = p.wire.watchCall('c', cb);
    await tick(0);
    expect(cb).not.toHaveBeenCalled();
    fail = false;
    await tick();
    expect(cb).toHaveBeenCalledWith({ id: 'c' });
    off();
  });

  it('stopping inside a running tick ends the loop without scheduling another', async () => {
    let release: (r: Reply) => void = () => {};
    const rpc = vi.fn<Rpc>(() => new Promise<Reply>((r) => (release = r)));
    const p = (await load(rpc)) as LoopbackPorts;
    const cb = vi.fn();
    const off = p.wire.watchCall('c', cb);
    await tick(0);
    off();
    release(ok({ id: 'c' }));
    await tick(500);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('watchIce passes each candidate once and asks only for newer ones', async () => {
    const batches: { n: number; candidate: RTCIceCandidateInit }[][] = [
      [
        { n: 1, candidate: { candidate: 'a' } },
        { n: 2, candidate: { candidate: 'b' } },
      ],
      [],
    ];
    const rpc = vi.fn<Rpc>(async () => ok(batches.shift() ?? []));
    const p = (await load(rpc)) as LoopbackPorts;
    const cb = vi.fn();
    const off = p.wire.watchIce('c', 'me', cb);
    await tick(0);
    expect(cb.mock.calls.map((c) => c[0])).toEqual([
      { id: '1', candidate: { candidate: 'a' } },
      { id: '2', candidate: { candidate: 'b' } },
    ]);
    await tick();
    expect(rpc).toHaveBeenLastCalledWith('ice-since', { uid: 'me', callId: 'c', after: 2 });
    off();
  });

  it('watchIncoming rings once per call id', async () => {
    const d = { id: 'x', state: 'ringing' };
    const rpc = vi.fn<Rpc>(async () => ok([d]));
    const p = (await load(rpc)) as LoopbackPorts;
    const cb = vi.fn();
    const off = p.wire.watchIncoming('me', cb);
    await tick(0);
    await tick();
    expect(rpc).toHaveBeenCalledWith('incoming', { uid: 'me' });
    expect(cb).toHaveBeenCalledTimes(1);
    off();
  });

  it('watchFlag emits when the switch changes', async () => {
    let on = false;
    const rpc = vi.fn<Rpc>(async () => ok(on));
    const p = (await load(rpc)) as LoopbackPorts;
    const cb = vi.fn();
    const off = p.watchFlag('me', cb);
    await tick(0);
    await tick();
    expect(cb.mock.calls).toEqual([[false]]);
    on = true;
    await tick();
    expect(cb.mock.calls).toEqual([[false], [true]]);
    off();
  });
});

describe('devices and the e2e hook', () => {
  class FakeTrack {
    constructor(
      public kind: string,
      public enabled = true,
      public readyState = 'live',
    ) {}
  }
  class FakePc extends EventTarget {
    cfg: RTCConfiguration;
    senders: { track: FakeTrack | null }[] = [];
    receivers: { track: FakeTrack }[] = [];
    stats: Record<string, unknown>[] = [];
    configs: RTCConfiguration[] = [];
    constructor(cfg: RTCConfiguration) {
      super();
      this.cfg = cfg;
    }
    setConfiguration(c: RTCConfiguration) {
      this.configs.push(c);
    }
    getSenders() {
      return this.senders;
    }
    getReceivers() {
      return this.receivers;
    }
    async getStats() {
      return { forEach: (f: (s: Record<string, unknown>) => void) => this.stats.forEach(f) };
    }
  }

  async function ports() {
    vi.stubGlobal('RTCPeerConnection', FakePc);
    return (await load(async () => ok(null))) as LoopbackPorts;
  }

  it('before any peer exists the hook reports nothing', async () => {
    await ports();
    const e = window.__callsE2E!;
    expect(e.peerState()).toBeNull();
    expect(e.senders()).toEqual([]);
    expect(e.dropLink()).toBe(false);
    expect(e.restoreLink()).toBe(false);
    expect(await e.media()).toEqual({
      audioBytes: 0,
      videoBytes: 0,
      audioTracks: 0,
      videoTracks: 0,
    });
  });

  it('createPeer strips ICE servers, also on later setConfiguration', async () => {
    const p = await ports();
    const pc = p.devices.createPeer({
      iceServers: [{ urls: 'stun:x' }],
      iceTransportPolicy: 'relay',
    }) as unknown as FakePc;
    expect(pc.cfg.iceServers).toEqual([]);
    expect(pc.cfg.iceTransportPolicy).toBe('relay');
    pc.setConfiguration({ iceServers: [{ urls: 'turn:y' }] });
    expect(pc.configs[0].iceServers).toEqual([]);
    expect(typeof p.devices.online()).toBe('boolean');
    expect(Math.abs(p.devices.now() - Date.now())).toBeLessThan(1000);
  });

  it('dropLink forces a state and fires the event, restoreLink undoes it', async () => {
    const p = await ports();
    const pc = p.devices.createPeer({}) as unknown as FakePc;
    Object.defineProperty(pc, 'connectionState', { configurable: true, value: 'connected' });
    const seen: string[] = [];
    pc.addEventListener('connectionstatechange', () => seen.push('evt'));
    const e = window.__callsE2E!;
    expect(e.dropLink()).toBe(true);
    expect(e.peerState()).toBe('failed');
    expect(e.dropLink('disconnected')).toBe(true);
    expect(e.peerState()).toBe('disconnected');
    expect(e.restoreLink()).toBe(true);
    expect(seen).toHaveLength(3);
    expect(Object.getOwnPropertyDescriptor(pc, 'connectionState')?.get).toBeUndefined();
  });

  it('senders lists tracks only; media sums inbound RTP bytes by kind', async () => {
    const p = await ports();
    const pc = p.devices.createPeer({}) as unknown as FakePc;
    pc.senders = [
      { track: new FakeTrack('audio') },
      { track: new FakeTrack('video', false, 'ended') },
      { track: null },
    ];
    pc.receivers = [
      { track: new FakeTrack('audio') },
      { track: new FakeTrack('video') },
      { track: new FakeTrack('video') },
    ];
    pc.stats = [
      { type: 'inbound-rtp', kind: 'audio', bytesReceived: 10 },
      { type: 'inbound-rtp', kind: 'video', bytesReceived: 100 },
      { type: 'inbound-rtp', kind: 'video' },
      { type: 'outbound-rtp', kind: 'video', bytesReceived: 5 },
    ];
    const e = window.__callsE2E!;
    expect(e.senders()).toEqual([
      { kind: 'audio', enabled: true, live: true },
      { kind: 'video', enabled: false, live: false },
    ]);
    expect(await e.media()).toEqual({
      audioBytes: 10,
      videoBytes: 100,
      audioTracks: 1,
      videoTracks: 2,
    });
  });
});
