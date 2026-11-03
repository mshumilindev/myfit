/**
 * Trainer <-> client calls (SPO-22 / SPO-440): the Firebase binding of `callsCore.ts`. Five callables (v2, us-central1 via
 * the global options): callStart, callAnswer, callEnd, callIce, callTurn, plus callActive (answered -> active).
 * Contract: `docs/specs/SPO-22-calls-contract.md`. Errors carry reason codes only; SDP/ICE are never logged.
 *
 * Managers are refused here (`requireRole` below lists no `manager`) and again in the core.
 */
import { randomBytes } from 'node:crypto';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { db, HttpsError, requireRole } from './lib';
import { sendToUser } from './push';
import { ENFORCE_APPCHECK, coachKv } from './coach/runtime';
import { defaultTextKey } from './coach/pushText';
import { pushLink, pushTag } from './coach/pushPolicy';
import * as core from './callsCore';
import type { CallPorts } from './callsCore';

/** Push-service TTL of an incoming-call push: a ring older than this is not a ring. */
export const CALL_PUSH_TTL_S = 45;

/**
 * Cloudflare TURN. The API token is the secret `CF_TURN_TOKEN` (bound to `callTurn` only); the key id is not secret and
 * comes from the `CF_TURN_KEY_ID` param (functions/.env). With no key id the answer is STUN only.
 */
const CF_TURN_TOKEN = defineSecret('CF_TURN_TOKEN');
const CF_TURN_KEY_ID = defineString('CF_TURN_KEY_ID', { default: '' });
const turnConfig = () => ({
  keyId: CF_TURN_KEY_ID.value(),
  token: CF_TURN_TOKEN.value(),
  fetch: (url: string, init: Parameters<typeof fetch>[1]) => fetch(url, init),
});

export const firebaseCallPorts: CallPorts = {
  now: () => Date.now(),
  newId: () => `i${randomBytes(9).toString('hex')}`,
  async calleeReachable(calleeId, at) {
    const devices = await db.collection('users').doc(calleeId).collection('push').get();
    return core.anyDeviceRings(
      devices.docs.map((d) => ({ quiet: d.get('quiet'), tz: d.get('tz'), prefs: d.get('prefs') })),
      at,
    );
  },
  async pushIncoming(calleeId) {
    await sendToUser(calleeId, {
      title: 'Spotter',
      body: 'Incoming call', // English fallback; the device language text is chosen in sendToUser
      text: defaultTextKey('call'),
      tag: pushTag('call'),
      url: pushLink('call', false),
      kind: 'call',
      ttl: CALL_PUSH_TTL_S,
    });
  },
  iceServers: () => core.cloudflareIceServers(turnConfig()),
};

const opts = { enforceAppCheck: ENFORCE_APPCHECK };

/** Signed in, live account, not suspended, role member | trainer | admin (a team manager cannot call). */
async function run<T>(
  req: CallableRequest,
  fn: (actor: { uid: string; role: string }) => Promise<T>,
): Promise<T> {
  const { uid, user } = await requireRole(req, ['member', 'trainer', 'admin']);
  try {
    return await fn({ uid, role: user.role });
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error('[calls] unexpected error', (e as Error)?.name); // name only: no SDP, no ids
    throw new HttpsError('internal', 'Something went wrong.');
  }
}

export const callStart = onCall(opts, (req) =>
  run(req, (a) => core.callStart(coachKv, firebaseCallPorts, a, req.data)),
);
export const callAnswer = onCall(opts, (req) =>
  run(req, (a) => core.callAnswer(coachKv, firebaseCallPorts, a, req.data)),
);
export const callActive = onCall(opts, (req) =>
  run(req, (a) => core.callActive(coachKv, firebaseCallPorts, a, req.data)),
);
export const callEnd = onCall(opts, (req) =>
  run(req, (a) => core.callEnd(coachKv, firebaseCallPorts, a, req.data)),
);
export const callIce = onCall(opts, (req) =>
  run(req, (a) => core.callIce(coachKv, firebaseCallPorts, a, req.data)),
);
export const callTurn = onCall({ ...opts, secrets: [CF_TURN_TOKEN] }, (req) =>
  run(req, (a) => core.callTurn(coachKv, firebaseCallPorts, a, req.data)),
);
