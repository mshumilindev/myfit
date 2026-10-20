/**
 * Cloud Functions for coaching: thin wrappers that authenticate (role + status re-read on every call), bind the
 * services to Firestore Admin and map `CoachError` to `HttpsError(code, reason)`. All rules live in `service.ts` /
 * `logic.ts` (unit tested). Never log bodies or envelopes (plan-security C.3): errors carry reason codes only.
 *
 * Secrets (never in the repo; set with `firebase functions:secrets:set`):
 *   COACH_PEPPER       >= 32 random bytes, base64: conversation id HMAC key
 *   COACH_SIGNING_KEY  Ed25519 private key, PEM: signs coach public keys (key pinning, C.2 no. 5)
 */
import { createPrivateKey, createPublicKey, sign as edSign } from 'node:crypto';
import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db, HttpsError, mintToken, requireRole, type Role } from '../lib';
import * as svc from './service';
import * as team from './team';
import { CoachError, type Actor, type Signer } from './service';
import {
  adoptLegacyClientsOf,
  adoptMyLegacyTrainer,
  migrateLegacyRelationships,
} from './lifecycle';
import {
  COACH_PEPPER,
  COACH_SIGNING_KEY,
  coachCallOptions,
  coachCtx as ctx,
  ENFORCE_APPCHECK,
} from './runtime';

function signer(): Signer {
  const pem = COACH_SIGNING_KEY.value();
  const key = createPrivateKey(pem);
  const pub = createPublicKey(key).export({ type: 'spki', format: 'der' });
  const kid = randomKid(pub);
  return { kid, sign: (payload) => edSign(null, Buffer.from(payload), key).toString('base64') };
}
function randomKid(spki: Buffer): string {
  return spki.subarray(spki.length - 8).toString('hex');
}

/** Maps service errors to HttpsError carrying only a reason code. Anything unexpected becomes a bare `internal`. */
async function run<T>(
  req: CallableRequest,
  roles: Role[],
  fn: (a: Actor) => Promise<T>,
): Promise<T> {
  const { uid, user } = await requireRole(req, roles);
  try {
    return await fn({ uid, role: user.role });
  } catch (e) {
    if (e instanceof CoachError) throw new HttpsError(e.code, e.reason, { reason: e.reason });
    if (e instanceof HttpsError) throw e;
    console.error('[coach] unexpected error', (e as Error)?.name); // name only: no message, no data
    throw new HttpsError('internal', 'Something went wrong.');
  }
}
const ANY: Role[] = ['member', 'trainer', 'admin'];
const COACH: Role[] = ['trainer', 'admin'];
const TEAM: Role[] = ['trainer', 'admin', 'manager'];
const ANY_TEAM: Role[] = ['member', 'trainer', 'admin', 'manager'];
const body = (req: CallableRequest): Record<string, unknown> =>
  (req.data ?? {}) as Record<string, unknown>;
const opts = coachCallOptions;

