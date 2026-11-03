/**
 * Trainer <-> client calls, server side (SPO-22 / SPO-440), pure core: no Firebase imports. It runs on the `Kv` seam plus a
 * few ports, so every rule is unit tested on the in-memory Kv. The Firebase binding is `calls.ts`; the contract the client
 * is built against is `docs/specs/SPO-22-calls-contract.md`.
 *
 * Rules enforced here (the client UI is NOT the control):
 *   - one-to-one, and only inside an ACTIVE pair: `coaching/{clientId}.status == 'active'` with `trainerId`; either side may
 *     ring the other; nobody else (a manager of a team, another trainer, a stranger) can;
 *   - the client cannot switch calls off (there is no such setting to read);
 *   - never recorded, nothing the user typed is stored: the documents hold only ids, state, SDP and ICE (technical);
 *   - quiet hours of the callee end the attempt as a neutral `unavailable` (the reason is never disclosed) and write nothing,
 *     so the callee does not even learn that someone tried;
 *   - a callee in another live call (or a caller still in one) gets `busy` / `already-in-call`;
 *   - rate limit on starts; every write is an idempotent upsert keyed by the client's `callId`.
 */
import { HttpsError } from 'firebase-functions/v2/https';
import type { Doc, Kv } from './coach/kv';
import { DAY_MS, HOUR, takeSlot } from './coach/guards';
import { shouldDeliver } from './coach/pushPolicy';

export type CallKind = 'voice' | 'video';
export type CallState = 'ringing' | 'answered' | 'active' | 'ended';
export type EndReason = 'hangup' | 'declined' | 'missed' | 'busy' | 'unavailable' | 'failed';
export interface Sdp {
  type: 'offer' | 'answer';
  sdp: string;
}
export interface CallDoc {
  callerId: string;
  calleeId: string;
  /** the coaching client of the pair (the caller or the callee), the key of `coaching/{clientId}` */
  clientId: string;
  kind: CallKind;
  state: CallState;
  endReason?: EndReason;
  offer?: Sdp;
  answer?: Sdp;
  createdAt: number;
  answeredAt?: number;
  /** heartbeat of an `active` call (`callActive`) */
  lastSeenAt?: number;
  /** the caller asked for relay-only: the server then drops host/srflx/prflx candidates in `callIce` */
  relayOnly?: true;
  endedAt?: number;
  /** a Date (Firestore Timestamp): the field a TTL policy needs */
  expiresAt: Date;
}

/** Ring window the callee has (the client shows 45 s; the push TTL is the same 45 s). */
export const RING_MS = 45_000;
/** Server grace on top of the ring window before an unanswered call counts as missed / no longer blocks others. */
export const RING_GRACE_MS = 15_000;
/** An accepted call that never reported `active` is dead after this. */
export const ANSWERED_MAX_MS = 2 * 60_000;
/** Nobody stays "in a call" forever: a call that never ended stops blocking others after this. */
export const CALL_MAX_MS = 4 * HOUR;
/** An `active` call is alive only while a participant keeps sending `callActive` (the client does so every ~20 s). */
export const HEARTBEAT_STALE_MS = 45_000;
export const TURN_PER_CALL_PER_HOUR = 10;
export const ICE_PER_PARTICIPANT_MAX = 120;
/** `callStart` attempts per (caller, callee) per hour that ended as `unavailable`; beyond it the answer is `unavailable` unchecked. */
export const UNAVAILABLE_PER_PAIR_PER_HOUR = 3;
/** Most documents read per "is this person in a call" query. */
export const BUSY_QUERY_LIMIT = 10;
/** Calls count as occupying a person only in these states (a composite index with the id field, firestore.indexes.json). */
const OCCUPYING = ['ringing', 'answered', 'active'];
/** TTL: a finished call document and its metadata live this long (data-registry R61 `{{ПОТРІБНО}}`). */
export const CALL_DOC_TTL_MS = DAY_MS;
/** TTL: ICE candidates (contain IP addresses) live this long. */
export const ICE_TTL_MS = 10 * 60_000;
export const STARTS_PER_HOUR = 20;
export const ICE_PER_CALL_MAX = 200;
export const SDP_MAX = 32_768;

const CALL_ID = /^[A-Za-z0-9_-]{16,64}$/;
const UID = /^[A-Za-z0-9_-]{1,128}$/;

