import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CallSession, GIVE_UP_AFTER_MS } from './callSession';
import { RING_MS } from './callMachine';
import type { CallApi, CallDevices, CallDoc, CallWire, RemoteCandidate } from './callPorts';

class FakeTrack {
  enabled = true;
  stopped = false;
  constructor(public kind: 'audio' | 'video') {}
  stop() {
    this.stopped = true;
  }
}
class FakeStream {
  tracks: FakeTrack[] = [];
  getTracks() {
    return this.tracks;
  }
  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === 'audio');
  }
  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === 'video');
  }
  addTrack(t: FakeTrack) {
    this.tracks.push(t);
  }
}
vi.stubGlobal('MediaStream', FakeStream);

class FakePc {
  connectionState = 'new';
  closed = false;
  fail: 'remote' | null = null;
  added: unknown[] = [];
  ontrack: ((e: { streams: { getTracks: () => FakeTrack[] }[] }) => void) | null = null;
  onicecandidate: ((e: { candidate: null }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  addTrack() {}
  async createOffer() {
    return { type: 'offer', sdp: 'o' };
  }
  async createAnswer() {
    return { type: 'answer', sdp: 'a' };
  }
  async setLocalDescription() {}
  async setRemoteDescription() {
    if (this.fail === 'remote') throw new Error('bad sdp');
  }
  async addIceCandidate(c: unknown) {
    this.added.push(c);
  }
  setConfiguration() {}
  close() {
    this.closed = true;
  }
  setState(s: string) {
    this.connectionState = s;
    this.onconnectionstatechange?.();
  }
}

function setup(over: Partial<CallDevices> = {}, apiOver: Partial<CallApi> = {}) {
  const pcs: FakePc[] = [];
  const stream = new FakeStream();
  stream.tracks = [new FakeTrack('audio'), new FakeTrack('video')];
  const calls = new Map<string, (d: CallDoc | null) => void>();
  const ices = new Map<string, (c: RemoteCandidate) => void>();
  const offIncoming = vi.fn();
  let incoming: (d: CallDoc) => void = () => {};
  const api: CallApi = {
    start: vi.fn(async () => ({ state: 'ringing' as const })),
    answer: vi.fn(async () => {}),
    active: vi.fn(async () => {}),
    end: vi.fn(async () => {}),
    ice: vi.fn(async () => {}),
    turn: vi.fn(async () => ({ iceServers: [{ urls: 'turn:t' }] })),
    ...apiOver,
  };
  const wire: CallWire = {
    watchCall: (id, cb) => {
      calls.set(id, cb);
      return () => calls.delete(id);
    },
    watchIce: (id, _u, cb) => {
      ices.set(id, cb);
      return () => ices.delete(id);
    },
    watchIncoming: (_u, cb) => {
      incoming = cb;
      return offIncoming;
    },
  };
  const devices: CallDevices = {
    getMedia: vi.fn(async () => stream as unknown as MediaStream),
    createPeer: () => {
      const pc = new FakePc();
      pcs.push(pc);
      return pc as unknown as RTCPeerConnection;
    },
    online: () => true,
    now: () => 1_000,
    ...over,
  };
  const session = new CallSession({ uid: 'me', api, wire, devices });
  let listening = false;
  return {
    session,
    api,
    pcs,
    stream,
    calls,
    ices,
    offIncoming,
    ring: (d: CallDoc) => {
      if (!listening) {
        listening = true;
        session.listen();
      }
      incoming(d);
    },
  };
}

const ID = 'call-id-0123456789ab';
const doc = (p: Partial<CallDoc> = {}): CallDoc => ({
  id: ID,
  callerId: 'peer',
  calleeId: 'me',
  kind: 'video',
  state: 'ringing',
  offer: { type: 'offer', sdp: 'remote-offer' },
  createdAt: 1,
  ...p,
});
const flush = () => vi.advanceTimersByTimeAsync(0);
const answered = (): CallDoc => doc({ state: 'answered', answer: { type: 'answer', sdp: 'ans' } });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('observing the session', () => {
  it('subscribe notifies on change and stops after unsubscribe; streams are exposed', async () => {
    const t = setup();
    const fn = vi.fn();
    const off = t.session.subscribe(fn);
    expect(t.session.getLocalStream()).toBeNull();
    expect(t.session.getRemoteStream()).toBeNull();
    await t.session.dial('peer', 'video', ID);
    expect(fn).toHaveBeenCalled();
    expect(t.session.getLocalStream()).toBe(t.stream);
    expect(t.session.getRemoteStream()).toBeInstanceOf(FakeStream);
    off();
    fn.mockClear();
    t.session.hangup();
    expect(fn).not.toHaveBeenCalled();
  });

  it('an event that changes nothing does not notify', () => {
    const t = setup();
    const fn = vi.fn();
    t.session.subscribe(fn);
    t.session.dismiss();
    t.session.toggleMic();
    expect(fn).not.toHaveBeenCalled();
  });

  it('listen again replaces the previous watch; dispose stops it, closes the peer and silences listeners', async () => {
    const t = setup();
    t.session.listen();
    t.session.listen();
    expect(t.offIncoming).toHaveBeenCalledTimes(1);
    await t.session.dial('peer', 'video', ID);
    const fn = vi.fn();
    t.session.subscribe(fn);
    t.session.dispose();
    expect(t.offIncoming).toHaveBeenCalledTimes(2);
    expect(t.pcs[0].closed).toBe(true);
    expect(t.stream.tracks.every((x) => x.stopped)).toBe(true);
    expect(t.session.getLocalStream()).toBeNull();
    expect(t.session.getRemoteStream()).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('a call torn down while async work is in flight', () => {
  it('media arriving after dispose is stopped and no peer is made', async () => {
    let give: (s: MediaStream) => void = () => {};
    const t = setup({ getMedia: () => new Promise<MediaStream>((r) => (give = r)) });
    const p = t.session.dial('peer', 'video', ID);
    t.session.dispose();
    give(t.stream as unknown as MediaStream);
    await p;
    expect(t.pcs).toHaveLength(0);
    expect(t.api.start).not.toHaveBeenCalled();
  });

  it('dispose while callStart is pending: nothing is watched afterwards', async () => {
    let done: (r: { state: 'ringing' }) => void = () => {};
    const t = setup({}, { start: () => new Promise<{ state: 'ringing' }>((r) => (done = r)) });
    const p = t.session.dial('peer', 'video', ID);
    await flush();
    t.session.dispose();
    done({ state: 'ringing' });
    await p;
    expect(t.api.turn).not.toHaveBeenCalled();
    expect(t.calls.size).toBe(0);
  });

  it('dispose while TURN credentials are pending: nothing is watched afterwards', async () => {
    let done: (r: { iceServers: RTCIceServer[] }) => void = () => {};
    const t = setup(
      {},
      { turn: () => new Promise<{ iceServers: RTCIceServer[] }>((r) => (done = r)) },
    );
    const p = t.session.dial('peer', 'video', ID);
    await flush();
    t.session.dispose();
    done({ iceServers: [] });
    await p;
    expect(t.calls.size).toBe(0);
  });

  it('an error after dispose does not end a call that no longer exists', async () => {
    let fail: (e: Error) => void = () => {};
    const t = setup({}, { start: () => new Promise((_, rej) => (fail = rej)) });
    const fn = vi.fn();
    const p = t.session.dial('peer', 'video', ID);
    await flush();
    t.session.dispose();
    t.session.subscribe(fn);
    fail(new Error('late'));
    await p;
    expect(fn).not.toHaveBeenCalled();
  });

  it('media failing after dispose is ignored', async () => {
    let fail: (e: unknown) => void = () => {};
    const t = setup({ getMedia: () => new Promise<MediaStream>((_, rej) => (fail = rej)) });
    const p = t.session.dial('peer', 'voice', ID);
    t.session.dispose();
    fail({ name: 'NotAllowedError' });
    await p;
    expect(t.session.getState().endReason).not.toBe('permission-denied');
  });
});

describe('incoming edge cases', () => {
  it('answer / decline / hangup do nothing when nothing rings', async () => {
    const t = setup();
    await t.session.answer();
    t.session.decline();
    t.session.hangup();
    expect(t.api.answer).not.toHaveBeenCalled();
    expect(t.api.end).not.toHaveBeenCalled();
    expect(t.session.getState().phase).toBe('idle');
  });

  it('a ring without an offer is ignored', () => {
    const t = setup();
    t.ring(doc({ offer: undefined }));
    expect(t.session.getState().phase).toBe('idle');
  });

  it('hangup while it rings is a decline', () => {
    const t = setup();
    t.ring(doc());
    t.session.hangup();
    expect(t.api.answer).toHaveBeenCalledWith({ callId: ID, accept: false });
    expect(t.api.end).not.toHaveBeenCalled();
    expect(t.session.getState().endReason).toBe('declined');
  });

  it('a bad offer ends the call as failed', async () => {
    const t = setup();
    t.ring(doc());
    const orig = t.session as unknown as { o: { devices: CallDevices } };
    const create = orig.o.devices.createPeer;
    orig.o.devices.createPeer = (c) => {
      const pc = create(c) as unknown as FakePc;
      pc.fail = 'remote';
      return pc as unknown as RTCPeerConnection;
    };
    await t.session.answer();
    expect(t.session.getState().endReason).toBe('failed');
  });

  it('mic denied after teardown does not end anything', async () => {
    let fail: (e: unknown) => void = () => {};
    const t = setup({ getMedia: () => new Promise<MediaStream>((_, rej) => (fail = rej)) });
    t.ring(doc());
    const p = t.session.answer();
    t.session.dispose();
    fail({ name: 'NotAllowedError' });
    await p;
    expect(t.session.getState().endReason).not.toBe('permission-denied');
    expect(t.api.answer).toHaveBeenCalledWith({ callId: ID, accept: false });
  });
});

describe('signalling edge cases', () => {
  async function ringingOut() {
    const t = setup();
    await t.session.dial('peer', 'video', ID);
    return t;
  }

  it('a missing call doc is ignored', async () => {
    const t = await ringingOut();
    t.calls.get(ID)?.(null);
    expect(t.session.getState().phase).toBe('ringing-out');
  });

  it('the answer is applied once: a second answer doc does not touch the peer again', async () => {
    const t = await ringingOut();
    const spy = vi.spyOn(t.pcs[0], 'setRemoteDescription');
    t.calls.get(ID)?.(answered());
    t.calls.get(ID)?.(answered());
    await flush();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('a rejected answer description ends the call as failed', async () => {
    const t = await ringingOut();
    t.pcs[0].fail = 'remote';
    t.calls.get(ID)?.(answered());
    await flush();
    expect(t.session.getState().endReason).toBe('failed');
    expect(t.api.end).toHaveBeenCalledWith(ID, 'failed');
  });

  it('the ring timer of an answered call fires without ending it', async () => {
    const t = await ringingOut();
    t.calls.get(ID)?.(answered());
    await flush();
    await vi.advanceTimersByTimeAsync(RING_MS + 1);
    expect(t.session.getState().phase).not.toBe('ended');
    expect(t.api.end).not.toHaveBeenCalled();
  });

  it('candidates arriving after the peer is gone are only queued', async () => {
    const t = await ringingOut();
    const ice = t.ices.get(ID);
    t.session.hangup();
    ice?.({ id: '1', candidate: { candidate: 'x' } });
    expect(t.pcs[0].added).toEqual([]);
  });

  it('remote tracks are collected from ontrack; an event without streams is harmless', async () => {
    const t = await ringingOut();
    const track = new FakeTrack('audio');
    t.pcs[0].ontrack?.({ streams: [{ getTracks: () => [track] }] });
    expect((t.session.getRemoteStream() as unknown as FakeStream).tracks).toEqual([track]);
    expect(() => t.pcs[0].ontrack?.({ streams: [] })).not.toThrow();
  });

  it('a local candidate is not sent when the call is over; a send error is swallowed', async () => {
    const t = await ringingOut();
    const cand = { toJSON: () => ({ candidate: 'c' }) as RTCIceCandidateInit };
    (t.pcs[0].onicecandidate as unknown as (e: { candidate: typeof cand | null }) => void)({
      candidate: null,
    });
    expect(t.api.ice).not.toHaveBeenCalled();
    vi.mocked(t.api.ice).mockRejectedValueOnce(new Error('x'));
    (t.pcs[0].onicecandidate as unknown as (e: { candidate: typeof cand }) => void)({
      candidate: cand,
    });
    await flush();
    expect(t.api.ice).toHaveBeenCalledWith(ID, { candidate: 'c' });
  });
});

describe('connection edge cases', () => {
  async function connected() {
    const t = setup();
    await t.session.dial('peer', 'video', ID);
    t.calls.get(ID)?.(answered());
    await flush();
    t.pcs[0].setState('connected');
    return t;
  }

  it('connected twice starts one heartbeat only', async () => {
    const t = await connected();
    t.pcs[0].setState('connected');
    expect(t.api.active).toHaveBeenCalledTimes(1);
  });

  it('a failed connection after the call ended changes nothing', async () => {
    const t = await connected();
    t.session.hangup();
    vi.mocked(t.api.end).mockClear();
    t.pcs[0].setState('failed');
    expect(t.api.end).not.toHaveBeenCalled();
  });

  it('a heartbeat error is swallowed', async () => {
    const t = setup({}, { active: vi.fn(async () => Promise.reject(new Error('net'))) });
    await t.session.dial('peer', 'video', ID);
    t.calls.get(ID)?.(answered());
    await flush();
    t.pcs[0].setState('connected');
    await flush();
    expect(t.session.getState().phase).toBe('active');
  });

  it('a lost voice call is not downgraded, it gives up after the limit', async () => {
    const t = setup();
    await t.session.dial('peer', 'voice', ID);
    t.calls.get(ID)?.(answered());
    await flush();
    t.pcs[0].setState('connected');
    t.pcs[0].setState('disconnected');
    await vi.advanceTimersByTimeAsync(GIVE_UP_AFTER_MS - 1);
    expect(t.session.getState().voiceOnly).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(t.session.getState().endReason).toBe('failed');
  });

  it('an API error with an unavailable / deadline code ends as offline; any other as failed', async () => {
    for (const [code, reason] of [
      ['unavailable', 'offline'],
      ['deadline-exceeded', 'offline'],
      ['internal', 'failed'],
    ] as const) {
      const t = setup(
        {},
        {
          start: vi.fn(async () => {
            throw Object.assign(new Error('x'), { code });
          }),
        },
      );
      await t.session.dial('peer', 'voice', ID);
      expect(t.session.getState().endReason).toBe(reason);
    }
  });
});

describe('answer while the call goes away', () => {
  it('does not answer a call that was hung up while the permission prompt was open', async () => {
    let release: (s: MediaStream) => void = () => {};
    const gate = new Promise<MediaStream>((r) => (release = r));
    const t = setup({ getMedia: vi.fn(() => gate) });
    t.ring(doc({ kind: 'voice' }));
    const answering = t.session.answer();
    t.session.hangup();
    release(t.stream as unknown as MediaStream);
    await answering;
    expect(t.api.answer).not.toHaveBeenCalledWith(expect.objectContaining({ accept: true }));
    expect(t.pcs).toHaveLength(0);
    expect(t.stream.tracks.every((x) => x.stopped)).toBe(true);
  });
});
