import { describe, expect, it } from 'vitest';
import {
  callReducer,
  elapsedSeconds,
  IDLE,
  isLive,
  type CallEvent,
  type CallState,
} from './callMachine';

const run = (events: CallEvent[], from: CallState = IDLE) => events.reduce(callReducer, from);
const dial: CallEvent = { type: 'dial', callId: 'c'.repeat(20), peerId: 'u2', kind: 'video' };
const incoming: CallEvent = {
  type: 'incoming',
  callId: 'c'.repeat(20),
  peerId: 'u2',
  kind: 'video',
};

describe('callReducer', () => {
  it('outgoing: dial → remote-answered → connected → end(hangup)', () => {
    const s1 = run([dial]);
    expect(s1).toMatchObject({ phase: 'ringing-out', role: 'caller', camOn: true });
    const s2 = run([{ type: 'remote-answered' }, { type: 'connected', at: 1000 }], s1);
    expect(s2).toMatchObject({ phase: 'active', connectedAt: 1000 });
    expect(run([{ type: 'end', reason: 'hangup' }], s2)).toMatchObject({
      phase: 'ended',
      endReason: 'hangup',
      camOn: false,
    });
  });

  it('incoming: accept → connecting → active; voice-only answer drops the camera', () => {
    const ring = run([incoming]);
    expect(ring.phase).toBe('ringing-in');
    expect(run([{ type: 'accept' }], ring).phase).toBe('connecting');
    expect(run([{ type: 'accept-voice' }], ring)).toMatchObject({
      phase: 'connecting',
      kind: 'voice',
      camOn: false,
      voiceOnly: true,
    });
  });

  it('a second call while live changes nothing (busy is decided by the caller of the machine)', () => {
    const s = run([dial]);
    expect(callReducer(s, incoming)).toBe(s);
    expect(callReducer(s, { ...dial, callId: 'x'.repeat(20) })).toBe(s);
  });

  it('the first end reason wins', () => {
    const s = run([dial, { type: 'end', reason: 'declined' }, { type: 'end', reason: 'failed' }]);
    expect(s.endReason).toBe('declined');
  });

  it('link loss only matters while active; recovery returns to active', () => {
    const active = run([dial, { type: 'remote-answered' }, { type: 'connected', at: 5 }]);
    const lost = callReducer(active, { type: 'link-lost' });
    expect(lost.phase).toBe('reconnecting');
    expect(callReducer(lost, { type: 'link-back' }).phase).toBe('active');
    expect(callReducer(lost, { type: 'connected', at: 99 }).connectedAt).toBe(5);
    expect(callReducer(run([dial]), { type: 'link-lost' }).phase).toBe('ringing-out');
  });

  it('connected is ignored while ringing', () => {
    expect(callReducer(run([dial]), { type: 'connected', at: 1 }).phase).toBe('ringing-out');
  });

  it('mic toggles any time; camera only in a video call that is not voice-only', () => {
    const v = run([{ ...dial, kind: 'voice' }]);
    expect(callReducer(v, { type: 'toggle-cam' }).camOn).toBe(false);
    expect(callReducer(v, { type: 'toggle-mic' }).micOn).toBe(false);
    const video = run([dial]);
    expect(callReducer(video, { type: 'toggle-cam' }).camOn).toBe(false);
    const active = run([dial, { type: 'remote-answered' }, { type: 'connected', at: 1 }]);
    const weak = callReducer(active, { type: 'degrade' });
    expect(weak).toMatchObject({ voiceOnly: true, camOn: false });
    expect(callReducer(weak, { type: 'toggle-cam' }).camOn).toBe(false);
  });

  it('events on an ended or idle call do nothing; reset returns to idle', () => {
    const ended = run([dial, { type: 'end', reason: 'missed' }]);
    expect(isLive(ended)).toBe(false);
    expect(callReducer(ended, { type: 'toggle-mic' })).toBe(ended);
    expect(callReducer(IDLE, { type: 'accept' })).toBe(IDLE);
    expect(callReducer(ended, { type: 'reset' })).toBe(IDLE);
  });

  it('elapsedSeconds', () => {
    expect(elapsedSeconds(IDLE, 10_000)).toBe(0);
    expect(elapsedSeconds({ ...IDLE, connectedAt: 1000 }, 62_500)).toBe(61);
    expect(elapsedSeconds({ ...IDLE, connectedAt: 5000 }, 1000)).toBe(0);
  });
});

describe('degrade', () => {
  const active = (kind: 'voice' | 'video') =>
    run([
      { type: 'dial', callId: 'c'.repeat(20), peerId: 'u2', kind },
      { type: 'remote-answered' },
      { type: 'connected', at: 1 },
    ]);
  it('a video call drops to voice only, camera off', () => {
    expect(run([{ type: 'degrade' }], active('video'))).toMatchObject({
      voiceOnly: true,
      camOn: false,
    });
  });
  it('a voice call, or one that is not connected, is left as it is', () => {
    const v = active('voice');
    expect(run([{ type: 'degrade' }], v)).toBe(v);
    const ringing = run([dial]);
    expect(run([{ type: 'degrade' }], ringing)).toBe(ringing);
  });
});