export interface CallActor {
  uid: string;
  role: string;
}
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}
export interface CallPorts {
  now(): number;
  /** a fresh id for an ICE document */
  newId(): string;
  /** Does the callee have any device that would be rung right now (quiet hours / categories applied)? */
  calleeReachable(calleeId: string, at: number): Promise<boolean>;
  /** Content-free ring push, best effort (a failure never fails the call). */
  pushIncoming(calleeId: string): Promise<void>;
  /** ICE servers for this call; never throws (falls back to STUN only). */
  iceServers(callId: string): Promise<IceServer[]>;
}

const fail = (code: ConstructorParameters<typeof HttpsError>[0], reason: string): never => {
  throw new HttpsError(code, reason, { reason });
};

/* ---- kill switch (config/flags.calls) ------------------------------------------------------------------------------ */
/**
 * Server-side switch, OFF unless an admin sets `config/flags.calls = true` (the existing flags document; its rules let
 * only an admin write it). Every call callable except `callEnd` is refused with `failed-precondition/calls-disabled`
 * while it is off, so ending a call that is in progress always works.
 */
export async function requireCallsEnabled(kv: Kv): Promise<void> {
  const flags = (await kv.get('config/flags')) as { calls?: unknown } | null;
  if (flags?.calls !== true) fail('failed-precondition', 'calls-disabled');
}

/* ---- input ---------------------------------------------------------------------------------------------------- */
function asObject(data: unknown, allowed: string[]): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data))
    return fail('invalid-argument', 'bad-input');
  const d = data as Record<string, unknown>;
  for (const k of Object.keys(d)) if (!allowed.includes(k)) fail('invalid-argument', 'bad-input');
  return d;
}
const callIdOf = (v: unknown): string =>
  typeof v === 'string' && CALL_ID.test(v) ? v : fail('invalid-argument', 'bad-call-id');
const uidOf = (v: unknown): string =>
  typeof v === 'string' && UID.test(v) ? v : fail('invalid-argument', 'bad-peer');
function sdpOf(v: unknown, type: Sdp['type']): Sdp {
  const o = v as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || Array.isArray(o) || o.type !== type)
    return fail('invalid-argument', 'bad-sdp');
  if (Object.keys(o).some((k) => k !== 'type' && k !== 'sdp')) fail('invalid-argument', 'bad-sdp');
  if (typeof o.sdp !== 'string' || o.sdp.length < 10 || o.sdp.length > SDP_MAX)
    return fail('invalid-argument', 'bad-sdp');
  return { type, sdp: o.sdp };
}
const strOrNull = (v: unknown, max: number): string | null => {
  if (v === null || v === undefined) return null;
  return typeof v === 'string' && v.length <= max ? v : fail('invalid-argument', 'bad-candidate');
};
/** An `RTCIceCandidateInit` reduced to its four known fields; anything else is dropped, anything malformed is refused. */
export function iceOf(v: unknown): {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  usernameFragment: string | null;
} {
  const o = v as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || Array.isArray(o) || typeof o.candidate !== 'string')
    return fail('invalid-argument', 'bad-candidate');
  if (o.candidate.length > 1024) fail('invalid-argument', 'bad-candidate');
  const i = o.sdpMLineIndex;
  if (
    i !== null &&
    i !== undefined &&
    !(Number.isInteger(i) && (i as number) >= 0 && (i as number) < 256)
  )
    fail('invalid-argument', 'bad-candidate');
  return {
    candidate: o.candidate,
    sdpMid: strOrNull(o.sdpMid, 64),
    sdpMLineIndex: typeof i === 'number' ? i : null,
    usernameFragment: strOrNull(o.usernameFragment, 128),
  };
}

/** `typ relay` only; an empty string is the end-of-candidates marker and is harmless. */
export function isRelayCandidate(candidate: string): boolean {
  if (candidate === '') return true;
  return /\styp relay(\s|$)/.test(candidate);
}

/* ---- state helpers ---------------------------------------------------------------------------------------------- */
const pathOf = (callId: string) => `calls/${callId}`;
const expiry = (now: number, ms: number) => new Date(now + ms);

/** Is this call still occupying its two people? Stale documents (a tab closed mid-call) stop blocking by themselves. */
export function isLive(c: Doc, now: number): boolean {
  const created = Number(c.createdAt ?? 0);
  if (c.state === 'ringing') return now - created < RING_MS + RING_GRACE_MS;
  if (c.state === 'answered') return now - Number(c.answeredAt ?? created) < ANSWERED_MAX_MS;
  if (c.state === 'active')
    return (
      now - created < CALL_MAX_MS &&
      now - Number(c.lastSeenAt ?? c.answeredAt ?? created) < HEARTBEAT_STALE_MS
    );
  return false;
}
const asCall = (d: Doc | null): CallDoc | null => (d ? (d as unknown as CallDoc) : null);