/* ---- callables ------------------------------------------------------------------------------------------------ */
export const coachInvite = onCall(opts, (req) =>
  run(req, COACH, (a) => svc.coachInvite(ctx(), a, body(req))),
);
export const coachInviteRevoke = onCall(opts, (req) =>
  run(req, COACH, (a) => svc.coachInviteRevoke(ctx(), a, body(req))),
);
export const coachInvitePreview = onCall(opts, async (req) => {
  // Public preview for the link page; the requested levels are included only for a signed-in viewer.
  try {
    let actor: Actor | null = null;
    if (req.auth?.uid) actor = { uid: req.auth.uid, role: 'member' };
    return await svc.invitePreview(ctx(), body(req).token, actor);
  } catch (e) {
    if (e instanceof CoachError) throw new HttpsError(e.code, e.reason, { reason: e.reason });
    throw new HttpsError('internal', 'Something went wrong.');
  }
});
export const coachAccept = onCall(opts, (req) =>
  run(req, ANY, (a) => svc.coachAccept(ctx(), a, body(req))),
);
export const coachDecline = onCall(opts, (req) =>
  run(req, ANY, (a) => svc.coachDecline(ctx(), a, body(req))),
);
export const coachEnd = onCall(opts, (req) =>
  run(req, ANY, (a) => svc.coachEnd(ctx(), a, body(req))),
);
export const setCoachingMode = onCall(opts, (req) =>
  run(req, ANY, (a) => svc.setCoachingMode(ctx(), a, body(req))),
);
export const setConsent = onCall(opts, (req) =>
  run(req, ANY, (a) => svc.setConsent(ctx(), a, body(req))),
);
export const coachMyLink = onCall(opts, (req) => run(req, ANY, (a) => svc.coachMyLink(ctx(), a)));
export const coachRead = onCall(opts, (req) =>
  run(req, COACH, (a) => svc.coachRead(ctx(), a, body(req))),
);
export const coachLogRead = onCall(opts, (req) =>
  run(req, COACH, (a) => svc.logRead(ctx(), a, body(req))),
);
export const coachClients = onCall(opts, (req) =>
  run(req, COACH, async (a) => {
    // people already assigned to this trainer the old way (users.trainerId) join the roster the first time it is read
    const legacy = await adoptLegacyClientsOf(ctx(), a.uid);
    return { ...(await svc.coachRoster(ctx(), a)), legacy };
  }),
);
export const coachChatReset = onCall(opts, (req) =>
  run(req, ANY, (a) => svc.chatResetKey(ctx(), a, body(req))),
);
export const rescheduleCreate = onCall({ ...opts, maxInstances: 20 }, (req) =>
  run(req, ANY, (a) => svc.rescheduleCreate(ctx(), a, body(req))),
);
export const rescheduleRespond = onCall({ ...opts, maxInstances: 20 }, (req) =>
  run(req, ANY, (a) => svc.rescheduleRespond(ctx(), a, body(req))),
);
export const publishPlanVersion = onCall(opts, (req) =>
  run(req, COACH, (a) => svc.publishPlanVersion(ctx(), a, body(req))),
);
export const programAck = onCall(opts, (req) =>
  run(req, ANY, (a) => svc.programAck(ctx(), a, body(req))),
);
/* ---- team (SPO-196) ------------------------------------------------------------------------------------------- */
export const teamInvite = onCall(opts, (req) =>
  run(req, TEAM, (a) => team.teamInvite(ctx(), a, body(req))),
);
export const teamInviteRevoke = onCall(opts, (req) =>
  run(req, TEAM, (a) => team.teamInviteRevoke(ctx(), a, body(req))),
);
export const teamInvitePreview = onCall(opts, (req) =>
  run(req, ANY_TEAM, () => team.teamInvitePreview(ctx(), body(req).inviteId)),
);
export const teamAccept = onCall(opts, (req) =>
  run(req, ANY_TEAM, async (a) => {
    const res = await team.teamAccept(ctx(), a, body(req));
    // The role claim is baked into the session token: a new manager gets a fresh one, so the role works at once.
    return res.role === 'manager' ? { ...res, token: await mintToken(a.uid, 'manager') } : res;
  }),
);
export const teamDecline = onCall(opts, (req) =>
  run(req, ANY_TEAM, (a) => team.teamDecline(ctx(), a, body(req))),
);
export const teamRemoveMember = onCall(opts, (req) =>
  run(req, COACH, (a) => team.teamRemoveMember(ctx(), a, body(req))),
);
export const teamLeave = onCall(opts, (req) => run(req, TEAM, (a) => team.teamLeave(ctx(), a)));
export const teamSetActivityScope = onCall(opts, (req) =>
  run(req, COACH, (a) => team.teamSetActivityScope(ctx(), a, body(req))),
);
export const teamRead = onCall(opts, (req) => run(req, TEAM, (a) => team.teamRead(ctx(), a)));
/** The manager's own list of the team's clients (ids, names, conversation ids; no content). */
export const teamClients = onCall(opts, (req) =>
  run(req, ['manager'], (a) => team.teamClients(ctx(), a)),
);
/** SPO-239: a manager asks to remove a client; the client's trainer answers (Agenda "Team requests"). */
export const clientRemovalCreate = onCall(opts, (req) =>
  run(req, ['manager'], (a) => team.clientRemovalCreate(ctx(), a, body(req))),
);
export const clientRemovalCancel = onCall(opts, (req) =>
  run(req, ['manager'], (a) => team.clientRemovalCancel(ctx(), a, body(req))),
);
export const clientRemovalRespond = onCall(opts, (req) =>
  run(req, COACH, (a) => team.clientRemovalRespond(ctx(), a, body(req))),
);
export const teamRequests = onCall(opts, (req) =>
  run(req, COACH, (a) => team.teamRequests(ctx(), a)),
);
/** A client device asks who it must delegate the schedule keys to (its trainer's active managers). */
export const teamManagersForClient = onCall(opts, (req) =>
  run(req, ANY, (a) => team.teamManagersForClient(ctx(), a)),
);

