import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEGRADE_AFTER_MS, CallSession, GIVE_UP_AFTER_MS } from './callSession';
import { HEARTBEAT_MS, RING_MS } from './callMachine';
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
  remoteSet: unknown = null;
  added: unknown[] = [];
  config: RTCConfiguration | null = null;
  ontrack: unknown;
  onicecandidate:
    ((e: { candidate: { toJSON: () => RTCIceCandidateInit } | null }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  constructor(public initial: RTCConfiguration) {}
  addTrack() {}
  async createOffer() {
    return { type: 'offer', sdp: 'offer-sdp' };
  }
  async createAnswer() {
    return { type: 'answer', sdp: 'answer-sdp' };
  }
  async setLocalDescription() {}
  async setRemoteDescription(d: unknown) {
    this.remoteSet = d;
  }
  async addIceCandidate(c: unknown) {
    this.added.push(c);
  }
  setConfiguration(c: RTCConfiguration) {
    this.config = c;
  }
  close() {
    this.closed = true;
  }
  setState(s: string) {
    this.connectionState = s;
    this.onconnectionstatechange?.();
  }
}

function setup(over: Partial<CallDevices> = {}) {
  const pcs: FakePc[] = [];
  const stream = new FakeStream();
  stream.tracks = [new FakeTrack('audio'), new FakeTrack('video')];
  const calls = new Map<string, (d: CallDoc | null) => void>();
  const ices = new Map<string, (c: RemoteCandidate) => void>();
  let incoming: (d: CallDoc) => void = () => {};
  const api: CallApi = {
    start: vi.fn(async () => ({ state: 'ringing' as const })),
    answer: vi.fn(async () => {}),
    active: vi.fn(async () => {}),
    end: vi.fn(async () => {}),
    ice: vi.fn(async () => {}),
    turn: vi.fn(async () => ({
      iceServers: [{ urls: ['turn:t.example:3478'], username: 'u', credential: 'c' }],
    })),
  };
  const wire: CallWire = {
    watchCall: (id, cb) => {
      calls.set(id, cb);
      return () => calls.delete(id);
    },
    watchIce: (id, _uid, cb) => {
      ices.set(id, cb);
      return () => ices.delete(id);
    },
    watchIncoming: (_uid, cb) => {
      incoming = cb;
      return () => {};
    },
  };
  const devices: CallDevices = {
    getMedia: vi.fn(async () => stream as unknown as MediaStream),
    createPeer: (cfg) => {
      const pc = new FakePc(cfg);
      pcs.push(pc);
      return pc as unknown as RTCPeerConnection;
    },
    online: () => true,
    now: () => 1_000,
    ...over,
  };
  const session = new CallSession({ uid: 'me', api, wire, devices });
  return { session, api, devices, pcs, stream, calls, ices, ring: (d: CallDoc) => incoming(d) };
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

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('outgoing call', () => {
  it('offer → callStart → TURN → relay policy → answer → connected → heartbeat → hangup', async () => {
    const t = setup();
    await t.session.dial('peer', 'video', ID);
    expect(t.api.start).toHaveBeenCalledWith(
      expect.objectContaining({ callId: ID, peerId: 'peer', kind: 'video', relayOnly: false }),
    );
    expect(t.api.turn).toHaveBeenCalledWith(ID);
    expect(t.pcs[0].config?.iceTransportPolicy).toBe('relay');
    expect(t.session.getState().phase).toBe('ringing-out');

    t.calls.get(ID)?.(
      doc({
        callerId: 'me',
        calleeId: 'peer',
        state: 'answered',
        answer: { type: 'answer', sdp: 'a' },
      }),
    );
    await flush();
    expect(t.pcs[0].remoteSet).toEqual({ type: 'answer', sdp: 'a' });
    expect(t.session.getState().phase).toBe('connecting');

    t.pcs[0].setState('connected');
    expect(t.session.getState()).toMatchObject({ phase: 'active', connectedAt: 1_000 });
    expect(t.api.active).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    expect(t.api.active).toHaveBeenCalledTimes(2);

    t.session.hangup();
    expect(t.api.end).toHaveBeenCalledWith(ID, 'hangup');
    expect(t.session.getState()).toMatchObject({ phase: 'ended', endReason: 'hangup' });
    expect(t.pcs[0].closed).toBe(true);
    expect(t.stream.tracks.every((x) => x.stopped)).toBe(true);
  });

  it('falls back to all-candidates when TURN is not available (STUN only)', async () => {
    const t = setup();
    vi.mocked(t.api.turn).mockRejectedValueOnce(new Error('nope'));
    await t.session.dial('peer', 'voice', ID);
    expect(t.pcs[0].config?.iceTransportPolicy).toBe('all');
    expect(t.session.getState().phase).toBe('ringing-out');
  });

  it('server says unavailable / busy: ends with that reason, no peer left open', async () => {
    const t = setup();
    vi.mocked(t.api.start).mockResolvedValueOnce({ state: 'ended', endReason: 'unavailable' });
    await t.session.dial('peer', 'voice', ID);
    expect(t.session.getState()).toMatchObject({ phase: 'ended', endReason: 'unavailable' });
    expect(t.pcs[0].closed).toBe(true);
  });

  it('offline: ends at once and never touches the server or the microphone', async () => {
    const t = setup({ online: () => false });
    await t.session.dial('peer', 'voice', ID);
    expect(t.session.getState().endReason).toBe('offline');
    expect(t.api.start).not.toHaveBeenCalled();
    expect(t.devices.getMedia).not.toHaveBeenCalled();
  });

  it.each([
    ['NotAllowedError', 'permission-denied'],
    ['NotFoundError', 'no-device'],
  ])('microphone error %s → %s, no server call', async (name, reason) => {
    const err = Object.assign(new Error('x'), { name });
    const t = setup({ getMedia: vi.fn().mockRejectedValue(err) });
    await t.session.dial('peer', 'video', ID);
    expect(t.session.getState().endReason).toBe(reason);
    expect(t.api.start).not.toHaveBeenCalled();
  });

  it('calls-disabled flag maps to the disabled reason', async () => {
    const t = setup();
    vi.mocked(t.api.start).mockRejectedValueOnce(
      Object.assign(new Error('x'), { code: 'failed-precondition', reason: 'calls-disabled' }),
    );
    await t.session.dial('peer', 'voice', ID);
    expect(t.session.getState().endReason).toBe('disabled');
  });

  it('the server refuses with failed-precondition / already-in-call: the end reason is busy, not disabled', async () => {
    const t = setup();
    vi.mocked(t.api.start).mockRejectedValueOnce(
      Object.assign(new Error('x'), { code: 'failed-precondition', reason: 'already-in-call' }),
    );
    await t.session.dial('peer', 'voice', ID);
    expect(t.session.getState().endReason).toBe('busy');
  });

  it('no answer in 45 s: caller ends it as missed on the server', async () => {
    const t = setup();
    await t.session.dial('peer', 'voice', ID);
    await vi.advanceTimersByTimeAsync(RING_MS);
    expect(t.api.end).toHaveBeenCalledWith(ID, 'missed');
    expect(t.session.getState().endReason).toBe('missed');
  });

  it('the other side declines (server doc ended)', async () => {
    const t = setup();
    await t.session.dial('peer', 'voice', ID);
    t.calls.get(ID)?.(doc({ state: 'ended', endReason: 'declined' }));
    expect(t.session.getState().endReason).toBe('declined');
  });

  it('remote candidates wait for the answer, then are added', async () => {
    const t = setup();
    await t.session.dial('peer', 'voice', ID);
    t.ices.get(ID)?.({ id: '1', candidate: { candidate: 'c1' } });
    expect(t.pcs[0].added).toEqual([]);
    t.calls.get(ID)?.(doc({ state: 'answered', answer: { type: 'answer', sdp: 'a' } }));
    await flush();
    expect(t.pcs[0].added).toEqual([{ candidate: 'c1' }]);
    t.ices.get(ID)?.({ id: '2', candidate: { candidate: 'c2' } });
    expect(t.pcs[0].added).toHaveLength(2);
  });

  it('sends our own candidates through the server', async () => {
    const t = setup();
    await t.session.dial('peer', 'voice', ID);
    t.pcs[0].onicecandidate?.({ candidate: { toJSON: () => ({ candidate: 'mine' }) } });
    expect(t.api.ice).toHaveBeenCalledWith(ID, { candidate: 'mine' });
  });
});

describe('incoming call', () => {
  it('ring → answer: TURN, remote offer, answer sent to the server', async () => {
    const t = setup();
    t.session.listen();
    t.ring(doc());
    expect(t.session.getState()).toMatchObject({
      phase: 'ringing-in',
      peerId: 'peer',
      role: 'callee',
    });
    await t.session.answer();
    expect(t.pcs[0].remoteSet).toEqual({ type: 'offer', sdp: 'remote-offer' });
    expect(t.api.answer).toHaveBeenCalledWith({
      callId: ID,
      accept: true,
      answer: { type: 'answer', sdp: 'answer-sdp' },
    });
    t.pcs[0].setState('connected');
    expect(t.session.getState().phase).toBe('active');
  });

  it('"voice only" answers without the camera', async () => {
    const t = setup();
    t.session.listen();
    t.ring(doc());
    await t.session.answer({ voiceOnly: true });
    expect(t.devices.getMedia).toHaveBeenCalledWith('voice');
    expect(t.session.getState()).toMatchObject({ kind: 'voice', voiceOnly: true });
  });

  it('decline tells the server and ends', () => {
    const t = setup();
    t.session.listen();
    t.ring(doc());
    t.session.decline();
    expect(t.api.answer).toHaveBeenCalledWith({ callId: ID, accept: false });
    expect(t.session.getState().endReason).toBe('declined');
  });

  it('the caller cancels while it rings: we show missed', () => {
    const t = setup();
    t.session.listen();
    t.ring(doc());
    t.calls.get(ID)?.(doc({ state: 'ended', endReason: 'missed' }));
    expect(t.session.getState().endReason).toBe('missed');
  });

  it('ignores a second incoming call while one is live, and stale docs', async () => {
    const t = setup();
    t.session.listen();
    t.ring(doc());
    t.ring(doc({ id: 'other-call-0123456789' }));
    expect(t.session.getState().callId).toBe(ID);
    t.session.decline();
    t.session.dismiss();
    t.ring(doc({ id: 'x-call-0123456789abcd', state: 'ended' }));
    expect(t.session.getState().phase).toBe('idle');
  });

  it('a ring nobody answers dismisses itself after 45 s without a server call', async () => {
    const t = setup();
    t.session.listen();
    t.ring(doc());
    await vi.advanceTimersByTimeAsync(RING_MS);
    expect(t.session.getState().endReason).toBe('missed');
    expect(t.api.end).not.toHaveBeenCalled();
  });

  it('answering with the mic denied declines on the server', async () => {
    const err = Object.assign(new Error('x'), { name: 'NotAllowedError' });
    const t = setup({ getMedia: vi.fn().mockRejectedValue(err) });
    t.session.listen();
    t.ring(doc());
    await t.session.answer();
    expect(t.api.answer).toHaveBeenCalledWith({ callId: ID, accept: false });
    expect(t.session.getState().endReason).toBe('permission-denied');
  });
});

describe('link quality and controls', () => {
  async function active() {
    const t = setup();
    await t.session.dial('peer', 'video', ID);
    t.calls.get(ID)?.(doc({ state: 'answered', answer: { type: 'answer', sdp: 'a' } }));
    await flush();
    t.pcs[0].setState('connected');
    return t;
  }

  it('a short drop recovers by itself', async () => {
    const t = await active();
    t.pcs[0].setState('disconnected');
    expect(t.session.getState().phase).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(2000);
    t.pcs[0].setState('connected');
    expect(t.session.getState().phase).toBe('active');
    await vi.advanceTimersByTimeAsync(GIVE_UP_AFTER_MS);
    expect(t.session.getState().phase).toBe('active');
  });

  it('a long drop on video falls back to voice, then gives up', async () => {
    const t = await active();
    t.pcs[0].setState('disconnected');
    await vi.advanceTimersByTimeAsync(DEGRADE_AFTER_MS);
    expect(t.session.getState().voiceOnly).toBe(true);
    await vi.advanceTimersByTimeAsync(GIVE_UP_AFTER_MS - DEGRADE_AFTER_MS);
    expect(t.session.getState()).toMatchObject({ phase: 'ended', endReason: 'failed' });
    expect(t.api.end).toHaveBeenCalledWith(ID, 'failed');
  });

  it('a failed connection ends the call at once', async () => {
    const t = await active();
    t.pcs[0].setState('failed');
    expect(t.session.getState().endReason).toBe('failed');
  });

  it('mute and camera switch the real tracks', async () => {
    const t = await active();
    t.session.toggleMic();
    expect(t.stream.getAudioTracks()[0].enabled).toBe(false);
    t.session.toggleCam();
    expect(t.stream.getVideoTracks()[0].enabled).toBe(false);
    t.session.toggleCam();
    expect(t.stream.getVideoTracks()[0].enabled).toBe(true);
  });

  it('a second dial while live is ignored', async () => {
    const t = await active();
    await t.session.dial('other', 'voice', 'second-call-0123456789');
    expect(t.api.start).toHaveBeenCalledTimes(1);
  });
});