/** The ringing call whose window passed is a missed call (server-side, lazily; the caller's client usually reports it first). */
const ringExpired = (c: CallDoc, now: number) =>
  c.state === 'ringing' && now - c.createdAt >= RING_MS + RING_GRACE_MS;

export interface CallResult {
  state: CallState;
  endReason?: EndReason;
}
const resultOf = (c: Pick<CallDoc, 'state' | 'endReason'>): CallResult => ({
  state: c.state,
  ...(c.endReason ? { endReason: c.endReason } : {}),
});

interface UserRec {
  role?: string;
  status?: string;
}
/** A live, non-suspended account that is not a team manager (managers never call, and are never called). */
async function callable(kv: Kv, uid: string): Promise<boolean> {
  const u = (await kv.get(`users/${uid}`)) as UserRec | null;
  return !!u && u.status !== 'suspended' && u.role !== 'manager';
}

/**
 * The pair rule. Returns the coaching client id when `a` and `b` are the two sides of an ACTIVE coaching relationship
 * (trainer = role trainer/admin, the one named in `coaching/{client}.trainerId`), else null.
 */
export async function activePair(kv: Kv, actor: CallActor, peerId: string): Promise<string | null> {
  if (actor.uid === peerId) return null;
  const tryClient = async (clientId: string, trainerId: string): Promise<boolean> => {
    const c = (await kv.get(`coaching/${clientId}`)) as {
      trainerId?: string;
      status?: string;
    } | null;
    if (!c || c.status !== 'active' || c.trainerId !== trainerId) return false;
    const t = (await kv.get(`users/${trainerId}`)) as UserRec | null;
    return !!t && (t.role === 'trainer' || t.role === 'admin');
  };
  if (await tryClient(actor.uid, peerId)) return actor.uid; // the client rings their trainer
  if ((actor.role === 'trainer' || actor.role === 'admin') && (await tryClient(peerId, actor.uid)))
    return peerId; // the trainer rings their client
  return null;
}

/** Best effort: ICE documents hold IP addresses, so they go the moment the call ends (the TTL is only the backstop). */
async function dropIce(kv: Kv, callId: string): Promise<void> {
  try {
    for (const r of await kv.list(`${pathOf(callId)}/ice`)) await kv.del(r.path);
  } catch {
    /* the TTL policy removes what is left */
  }
}

/* ---- callStart --------------------------------------------------------------------------------------------------- */
/**
 * Starts a call. Order: input, replay of the same `callId` (a retry is a no-op), the pair, the rate limit, the callee's
 * quiet hours, `busy`, then ONE transaction that re-checks `busy` and creates the document. `unavailable` and `busy` do
 * not create a document: the callee sees nothing, and the answer is the response itself.
 */