export const coachPublishSignKey = onCall(
  { secrets: [COACH_PEPPER, COACH_SIGNING_KEY], enforceAppCheck: ENFORCE_APPCHECK },
  (req) => run(req, ANY, (a) => svc.publishSignKey(ctx(), a, body(req), signer())),
);
export const coachKeySign = onCall(
  { secrets: [COACH_PEPPER, COACH_SIGNING_KEY], enforceAppCheck: ENFORCE_APPCHECK },
  (req) =>
    run(req, TEAM, async (a) => {
      const s = signer();
      // The verification key is public. Clients PIN it in the build (client/src/coachCrypto/signingPins.ts); this document
      // is only the place where a pinned key announces its successor (rotation, signed offline) or a convenience copy for
      // development. Written only when it differs, so a normal sign call never rewrites it.
      const pubPem = createPublicKey(createPrivateKey(COACH_SIGNING_KEY.value()))
        .export({ type: 'spki', format: 'pem' })
        .toString();
      const ref = db.doc('config/coachSigning');
      const cur = (await ref.get()).data();
      if (!cur || cur.kid !== s.kid || cur.pub !== pubPem) {
        // keep an existing rotation announcement that points at this key
        await ref.set({
          ...(cur?.kid === s.kid ? cur : {}),
          kid: s.kid,
          pub: pubPem,
          alg: 'Ed25519',
        });
      }
      return svc.coachKeySign(ctx(), a, s);
    }),
);
export const coachExport = onCall({ ...opts, maxInstances: 10 }, (req) =>
  run(req, COACH, (a) => svc.coachExport(ctx(), a, body(req))),
);
/** The signed-in member's own legacy `users.trainerId` -> `coaching/{me}` (all consent off); see `adoptMyLegacyTrainer`. */
export const coachAdoptLegacy = onCall(opts, (req) =>
  run(req, ANY, (a) => adoptMyLegacyTrainer(ctx(), a)),
);
/** Admin-only backfill (Q-19). `dryRun` is true unless the body says `dryRun: false`. */
export const coachMigrateLegacy = onCall({ ...opts, timeoutSeconds: 300 }, (req) =>
  run(req, ['admin'], async () => {
    const b = body(req);
    return migrateLegacyRelationships(ctx(), {
      dryRun: b.dryRun !== false,
      limit: typeof b.limit === 'number' ? b.limit : undefined,
      after: typeof b.after === 'string' ? b.after : undefined,
    });
  }),
);

/* ---- triggers ------------------------------------------------------------------------------------------------- */
const trig = { secrets: [COACH_PEPPER], maxInstances: 20 };

export const onCoachMessageCreated = onDocumentCreated(
  { document: 'conversations/{cid}/messages/{mid}', ...trig },
  async (event) => {
    await svc.afterMessageCreated(ctx(), event.params.cid, event.params.mid);
  },
);

/** A tombstone / pending delete changes unread and the last message. */
export const onCoachMessageUpdated = onDocumentWritten(
  { document: 'conversations/{cid}/messages/{mid}', ...trig },
  async (event) => {
    if (!event.data?.before.exists || !event.data.after.exists) return;
    await svc.recomputeConversation(ctx(), event.params.cid);
  },
);

export const onCoachConversationWritten = onDocumentWritten(
  { document: 'conversations/{cid}', ...trig },
  async (event) => {
    const before = event.data?.before.exists
      ? (event.data.before.data() as Record<string, unknown>)
      : null;
    const after = event.data?.after.exists
      ? (event.data.after.data() as Record<string, unknown>)
      : null;
    if (!after) return;
    await svc.onConversationKey(ctx(), event.params.cid, before, after);
    const ptr = (d: Record<string, unknown> | null) =>
      JSON.stringify([d?.readUpTo ?? {}, d?.clearedBefore ?? {}]);
    if (ptr(before) !== ptr(after)) await svc.recomputeConversation(ctx(), event.params.cid);
  },
);

export const onCoachKeyWritten = onDocumentWritten(
  { document: 'coachKeys/{uid}', ...trig },
  async (event) => {
    const before = event.data?.before.exists
      ? (event.data.before.data() as Record<string, unknown>)
      : null;
    const after = event.data?.after.exists
      ? (event.data.after.data() as Record<string, unknown>)
      : null;
    await svc.onCoachKeyChanged(ctx(), event.params.uid, before, after);
  },
);

/** Hourly: request expiry, straggling deletes, audit retention, 90-day rotation flags. */
export const coachSweep = onSchedule({ schedule: 'every 60 minutes', ...trig }, async () => {
  const r = await svc.sweep(ctx());
  console.log('[coach] sweep', JSON.stringify(r)); // counts only
});
