/**
 * Trainer <-> client calls, server core (SPO-22 / SPO-440), on the in-memory Kv with fake ports: no Firebase, no network.
 * Contract: docs/specs/SPO-22-calls-contract.md.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryKv, type MemoryKv } from '../../functions/src/coach/memoryKv';
import {
  ANSWERED_MAX_MS,
  CALL_MAX_MS,
  HEARTBEAT_STALE_MS,
  ICE_PER_CALL_MAX,
  ICE_PER_PARTICIPANT_MAX,
  TURN_PER_CALL_PER_HOUR,
  UNAVAILABLE_PER_PAIR_PER_HOUR,
  isRelayCandidate,
  ICE_TTL_MS,
  RING_GRACE_MS,
  RING_MS,
  STARTS_PER_HOUR,
  STUN_ONLY,
  activePair,
  anyDeviceRings,
  callActive,
  callAnswer,
  callEnd,
  callIce,
  callStart,
  callTurn,
  cleanIceServers,
  cloudflareIceServers,
  iceOf,
  type CallPorts,
} from '../../functions/src/callsCore';

const T0 = Date.UTC(2026, 10, 3, 12, 0, 0);
const ID = 'call-aaaaaaaaaaaa1';
const ID2 = 'call-bbbbbbbbbbbb2';
const sdp = (type: 'offer' | 'answer') => ({ type, sdp: 'v=0\r\no=- 1 1 IN IP4 0.0.0.0\r\n' });
const T = { uid: 't1', role: 'trainer' };
const C = { uid: 'c1', role: 'member' };

let kv: MemoryKv;
let now: number;
let reachable: boolean;
const pushed: string[] = [];
let n = 0;
const ports = (): CallPorts => ({
  now: () => now,
  newId: () => `ice${++n}`,
  calleeReachable: async () => reachable,
  pushIncoming: async (u) => void pushed.push(u),
  iceServers: async () => STUN_ONLY,
});
const start = (a = T, over: Record<string, unknown> = {}) =>
  callStart(kv, ports(), a, {
    callId: ID,
    peerId: a.uid === 't1' ? 'c1' : 't1',
    kind: 'video',
    offer: sdp('offer'),
    ...over,
  });
const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    const x = e as { code?: string; message?: string };
    return `${x.code}:${x.message}`;
  }
  return 'ok';
};
type Stored = { state: string; answer?: unknown; expiresAt: Date; endReason?: string };
const doc = async (id = ID) => (await kv.get(`calls/${id}`)) as unknown as Stored;

beforeEach(async () => {
  kv = createMemoryKv();
  now = T0;
  reachable = true;
  pushed.length = 0;
  n = 0;
  await kv.set('users/t1', { role: 'trainer', status: 'active' });
  await kv.set('users/t2', { role: 'trainer', status: 'active' });
  await kv.set('users/c1', { role: 'member', status: 'active' });
  await kv.set('users/c2', { role: 'member', status: 'active' });
  await kv.set('users/a1', { role: 'admin', status: 'active' });
  await kv.set('users/m1', { role: 'manager', status: 'active' });
  await kv.set('coaching/c1', { trainerId: 't1', status: 'active' });
  await kv.set('coaching/c2', { trainerId: 't2', status: 'active' });
});

describe('the pair rule', () => {
  it('trainer rings client and client rings trainer, only inside an active pair', async () => {
    expect(await activePair(kv, T, 'c1')).toBe('c1');
    expect(await activePair(kv, C, 't1')).toBe('c1');
    expect(await activePair(kv, T, 'c2')).toBeNull(); // another trainer's client
    expect(await activePair(kv, C, 't2')).toBeNull(); // not my trainer
    expect(await activePair(kv, C, 'c2')).toBeNull(); // client to client
    expect(await activePair(kv, T, 't2')).toBeNull(); // trainer to trainer
    expect(await activePair(kv, T, 't1')).toBeNull(); // yourself
  });
  it('an admin rings their own client; a member cannot pose as a trainer by role', async () => {
    await kv.set('coaching/c2', { trainerId: 'a1', status: 'active' });
    expect(await activePair(kv, { uid: 'a1', role: 'admin' }, 'c2')).toBe('c2');
    expect(await activePair(kv, { uid: 'c1', role: 'trainer' }, 'c2')).toBeNull();
  });
  it('an ended or pending relationship allows nothing', async () => {
    await kv.set('coaching/c1', { trainerId: 't1', status: 'ended' });
    expect(await activePair(kv, T, 'c1')).toBeNull();
    expect(await activePair(kv, C, 't1')).toBeNull();
  });
});

describe('callStart', () => {
  it('creates a ringing call with the contract fields, a Date expiresAt, and rings the callee', async () => {
    expect(await start()).toEqual({ state: 'ringing' });
    const d = await doc();
    expect(d).toMatchObject({
      callerId: 't1',
      calleeId: 'c1',
      clientId: 'c1',
      kind: 'video',
      state: 'ringing',
      createdAt: T0,
    });
    expect(d.offer).toEqual(sdp('offer'));
    expect(d.expiresAt).toBeInstanceOf(Date);
    expect(d.expiresAt.getTime()).toBeGreaterThan(T0);
    expect(pushed).toEqual(['c1']);
  });
  it('the client can ring the trainer too (clientId is still the client)', async () => {
    await start(C);
    expect(await doc()).toMatchObject({ callerId: 'c1', calleeId: 't1', clientId: 'c1' });
  });
  it('is idempotent: the same callId from the same caller is a no-op and does not ring or count twice', async () => {
    await start();
    expect(await start()).toEqual({ state: 'ringing' });
    expect(pushed).toHaveLength(1);
    expect((await kv.list('calls')).length).toBe(1);
  });
  it('refuses a callId somebody else started', async () => {
    await start();
    expect(await code(start(C))).toBe('permission-denied:call-id-taken');
  });
  it('refuses a stranger, another trainer, a manager, a suspended peer', async () => {
    expect(await code(start(T, { peerId: 'c2' }))).toBe('permission-denied:no-active-coaching');
    expect(await code(start({ uid: 'm1', role: 'manager' }, { peerId: 'c1' }))).toBe(
      'permission-denied:not-allowed',
    );
    await kv.set('coaching/c1', { trainerId: 'm1', status: 'active' }); // a manager as "trainer" is not a pair either
    expect(await code(start(C, { peerId: 'm1' }))).toBe('permission-denied:no-active-coaching');
    await kv.set('coaching/c1', { trainerId: 't1', status: 'active' });
    await kv.set('users/c1', { role: 'member', status: 'suspended' });
    expect(await code(start(T))).toBe('permission-denied:no-active-coaching');
    expect(await kv.list('calls')).toEqual([]);
    expect(pushed).toEqual([]);
  });
  it('refuses an ended relationship', async () => {
    await kv.set('coaching/c1', { trainerId: 't1', status: 'ended' });
    expect(await code(start())).toBe('permission-denied:no-active-coaching');
  });
  it('validates input: ids, kind, offer, unknown keys', async () => {
    const bad = async (over: Record<string, unknown>) => code(start(T, over));
    expect(await bad({ callId: 'short' })).toBe('invalid-argument:bad-call-id');
    expect(await bad({ callId: 'a/b/aaaaaaaaaaaaaaaa' })).toBe('invalid-argument:bad-call-id');
    expect(await bad({ peerId: 'a/b' })).toBe('invalid-argument:bad-peer');
    expect(await bad({ kind: 'screen' })).toBe('invalid-argument:bad-kind');
    expect(await bad({ offer: { type: 'answer', sdp: sdp('offer').sdp } })).toBe(
      'invalid-argument:bad-sdp',
    );
    expect(await bad({ offer: { type: 'offer', sdp: 'x'.repeat(40_000) } })).toBe(
      'invalid-argument:bad-sdp',
    );
    expect(await bad({ extra: 1 })).toBe('invalid-argument:bad-input');
    expect(await code(callStart(kv, ports(), T, null))).toBe('invalid-argument:bad-input');
  });
  it('quiet hours: ended/unavailable, no document, no push, nothing that tells why', async () => {
    reachable = false;
    expect(await start()).toEqual({ state: 'ended', endReason: 'unavailable' });
    expect(await kv.list('calls')).toEqual([]);
    expect(pushed).toEqual([]);
  });
  it('busy: the callee is in another live call; nothing is written and nobody is rung', async () => {
    await kv.set('coaching/c2', { trainerId: 't1', status: 'active' });
    await start(T); // t1 rings c1
    expect(await start({ uid: 'c2', role: 'member' }, { callId: ID2, peerId: 't1' })).toEqual({
      state: 'ended',
      endReason: 'busy',
    });
    expect((await kv.list('calls')).map((r) => r.id)).toEqual([ID]);
    expect(pushed).toEqual(['c1']);
  });
  it('already-in-call: the caller still has a live call', async () => {
    await start(T);
    await kv.set('coaching/c2', { trainerId: 't1', status: 'active' });
    expect(await code(start(T, { callId: ID2, peerId: 'c2' }))).toBe(
      'failed-precondition:already-in-call',
    );
  });
  it('a stale call stops blocking: ringing past the window, answered but never active, active past the cap', async () => {
    await start(T);
    now = T0 + RING_MS + RING_GRACE_MS + 1;
    expect(await start(T, { callId: ID2 })).toEqual({ state: 'ringing' });
    await kv.merge(`calls/${ID2}`, { state: 'answered', answeredAt: now });
    now += ANSWERED_MAX_MS + 1;
    expect(await start(T, { callId: 'call-cccccccccccc3' })).toEqual({ state: 'ringing' });
    await kv.merge('calls/call-cccccccccccc3', { state: 'active', lastSeenAt: now });
    now += HEARTBEAT_STALE_MS + 1; // nobody sent callActive for too long
    expect(await start(T, { callId: 'call-dddddddddddd4' })).toEqual({ state: 'ringing' });
    await kv.merge('calls/call-dddddddddddd4', { state: 'active', lastSeenAt: now });
    now += CALL_MAX_MS + 1; // even a call with a fresh heartbeat has a hard cap
    await kv.merge('calls/call-dddddddddddd4', { lastSeenAt: now });
    expect(await start(T, { callId: 'call-eeeeeeeeeeee5' })).toEqual({ state: 'ringing' });
  });
  it('an ended call never blocks', async () => {
    await start(T);
    await callEnd(kv, ports(), T, { callId: ID, reason: 'hangup' });
    expect(await start(T, { callId: ID2 })).toEqual({ state: 'ringing' });
  });
  it('rate limit: STARTS_PER_HOUR attempts per hour, then resource-exhausted; the next hour is free', async () => {
    for (let i = 0; i < STARTS_PER_HOUR; i++) {
      const id = `call-${String(i).padStart(12, '0')}x`;
      await start(T, { callId: id });
      await callEnd(kv, ports(), T, { callId: id, reason: 'hangup' });
    }
    expect(await code(start(T, { callId: ID2 }))).toBe('resource-exhausted:too-many-calls');
    now += 3_600_000;
    expect(await start(T, { callId: ID2 })).toEqual({ state: 'ringing' });
  });
  it('a failed push never fails the call', async () => {
    const p = { ...ports(), pushIncoming: vi.fn().mockRejectedValue(new Error('fcm down')) };
    expect(
      await callStart(kv, p, T, { callId: ID, peerId: 'c1', kind: 'voice', offer: sdp('offer') }),
    ).toEqual({
      state: 'ringing',
    });
  });
});

describe('callAnswer', () => {
  beforeEach(async () => void (await start()));
  it('accept stores the answer and moves to answered; a repeat is a no-op', async () => {
    expect(
      await callAnswer(kv, ports(), C, { callId: ID, accept: true, answer: sdp('answer') }),
    ).toEqual({
      state: 'answered',
    });
    expect(await doc()).toMatchObject({ state: 'answered', answeredAt: T0, answer: sdp('answer') });
    expect(
      await callAnswer(kv, ports(), C, { callId: ID, accept: true, answer: sdp('answer') }),
    ).toEqual({
      state: 'answered',
    });
  });
  it('decline ends it as declined and drops the ICE', async () => {
    await callIce(kv, ports(), T, {
      callId: ID,
      candidate: { candidate: 'candidate:1 1 udp 1 1.2.3.4 5 typ host' },
    });
    expect(await callAnswer(kv, ports(), C, { callId: ID, accept: false })).toEqual({
      state: 'ended',
      endReason: 'declined',
    });
    expect(await doc()).toMatchObject({ state: 'ended', endReason: 'declined', endedAt: T0 });
    expect(await kv.list(`calls/${ID}/ice`)).toEqual([]);
  });
  it('only the callee answers; strangers get the same answer as for an unknown call', async () => {
    expect(await code(callAnswer(kv, ports(), T, { callId: ID, accept: false }))).toBe(
      'permission-denied:only-callee',
    );
    expect(
      await code(
        callAnswer(kv, ports(), { uid: 'c2', role: 'member' }, { callId: ID, accept: false }),
      ),
    ).toBe('permission-denied:not-a-participant');
    expect(await code(callAnswer(kv, ports(), C, { callId: ID2, accept: false }))).toBe(
      'permission-denied:not-a-participant',
    );
  });
  it('accept needs a valid answer SDP; accept must be boolean', async () => {
    expect(await code(callAnswer(kv, ports(), C, { callId: ID, accept: true }))).toBe(
      'invalid-argument:bad-sdp',
    );
    expect(
      await code(callAnswer(kv, ports(), C, { callId: ID, accept: true, answer: sdp('offer') })),
    ).toBe('invalid-argument:bad-sdp');
    expect(await code(callAnswer(kv, ports(), C, { callId: ID, accept: 'yes' }))).toBe(
      'invalid-argument:bad-input',
    );
  });
  it('after the ring window the call is missed, not answered', async () => {
    now = T0 + RING_MS + RING_GRACE_MS;
    expect(
      await callAnswer(kv, ports(), C, { callId: ID, accept: true, answer: sdp('answer') }),
    ).toEqual({
      state: 'ended',
      endReason: 'missed',
    });
    expect((await doc()).answer).toBeUndefined();
  });
  it('answering an ended call returns its end, it never revives it', async () => {
    await callEnd(kv, ports(), T, { callId: ID, reason: 'hangup' });
    expect(
      await callAnswer(kv, ports(), C, { callId: ID, accept: true, answer: sdp('answer') }),
    ).toEqual({
      state: 'ended',
      endReason: 'hangup',
    });
  });
  it('if the coaching ended while it rang, accepting ends it as unavailable', async () => {
    await kv.set('coaching/c1', { trainerId: 't1', status: 'ended' });
    expect(
      await callAnswer(kv, ports(), C, { callId: ID, accept: true, answer: sdp('answer') }),
    ).toEqual({
      state: 'ended',
      endReason: 'unavailable',
    });
  });
});

describe('callActive', () => {
  it('answered -> active by either participant; idempotent; not before the answer', async () => {
    await start();
    expect(await code(callActive(kv, ports(), T, { callId: ID }))).toBe(
      'failed-precondition:not-answered',
    );
    await callAnswer(kv, ports(), C, { callId: ID, accept: true, answer: sdp('answer') });
    expect(await callActive(kv, ports(), T, { callId: ID })).toEqual({ state: 'active' });
    expect(await callActive(kv, ports(), C, { callId: ID })).toEqual({ state: 'active' });
    expect(await code(callActive(kv, ports(), { uid: 'c2', role: 'member' }, { callId: ID }))).toBe(
      'permission-denied:not-a-participant',
    );
  });
});

describe('callEnd', () => {
  beforeEach(async () => void (await start()));
  it('either side hangs up; the first reason stands; ICE is dropped', async () => {
    await callIce(kv, ports(), T, { callId: ID, candidate: { candidate: 'c' } });
    expect(await callEnd(kv, ports(), C, { callId: ID, reason: 'hangup' })).toEqual({
      state: 'ended',
      endReason: 'hangup',
    });
    expect(await callEnd(kv, ports(), T, { callId: ID, reason: 'failed' })).toEqual({
      state: 'ended',
      endReason: 'hangup',
    });
    expect(await doc()).toMatchObject({ endReason: 'hangup', endedAt: T0 });
    expect(await kv.list(`calls/${ID}/ice`)).toEqual([]);
  });
  it('the caller reports missed only while ringing; declined is the callee only; busy/unavailable are server-only', async () => {
    expect(await code(callEnd(kv, ports(), C, { callId: ID, reason: 'missed' }))).toBe(
      'failed-precondition:bad-reason',
    );
    expect(await code(callEnd(kv, ports(), T, { callId: ID, reason: 'declined' }))).toBe(
      'failed-precondition:bad-reason',
    );
    expect(await code(callEnd(kv, ports(), T, { callId: ID, reason: 'busy' }))).toBe(
      'invalid-argument:bad-reason',
    );
    expect(await code(callEnd(kv, ports(), T, { callId: ID, reason: 'unavailable' }))).toBe(
      'invalid-argument:bad-reason',
    );
    expect(await code(callEnd(kv, ports(), T, { callId: ID, reason: 'x' }))).toBe(
      'invalid-argument:bad-reason',
    );
    expect(await callEnd(kv, ports(), T, { callId: ID, reason: 'missed' })).toEqual({
      state: 'ended',
      endReason: 'missed',
    });
  });
  it('a stranger cannot end it', async () => {
    expect(
      await code(
        callEnd(kv, ports(), { uid: 'c2', role: 'member' }, { callId: ID, reason: 'hangup' }),
      ),
    ).toBe('permission-denied:not-a-participant');
    expect((await doc()).state).toBe('ringing');
  });
  it('expiresAt is moved to the finished-call TTL', async () => {
    await callEnd(kv, ports(), T, { callId: ID, reason: 'hangup' });
    expect((await doc()).expiresAt.getTime()).toBeGreaterThanOrEqual(T0 + 3_600_000);
  });
});

describe('callIce', () => {
  beforeEach(async () => void (await start()));
  const cand = {
    candidate: 'candidate:1 1 udp 2122 192.0.2.1 5000 typ host',
    sdpMid: '0',
    sdpMLineIndex: 0,
  };
  it('stores a trimmed candidate from the sender with a 10 minute expiry', async () => {
    expect(
      await callIce(kv, ports(), T, { callId: ID, candidate: { ...cand, evil: 'x' } }),
    ).toEqual({ ok: true });
    const [r] = await kv.list(`calls/${ID}/ice`);
    expect(r.data).toMatchObject({
      from: 't1',
      createdAt: T0,
      candidate: { ...cand, usernameFragment: null },
    });
    expect(r.data.candidate).not.toHaveProperty('evil');
    expect((r.data.expiresAt as Date).getTime()).toBe(T0 + ICE_TTL_MS);
  });
  it('only participants, never after the end, malformed candidates refused, count capped', async () => {
    expect(
      await code(
        callIce(kv, ports(), { uid: 'c2', role: 'member' }, { callId: ID, candidate: cand }),
      ),
    ).toBe('permission-denied:not-a-participant');
    expect(await code(callIce(kv, ports(), T, { callId: ID, candidate: 'nope' }))).toBe(
      'invalid-argument:bad-candidate',
    );
    expect(
      await code(
        callIce(kv, ports(), T, { callId: ID, candidate: { candidate: 'x'.repeat(2000) } }),
      ),
    ).toBe('invalid-argument:bad-candidate');
    expect(
      await code(
        callIce(kv, ports(), T, { callId: ID, candidate: { candidate: 'a', sdpMLineIndex: -1 } }),
      ),
    ).toBe('invalid-argument:bad-candidate');
    for (let i = 0; i < ICE_PER_CALL_MAX / 2; i++) {
      await kv.set(`calls/${ID}/ice/x${i}`, { from: 't1' });
      await kv.set(`calls/${ID}/ice/y${i}`, { from: 'c1' });
    }
    expect(await code(callIce(kv, ports(), T, { callId: ID, candidate: cand }))).toBe(
      'resource-exhausted:too-many-candidates',
    );
    await callEnd(kv, ports(), T, { callId: ID, reason: 'hangup' });
    expect(await code(callIce(kv, ports(), T, { callId: ID, candidate: cand }))).toBe(
      'failed-precondition:call-ended',
    );
  });
  it('iceOf accepts end-of-candidates (empty string) and null fields', () => {
    expect(iceOf({ candidate: '', sdpMid: null, sdpMLineIndex: null })).toEqual({
      candidate: '',
      sdpMid: null,
      sdpMLineIndex: null,
      usernameFragment: null,
    });
  });
});

describe('callTurn and the Cloudflare provider', () => {
  it('a participant of a live call gets ICE servers; a stranger or an ended call does not', async () => {
    await start();
    expect(await callTurn(kv, ports(), C, { callId: ID })).toEqual({ iceServers: STUN_ONLY });
    expect(await code(callTurn(kv, ports(), { uid: 'c2', role: 'member' }, { callId: ID }))).toBe(
      'permission-denied:not-a-participant',
    );
    await callEnd(kv, ports(), T, { callId: ID, reason: 'hangup' });
    expect(await code(callTurn(kv, ports(), C, { callId: ID }))).toBe(
      'failed-precondition:call-ended',
    );
  });
  it('without a key or token: STUN only on stun.cloudflare.com, never Google, and no network call', async () => {
    const fetch = vi.fn();
    expect(await cloudflareIceServers(null)).toEqual(STUN_ONLY);
    expect(await cloudflareIceServers({ keyId: 'k', token: '', fetch })).toEqual(STUN_ONLY);
    expect(fetch).not.toHaveBeenCalled();
    expect(JSON.stringify(STUN_ONLY)).toContain('stun.cloudflare.com:3478');
    expect(JSON.stringify(STUN_ONLY)).not.toContain('google');
  });
  it('with a token: calls the credentials endpoint with a bearer token and a short ttl, keeps only well-formed servers', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        iceServers: [
          {
            urls: ['stun:stun.cloudflare.com:3478', 'turn:turn.cloudflare.com:3478?transport=udp'],
            username: 'u',
            credential: 'p',
            extra: 1,
          },
          { urls: ['http://evil'] },
          'junk',
        ],
      }),
    });
    const out = await cloudflareIceServers({ keyId: 'key id', token: 'tok', fetch });
    expect(out).toEqual([
      {
        urls: ['stun:stun.cloudflare.com:3478', 'turn:turn.cloudflare.com:3478?transport=udp'],
        username: 'u',
        credential: 'p',
      },
    ]);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(
      'https://rtc.live.cloudflare.com/v1/turn/keys/key%20id/credentials/generate-ice-servers',
    );
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toEqual({ ttl: 3600 }); // no user data goes to the provider
  });
  it('any provider failure or empty answer falls back to STUN only', async () => {
    const mk = (f: unknown) => ({ keyId: 'k', token: 't', fetch: f as never });
    expect(await cloudflareIceServers(mk(vi.fn().mockRejectedValue(new Error('x'))))).toEqual(
      STUN_ONLY,
    );
    expect(
      await cloudflareIceServers(
        mk(vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) })),
      ),
    ).toEqual(STUN_ONLY);
    expect(
      await cloudflareIceServers(
        mk(vi.fn().mockResolvedValue({ ok: true, json: async () => ({ iceServers: [] }) })),
      ),
    ).toEqual(STUN_ONLY);
    expect(cleanIceServers('x')).toEqual([]);
  });
});

describe('reachability (quiet hours through shouldDeliver)', () => {
  const night = { on: true, from: 22 * 60, to: 7 * 60 };
  const inNight = Date.parse('2026-10-12T21:30:00Z'); // 00:30 in Kyiv
  const noon = Date.parse('2026-10-12T09:00:00Z');
  const dev = { quiet: night, tz: 'Europe/Kyiv' };
  it('no device = reachable (the open app rings); all devices quiet = not; one awake device = reachable', () => {
    expect(anyDeviceRings([], inNight)).toBe(true);
    expect(anyDeviceRings([dev], inNight)).toBe(false);
    expect(anyDeviceRings([dev], noon)).toBe(true);
    expect(anyDeviceRings([dev, { quiet: { on: false, from: 0, to: 0 } }], inNight)).toBe(true);
  });
  it('switching categories off never silences a call (the client cannot turn calls off)', () => {
    expect(
      anyDeviceRings([{ ...dev, prefs: { requests: false, reminders: false, team: false } }], noon),
    ).toBe(true);
  });
});

describe('no recording, no content', () => {
  it('the server code never touches media or user text', async () => {
    const { readFileSync } = await import('node:fs');
    for (const f of ['functions/src/callsCore.ts', 'functions/src/calls.ts'])
      expect(readFileSync(f, 'utf8')).not.toMatch(/MediaRecorder|getUserMedia|console\.(log|info)/);
  });
});

describe('M1: heartbeat (callActive) keeps an active call alive', () => {
  const answered = async () => {
    await start();
    await callAnswer(kv, ports(), C, { callId: ID, accept: true, answer: sdp('answer') });
    await callActive(kv, ports(), T, { callId: ID });
  };
  it('each callActive refreshes lastSeenAt; without it the call stops blocking after HEARTBEAT_STALE_MS', async () => {
    await answered();
    expect((await kv.get(`calls/${ID}`))?.lastSeenAt).toBe(T0);
    now = T0 + HEARTBEAT_STALE_MS - 1_000;
    expect(await callActive(kv, ports(), C, { callId: ID })).toEqual({ state: 'active' });
    expect((await kv.get(`calls/${ID}`))?.lastSeenAt).toBe(now);
    now += HEARTBEAT_STALE_MS - 1_000; // 2 x 44 s after the start: alive thanks to the heartbeat
    expect(await code(start(C, { callId: ID2 }))).toBe('failed-precondition:already-in-call');
  });
  it('a stale active call cannot be revived by a late heartbeat, and callStart closes the caller own stale call as failed', async () => {
    await answered();
    now = T0 + HEARTBEAT_STALE_MS + 1;
    expect(await code(callActive(kv, ports(), T, { callId: ID }))).toBe(
      'failed-precondition:call-stale',
    );
    expect(await code(callIce(kv, ports(), T, { callId: ID, candidate: { candidate: 'a' } }))).toBe(
      'failed-precondition:call-ended',
    );
    expect(await start(T, { callId: ID2 })).toEqual({ state: 'ringing' });
    expect(await doc()).toMatchObject({ state: 'ended', endReason: 'failed', endedAt: now });
  });
  it('a live call of the caller still refuses a second one (already-in-call)', async () => {
    await answered();
    now = T0 + 20_000;
    await callActive(kv, ports(), T, { callId: ID });
    now += 20_000;
    expect(await code(start(T, { callId: ID2 }))).toBe('failed-precondition:already-in-call');
  });
});

describe('M3: relay-only calls filter candidates on the server', () => {
  const host = 'candidate:1 1 udp 2122 192.0.2.1 5000 typ host';
  const srflx = 'candidate:2 1 udp 1686 203.0.113.1 6000 typ srflx raddr 0.0.0.0 rport 0';
  const relay = 'candidate:3 1 udp 41 198.51.100.1 7000 typ relay raddr 0.0.0.0 rport 0';
  it('isRelayCandidate accepts only typ relay (and the end marker)', () => {
    expect(isRelayCandidate(relay)).toBe(true);
    expect(isRelayCandidate('')).toBe(true);
    for (const c of [
      host,
      srflx,
      'candidate:4 1 udp 1 1.1.1.1 1 typ prflx',
      'garbage',
      'typ relayx',
    ])
      expect(isRelayCandidate(c), c).toBe(false);
  });
  it('relayOnly:true is stored on the call; host/srflx/prflx are dropped silently, relay is kept, the SDP is untouched', async () => {
    await start(T, { relayOnly: true });
    expect((await kv.get(`calls/${ID}`))?.relayOnly).toBe(true);
    expect((await doc()) as unknown).toMatchObject({ offer: sdp('offer') });
    for (const c of [host, srflx])
      expect(await callIce(kv, ports(), T, { callId: ID, candidate: { candidate: c } })).toEqual({
        ok: true,
      });
    expect(await kv.list(`calls/${ID}/ice`)).toEqual([]);
    await callIce(kv, ports(), T, { callId: ID, candidate: { candidate: relay } });
    expect((await kv.list(`calls/${ID}/ice`)).length).toBe(1);
  });
  it('without relayOnly (the default) every candidate is stored; relayOnly must be a boolean', async () => {
    await start();
    expect((await kv.get(`calls/${ID}`))?.relayOnly).toBeUndefined();
    await callIce(kv, ports(), T, { callId: ID, candidate: { candidate: host } });
    expect((await kv.list(`calls/${ID}/ice`)).length).toBe(1);
    expect(await code(start(T, { callId: ID2, relayOnly: 'yes' }))).toBe(
      'invalid-argument:bad-input',
    );
  });
});

describe('m3: per-call TURN limit and per-participant ICE limit', () => {
  it('callTurn: TURN_PER_CALL_PER_HOUR per call and hour, then resource-exhausted; the next hour is free', async () => {
    await start();
    for (let i = 0; i < TURN_PER_CALL_PER_HOUR; i++) await callTurn(kv, ports(), C, { callId: ID });
    expect(await code(callTurn(kv, ports(), T, { callId: ID }))).toBe(
      'resource-exhausted:too-many-turn-requests',
    );
  });
  it('callIce: one participant cannot fill the call; the other still can', async () => {
    await start();
    for (let i = 0; i < ICE_PER_PARTICIPANT_MAX; i++)
      await kv.set(`calls/${ID}/ice/x${i}`, { from: 't1' });
    expect(await code(callIce(kv, ports(), T, { callId: ID, candidate: { candidate: 'a' } }))).toBe(
      'resource-exhausted:too-many-candidates',
    );
    expect(await callIce(kv, ports(), C, { callId: ID, candidate: { candidate: 'a' } })).toEqual({
      ok: true,
    });
  });
});

describe('m1: unavailable attempts are capped per pair and do not use start slots', () => {
  it('after UNAVAILABLE_PER_PAIR_PER_HOUR the answer is unavailable without asking about the callee; start slots stay free', async () => {
    reachable = false;
    for (let i = 0; i < UNAVAILABLE_PER_PAIR_PER_HOUR; i++)
      expect(await start(T, { callId: `call-na-${i}-aaaaaaaaa` })).toEqual({
        state: 'ended',
        endReason: 'unavailable',
      });
    expect((await kv.get(`rateLimits/call_t1_${Math.floor(T0 / 3_600_000)}`)) ?? null).toBeNull();
    const asked = vi.fn(async () => true);
    const p = { ...ports(), calleeReachable: asked };
    const r = await callStart(kv, p, T, {
      callId: ID,
      peerId: 'c1',
      kind: 'voice',
      offer: sdp('offer'),
    });
    expect(r).toEqual({ state: 'ended', endReason: 'unavailable' }); // even though the callee is awake now
    expect(asked).not.toHaveBeenCalled(); // nothing is learned from further attempts
    now += 3_600_000; // next hour
    reachable = true;
    expect(await start()).toEqual({ state: 'ringing' });
  });
  it('another callee is not affected by the cap', async () => {
    reachable = false;
    for (let i = 0; i < UNAVAILABLE_PER_PAIR_PER_HOUR + 1; i++)
      await start(T, { callId: `call-na-${i}-aaaaaaaaa` });
    reachable = true;
    await kv.set('coaching/c2', { trainerId: 't1', status: 'active' });
    expect(await start(T, { callId: ID2, peerId: 'c2' })).toEqual({ state: 'ringing' });
  });
});

describe('m5: busy queries are bounded and only read occupying states', () => {
  it('uses limit and a state filter (ended calls are not read), with the composite indexes in firestore.indexes.json', async () => {
    const spy = vi.spyOn(kv, 'list');
    await start();
    const queries = spy.mock.calls.filter((c) => c[0] === 'calls').map((c) => c[1]);
    expect(queries.length).toBeGreaterThanOrEqual(4);
    for (const q of queries) {
      expect(q?.limit).toBeGreaterThan(0);
      expect(JSON.stringify(q?.where)).toContain('"state","in",["ringing","answered","active"]');
    }
    const { readFileSync } = await import('node:fs');
    const idx = JSON.parse(readFileSync('firestore.indexes.json', 'utf8')).indexes as {
      collectionGroup: string;
      fields: { fieldPath: string }[];
    }[];
    for (const f of ['callerId', 'calleeId'])
      expect(
        idx.some(
          (i) =>
            i.collectionGroup === 'calls' &&
            i.fields[0].fieldPath === f &&
            i.fields[1].fieldPath === 'state',
        ),
      ).toBe(true);
  });
});