export async function callStart(
  kv: Kv,
  ports: CallPorts,
  actor: CallActor,
  data: unknown,
): Promise<CallResult> {
  await requireCallsEnabled(kv);
  const d = asObject(data, ['callId', 'peerId', 'kind', 'offer', 'relayOnly']);
  const callId = callIdOf(d.callId);
  const peerId = uidOf(d.peerId);
  if (d.kind !== 'voice' && d.kind !== 'video') return fail('invalid-argument', 'bad-kind');
  const kind: CallKind = d.kind;
  const offer = sdpOf(d.offer, 'offer');
  if (d.relayOnly !== undefined && typeof d.relayOnly !== 'boolean')
    return fail('invalid-argument', 'bad-input');
  const relayOnly = d.relayOnly === true;
  const now = ports.now();

  const existing = asCall(await kv.get(pathOf(callId)));
  if (existing) {
    if (existing.callerId !== actor.uid) return fail('permission-denied', 'call-id-taken');
    return resultOf(existing);
  }
  if (actor.role === 'manager') return fail('permission-denied', 'not-allowed');
  const clientId = await activePair(kv, actor, peerId);
  if (!clientId || !(await callable(kv, actor.uid)) || !(await callable(kv, peerId)))
    return fail('permission-denied', 'no-active-coaching');

  // Probing the callee's quiet hours: attempts that end as `unavailable` are capped per (caller, callee) and hour, do NOT
  // use a start slot, and once the cap is reached the answer is `unavailable` without looking at the callee at all.
  const hour = Math.floor(now / HOUR);
  const naKey = `rateLimits/callna_${actor.uid}_${peerId}_${hour}`;
  const unavailable = { state: 'ended', endReason: 'unavailable' } as const;
  if (Number((await kv.get(naKey))?.count ?? 0) >= UNAVAILABLE_PER_PAIR_PER_HOUR)
    return unavailable;
  if (!(await ports.calleeReachable(peerId, now))) {
    await takeSlot(kv, `callna_${actor.uid}_${peerId}_${hour}`, now, UNAVAILABLE_PER_PAIR_PER_HOUR);
    return unavailable; // quiet hours / no device would ring: no reason given
  }
  if (!(await takeSlot(kv, `call_${actor.uid}_${hour}`, now, STARTS_PER_HOUR)))
    return fail('resource-exhausted', 'too-many-calls');

  const occupying = (k: Kv, field: 'callerId' | 'calleeId', uid: string) =>
    k.list('calls', {
      where: [
        [field, '==', uid],
        ['state', 'in', OCCUPYING],
      ],
      limit: BUSY_QUERY_LIMIT,
    });
  const blocking = async (
    k: Kv,
  ): Promise<{ who: 'self' | 'peer' | null; stale: { id: string; state: string }[] }> => {
    const own = [
      ...(await occupying(k, 'callerId', actor.uid)),
      ...(await occupying(k, 'calleeId', actor.uid)),
    ];
    const stale = own
      .filter((r) => !isLive(r.data, now))
      .map((r) => ({ id: r.id, state: String(r.data.state) }));
    if (own.some((r) => isLive(r.data, now))) return { who: 'self', stale };
    const theirs = [
      ...(await occupying(k, 'callerId', peerId)),
      ...(await occupying(k, 'calleeId', peerId)),
    ];
    return { who: theirs.some((r) => isLive(r.data, now)) ? 'peer' : null, stale };
  };
  const closed: string[] = [];
  const created = await kv.tx(async (t): Promise<CallResult | null> => {
    const { who, stale } = await blocking(t);
    if (who === 'self') return fail('failed-precondition', 'already-in-call');
    // an own call that nobody tends any more (a closed tab): closed here so it stops counting
    for (const o of stale) {
      await t.merge(pathOf(o.id), ended(now, o.state === 'ringing' ? 'missed' : 'failed'));
      closed.push(o.id);
    }
    if (who === 'peer') return { state: 'ended', endReason: 'busy' };
    const doc: CallDoc = {
      callerId: actor.uid,
      calleeId: peerId,
      clientId,
      kind,
      state: 'ringing',
      offer,
      ...(relayOnly ? { relayOnly: true as const } : {}),
      createdAt: now,
      expiresAt: expiry(now, CALL_DOC_TTL_MS),
    };
    await t.set(pathOf(callId), doc as unknown as Doc);
    return null;
  });
  for (const id of closed) await dropIce(kv, id);
  if (created) return created;
  try {
    await ports.pushIncoming(peerId);
  } catch {
    /* a failed push never fails the call: the callee's open app rings from the snapshot */
  }
  return { state: 'ringing' };
}

/* ---- loading a call for a participant ------------------------------------------------------------------------ */
async function participant(kv: Kv, actor: CallActor, callId: string): Promise<CallDoc> {
  const c = asCall(await kv.get(pathOf(callId)));
  // the same answer for "no such call" and "not yours": ids are not probed
  if (!c || (c.callerId !== actor.uid && c.calleeId !== actor.uid))
    return fail('permission-denied', 'not-a-participant');
  return c;
}
const ended = (now: number, reason: EndReason): Doc => ({
  state: 'ended',
  endReason: reason,
  endedAt: now,
  expiresAt: expiry(now, CALL_DOC_TTL_MS),
});

/* ---- callAnswer -------------------------------------------------------------------------------------------------- */
export async function callAnswer(
  kv: Kv,
  ports: CallPorts,
  actor: CallActor,
  data: unknown,
): Promise<CallResult> {
  await requireCallsEnabled(kv);
  const d = asObject(data, ['callId', 'accept', 'answer']);
  const callId = callIdOf(d.callId);
  if (typeof d.accept !== 'boolean') return fail('invalid-argument', 'bad-input');
  const answer = d.accept ? sdpOf(d.answer, 'answer') : null;
  const now = ports.now();
  let ending = false;
  const out = await kv.tx(async (t): Promise<CallResult> => {
    const c = await participant(t, actor, callId);
    if (c.calleeId !== actor.uid) return fail('permission-denied', 'only-callee');
    if (c.state === 'ended') return resultOf(c);
    if (c.state !== 'ringing') return resultOf(c); // already answered: a repeat is a no-op
    if (ringExpired(c, now)) {
      await t.merge(pathOf(callId), ended(now, 'missed'));
      ending = true;
      return { state: 'ended', endReason: 'missed' };
    }
    if (!answer) {
      await t.merge(pathOf(callId), ended(now, 'declined'));
      ending = true;
      return { state: 'ended', endReason: 'declined' };
    }
    // the relationship may have ended while it rang
    if (!(await activePair(t, actor, c.callerId)) || !(await callable(t, c.callerId))) {
      await t.merge(pathOf(callId), ended(now, 'unavailable'));
      ending = true;
      return { state: 'ended', endReason: 'unavailable' };
    }
    await t.merge(pathOf(callId), { state: 'answered', answer, answeredAt: now, lastSeenAt: now });
    return { state: 'answered' };
  });
  if (ending) await dropIce(kv, callId);
  return out;
}

/* ---- callActive (not in the first contract: nobody else can move answered -> active) ------------------------------ */
export async function callActive(
  kv: Kv,
  ports: CallPorts,
  actor: CallActor,
  data: unknown,
): Promise<CallResult> {
  await requireCallsEnabled(kv);
  const d = asObject(data, ['callId']);
  const callId = callIdOf(d.callId);
  const now = ports.now();
  return kv.tx(async (t) => {
    const c = await participant(t, actor, callId);
    // answered -> active, and for an active call the HEARTBEAT: the client sends this every ~20 s; a call without one
    // for HEARTBEAT_STALE_MS stops counting as live (busy, ICE, TURN) and is closed as `failed` by the next start
    if (c.state === 'answered' || (c.state === 'active' && isLive(c as unknown as Doc, now))) {
      await t.merge(pathOf(callId), { state: 'active', lastSeenAt: now });
      return { state: 'active' as const };
    }
    if (c.state === 'ended') return resultOf(c);
    if (c.state === 'active') return fail('failed-precondition', 'call-stale');
    return fail('failed-precondition', 'not-answered');
  });
}

/* ---- callEnd ----------------------------------------------------------------------------------------------------- */
const CLIENT_REASONS: EndReason[] = ['hangup', 'declined', 'missed', 'failed'];
export async function callEnd(
  kv: Kv,
  ports: CallPorts,
  actor: CallActor,
  data: unknown,
): Promise<CallResult> {
  const d = asObject(data, ['callId', 'reason']);
  const callId = callIdOf(d.callId);
  const reason = d.reason as EndReason;
  if (!CLIENT_REASONS.includes(reason)) return fail('invalid-argument', 'bad-reason'); // busy/unavailable are server-only
  const now = ports.now();
  const out = await kv.tx(async (t): Promise<CallResult> => {
    const c = await participant(t, actor, callId);
    if (c.state === 'ended') return resultOf(c); // idempotent: the first reason stands
    // reasons must fit the role and the state, otherwise one side could write the other's story
    if (reason === 'declined' && !(c.calleeId === actor.uid && c.state === 'ringing'))
      return fail('failed-precondition', 'bad-reason');
    if (reason === 'missed' && !(c.callerId === actor.uid && c.state === 'ringing'))
      return fail('failed-precondition', 'bad-reason');
    await t.merge(pathOf(callId), ended(now, reason));
    return { state: 'ended', endReason: reason };
  });
  await dropIce(kv, callId);
  return out;
}

/* ---- callIce ----------------------------------------------------------------------------------------------------- */
export async function callIce(
  kv: Kv,
  ports: CallPorts,
  actor: CallActor,
  data: unknown,
): Promise<{ ok: true }> {
  await requireCallsEnabled(kv);
  const d = asObject(data, ['callId', 'candidate']);
  const callId = callIdOf(d.callId);
  const candidate = iceOf(d.candidate);
  const now = ports.now();
  const c = await participant(kv, actor, callId);
  if (c.state === 'ended' || !isLive(c as unknown as Doc, now))
    return fail('failed-precondition', 'call-ended');
  // relay-only calls (the caller asked for it): host / srflx / prflx candidates are not stored. The SDP is not touched.
  if (c.relayOnly === true && !isRelayCandidate(candidate.candidate)) return { ok: true };
  const iceColl = `${pathOf(callId)}/ice`;
  const { count } = await kv.aggregate(iceColl);
  if (count >= ICE_PER_CALL_MAX) return fail('resource-exhausted', 'too-many-candidates');
  const mine = await kv.aggregate(iceColl, { where: [['from', '==', actor.uid]] });
  if (mine.count >= ICE_PER_PARTICIPANT_MAX)
    return fail('resource-exhausted', 'too-many-candidates');
  await kv.set(`${pathOf(callId)}/ice/${ports.newId()}`, {
    from: actor.uid,
    candidate,
    createdAt: now,
    expiresAt: expiry(now, ICE_TTL_MS),
  });
  return { ok: true };
}

/* ---- callTurn ---------------------------------------------------------------------------------------------------- */
export async function callTurn(
  kv: Kv,
  ports: CallPorts,
  actor: CallActor,
  data: unknown,
): Promise<{ iceServers: IceServer[] }> {
  await requireCallsEnabled(kv);
  const d = asObject(data, ['callId']);
  const callId = callIdOf(d.callId);
  const now = ports.now();
  const c = await participant(kv, actor, callId);
  if (c.state === 'ended' || !isLive(c as unknown as Doc, now))
    return fail('failed-precondition', 'call-ended');
  if (
    !(await takeSlot(
      kv,
      `callturn_${callId}_${Math.floor(now / HOUR)}`,
      now,
      TURN_PER_CALL_PER_HOUR,
    ))
  )
    return fail('resource-exhausted', 'too-many-turn-requests');
  return { iceServers: await ports.iceServers(callId) };
}

/* ---- reachability (quiet hours) ---------------------------------------------------------------------------------- */
/**
 * Would at least one of the callee's devices be rung now? A person with NO registered device (the app is only open in a
 * tab) is reachable: the open app rings from the Firestore snapshot. A person whose every device is inside its quiet
 * window is not: the caller gets a neutral `unavailable`.
 */
export function anyDeviceRings(
  devices: { quiet?: unknown; tz?: unknown; prefs?: unknown }[],
  at: number,
): boolean {
  if (devices.length === 0) return true;
  return devices.some((dev) => shouldDeliver('call', dev, at));
}

/* ---- TURN credentials -------------------------------------------------------------------------------------------- */
export const STUN_ONLY: IceServer[] = [{ urls: ['stun:stun.cloudflare.com:3478'] }];
export const TURN_TTL_S = 3600;

/** Keeps only well-formed ICE server entries from a provider answer (never forwards unknown fields). */
export function cleanIceServers(v: unknown): IceServer[] {
  const list = Array.isArray(v) ? v : [];
  const out: IceServer[] = [];
  for (const e of list.slice(0, 8)) {
    const o = e as Record<string, unknown> | null;
    if (!o || typeof o !== 'object') continue;
    const urls = Array.isArray(o.urls) ? o.urls : [o.urls];
    const ok = urls.filter(
      (u): u is string => typeof u === 'string' && /^(stun|turn|turns):/.test(u),
    );
    if (ok.length === 0) continue;
    out.push({
      urls: ok.slice(0, 8),
      ...(typeof o.username === 'string' ? { username: o.username } : {}),
      ...(typeof o.credential === 'string' ? { credential: o.credential } : {}),
    });
  }
  return out;
}

export interface TurnConfig {
  keyId: string;
  token: string;
  fetch: (
    url: string,
    init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal },
  ) => Promise<{
    ok: boolean;
    json(): Promise<unknown>;
  }>;
}
/**
 * Cloudflare Realtime TURN credentials. No key/token (the owner has not provisioned the secret yet) or any failure: STUN
 * only, never an error, so a call still works on friendly networks. Sends NO user data to Cloudflare, only the TTL.
 * UNVERIFIED against the live API (no token available when written): endpoint and answer shape are from Cloudflare's docs.
 */
export async function cloudflareIceServers(cfg: TurnConfig | null): Promise<IceServer[]> {
  if (!cfg?.keyId || !cfg.token) return STUN_ONLY;
  try {
    const res = await cfg.fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(cfg.keyId)}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: TURN_TTL_S }),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return STUN_ONLY;
    const body = (await res.json()) as { iceServers?: unknown };
    const servers = cleanIceServers(body.iceServers);
    return servers.length ? servers : STUN_ONLY;
  } catch {
    return STUN_ONLY;
  }
}
