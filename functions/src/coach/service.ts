/**
 * Coaching services (plan-backend sections 2, 4, 5, 10, 11 and plan-security C.2/C.3), written against the `Kv`
 * seam so every rule below runs in unit tests without an emulator. `handlers.ts` binds them to Firestore Admin
 * and Cloud Functions. Nothing here logs request bodies or envelopes; sealed fields are only ever passed through.
 */
import type { Doc, Kv } from './kv';
import { inviteUrl } from './inviteLink';
import {
  ALL_OFF,
  MAX_AT_SKEW,
  MAX_PENDING_REQUESTS,
  REQUEST_ID,
  ckEnvelopeProblem,
  AUDIT_RETENTION,
  DAY,
  CATEGORIES,
  INVITE_TTL,
  MODES,
  READ_VIA,
  UNDO_GRACE,
  auditId,
  canDecide,
  cleanName,
  conversationId,
  consentChanges,
  downgrades,
  effectiveRequest,
  expiredRequests,
  gateCategory,
  inviteLimit,
  inviteProblem,
  isCid,
  isUid,
  keyFingerprint,
  nextEpoch,
  parseConsent,
  rateLimited,
  requestProblem,
  rotationDue,
  unreadMap,
  type Category,
  type CoachInviteDoc,
  type CoachMode,
  type CoachingDoc,
  type Consent,
  type ReadVia,
  type ReqStatus,
} from './logic';

export type ErrCode =
  | 'unauthenticated'
  | 'invalid-argument'
  | 'permission-denied'
  | 'not-found'
  | 'already-exists'
  | 'failed-precondition'
  | 'resource-exhausted';

/** Mapped to an HttpsError by the handlers. `reason` is a stable code the UI maps to copy. */
export class CoachError extends Error {
  constructor(
    readonly code: ErrCode,
    readonly reason: string,
  ) {
    super(reason);
    this.name = 'CoachError';
  }
}
const fail = (code: ErrCode, reason: string): never => {
  throw new CoachError(code, reason);
};

export type Role = 'member' | 'trainer' | 'admin';
export interface Actor {
  uid: string;
  role: Role;
}
export interface Ctx {
  kv: Kv;
  now(): number;
  /** >= 32 random bytes (Secret Manager) */
  pepper: Uint8Array;
  newToken(): string;
  /** content-free push: only "something happened" (C.3) */
  notify?(uid: string, kind: 'message' | 'invite' | 'request' | 'program'): Promise<void>;
  baseUrl?: string;
}

const isCoach = (a: Actor) => a.role === 'trainer' || a.role === 'admin';
const str = (x: unknown, max = 200): string => (typeof x === 'string' ? x.slice(0, max) : '');

/* ---- small helpers -------------------------------------------------------------------------------------------- */
interface UserRec {
  role?: Role;
  status?: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string;
  trainerId?: string | null;
}
async function userName(kv: Kv, uid: string): Promise<{ name: string; role: Role | null }> {
  const u = (await kv.get(`users/${uid}`)) as UserRec | null;
  if (!u) return { name: '', role: null };
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || '';
  return { name, role: (u.role as Role) ?? 'member' };
}
export async function notice(
  kv: Kv,
  to: string,
  kind: string,
  actor: string | null,
  now: number,
  id: string,
  detail: string | null = null,
): Promise<void> {
  await kv.set(`users/${to}/notices/${id}`, {
    id,
    kind,
    actor,
    detail,
    createdAt: now,
    readAt: null,
  });
}
export async function loadCoaching(kv: Kv, clientId: string): Promise<CoachingDoc> {
  const c = (await kv.get(`coaching/${clientId}`)) as CoachingDoc | null;
  if (!c) return fail('not-found', 'no-relationship');
  return c;
}
function requireTrainerOf(c: CoachingDoc, a: Actor): void {
  if (!isCoach(a) || c.trainerId !== a.uid) fail('permission-denied', 'not-your-client');
}
const convPath = (cid: string) => `conversations/${cid}`;

/* ---- invites ------------------------------------------------------------------------------------------------- */
export interface InviteResult {
  inviteId: string;
  name: string;
  mode: CoachMode;
  url: string | null;
  sentAt: number;
  expiresAt: number | null;
  /** program-only clients without an account are added at once and have this id */
  clientId?: string;
}

export async function coachInvite(
  ctx: Ctx,
  actor: Actor,
  body: Record<string, unknown>,
): Promise<InviteResult> {
  if (!isCoach(actor)) fail('permission-denied', 'not-a-coach');
  const name = cleanName(body.name);
  if (name.length < 2) fail('invalid-argument', 'invalid-name');
  const mode = body.mode as CoachMode;
  if (!MODES.includes(mode)) fail('invalid-argument', 'invalid-mode');
  let request: Consent;
  try {
    request = effectiveRequest(mode, body.request);
  } catch {
    return fail('invalid-argument', 'invalid-request');
  }
  const now = ctx.now();
  const kv = ctx.kv;

  let target: string | null = null;
  const username = str(body.username, 64).trim().toLowerCase();
  if (username) {
    const ref = (await kv.get(`usernames/${username}`)) as { userId?: string } | null;
    if (!ref?.userId) return fail('not-found', 'no-such-user');
    target = ref.userId;
    if (target === actor.uid) fail('invalid-argument', 'cannot-coach-yourself');
    const ex = (await kv.get(`coaching/${target}`)) as CoachingDoc | null;
    if (ex?.status === 'active') fail('failed-precondition', 'already-has-trainer');
  }

  const own = await kv.list('invites', { where: [['trainerId', '==', actor.uid]] });
  const lim = inviteLimit(
    own.map((r) => r.data as unknown as CoachInviteDoc),
    now,
  );
  if (lim !== 'ok') fail('resource-exhausted', lim);

  // Program-only client without an account: nothing to accept, nothing to share, added at once (R-BE-REL-5).
  if (mode === 'program' && !target) {
    const clientId = `pc-${ctx.newToken().slice(0, 20)}`;
    await kv.tx(async (t) => {
      await createRelationship(ctx, t, {
        clientId,
        trainerId: actor.uid,
        mode,
        consent: { ...ALL_OFF },
        inviteId: null,
      });
    });
    return { inviteId: clientId, name, mode, url: null, sentAt: now, expiresAt: null, clientId };
  }

  const token = ctx.newToken();
  const inv: CoachInviteDoc = {
    kind: 'coach-link',
    token,
    trainerId: actor.uid,
    mode,
    request,
    targetUserId: target,
    displayName: name,
    createdAt: now,
    expiresAt: now + INVITE_TTL,
    claimedAt: null,
    claimedBy: null,
    revokedAt: null,
  };
  await kv.set(`invites/${token}`, inv as unknown as Doc);
  if (target) await ctx.notify?.(target, 'invite');
  return {
    inviteId: token,
    name,
    mode,
    // `<origin>/#/invite/<token>`: the real hosting origin (APP_ORIGIN), the client's own hash route (plan-security B-04)
    url: inviteUrl(ctx.baseUrl, token),
    sentAt: now,
    expiresAt: inv.expiresAt,
  };
}

/** Nothing but what the accept screen needs; the requested levels only for a signed-in viewer (R-BE-REL-2). */
export async function invitePreview(ctx: Ctx, token: unknown, actor?: Actor | null) {
  const t = str(token, 64);
  const inv = t ? ((await ctx.kv.get(`invites/${t}`)) as CoachInviteDoc | null) : null;
  if (!inv || inv.kind !== 'coach-link')
    return { kind: 'link' as const, problem: 'wrong-kind' as const };
  const problem = inviteProblem(inv, ctx.now(), actor?.uid);
  const trainer = await userName(ctx.kv, inv.trainerId);
  return {
    kind: 'link' as const,
    trainerName: trainer.name,
    mode: inv.mode,
    expiresAt: inv.expiresAt,
    problem,
    ...(actor ? { request: inv.request } : {}),
  };
}

export async function coachInviteRevoke(
  ctx: Ctx,
  actor: Actor,
  body: Record<string, unknown>,
): Promise<{ ok: true }> {
  const token = str(body.inviteId, 64);
  const inv = (await ctx.kv.get(`invites/${token}`)) as CoachInviteDoc | null;
  if (!inv || inv.kind !== 'coach-link') return fail('not-found', 'no-such-invite');
  if (inv.trainerId !== actor.uid && actor.role !== 'admin')
    fail('permission-denied', 'not-your-invite');
  if (inv.claimedAt) fail('failed-precondition', 'claimed');
  if (!inv.revokedAt) await ctx.kv.merge(`invites/${token}`, { revokedAt: ctx.now() });
  return { ok: true };
}

/** Client: "no thanks". Revokes the invite so the link is dead for everybody. */
export async function coachDecline(
  ctx: Ctx,
  actor: Actor,
  body: Record<string, unknown>,
): Promise<{ ok: true }> {
  const token = str(body.token, 64);
  const inv = (await ctx.kv.get(`invites/${token}`)) as CoachInviteDoc | null;
  if (!inv || inv.kind !== 'coach-link') return fail('not-found', 'no-such-invite');
  const p = inviteProblem(inv, ctx.now(), actor.uid);
  if (p === 'not-for-you') fail('permission-denied', p);
  if (!p) await ctx.kv.merge(`invites/${token}`, { revokedAt: ctx.now() });
  return { ok: true };
}

interface NewRel {
  clientId: string;
  trainerId: string;
  mode: CoachMode;
  consent: Consent;
  inviteId: string | null;
}
/** One transaction body shared by accept and the program-only path: coaching + users.trainerId + conversation. */
export async function createRelationship(
  ctx: Ctx,
  kv: Kv,
  r: NewRel,
): Promise<{ cid: string; coaching: CoachingDoc }> {
  const now = ctx.now();
  const prev = (await kv.get(`coaching/${r.clientId}`)) as CoachingDoc | null;
  if (prev?.status === 'active') fail('failed-precondition', 'already-has-trainer');
  const cid = conversationId(ctx.pepper, r.clientId, r.trainerId);
  const coaching: CoachingDoc = {
    clientId: r.clientId,
    trainerId: r.trainerId,
    status: 'active',
    mode: r.mode,
    consent: r.mode === 'program' ? { ...ALL_OFF } : r.consent,
    consentVersion: (prev?.consentVersion ?? 0) + 1,
    // a re-link has bumped the epoch at end already; a first link starts at 1
    keyEpoch: Math.max(1, prev?.keyEpoch ?? 1),
    inviteId: r.inviteId,
    createdAt: prev?.createdAt ?? now,
    acceptedAt: now,
    endedAt: null,
    endedBy: null,
    updatedAt: now,
  };
  await kv.set(`coaching/${r.clientId}`, coaching as unknown as Doc);
  if (await kv.get(`users/${r.clientId}`))
    await kv.merge(`users/${r.clientId}`, { trainerId: r.trainerId, updatedAt: now });
  const conv = await kv.get(convPath(cid));
  if (conv) {
    // same pair again: same cid; the ck was removed at end, so a NEW wrap (epoch >= coaching.keyEpoch) is required
    await kv.merge(convPath(cid), {
      active: true,
      trainerId: r.trainerId,
      clientId: r.clientId,
      endedAt: null,
    });
  } else {
    await kv.set(convPath(cid), {
      clientId: r.clientId,
      trainerId: r.trainerId,
      active: true,
      readUpTo: {},
      clearedBefore: {},
      unread: { [r.clientId]: 0, [r.trainerId]: 0 },
      createdAt: now,
      lastAt: null,
      lastFrom: null,
    });
  }
  return { cid, coaching };
}

export async function coachAccept(ctx: Ctx, actor: Actor, body: Record<string, unknown>) {
  const token = str(body.token, 64);
  const now = ctx.now();
  return ctx.kv.tx(async (kv) => {
    const inv = (await kv.get(`invites/${token}`)) as CoachInviteDoc | null;
    const p = inviteProblem(inv, now, actor.uid);
    if (p || !inv) return fail('failed-precondition', p ?? 'wrong-kind');
    if (inv.trainerId === actor.uid) fail('invalid-argument', 'cannot-coach-yourself');
    const trainer = await userName(kv, inv.trainerId);
    if (trainer.role !== 'trainer' && trainer.role !== 'admin')
      fail('failed-precondition', 'trainer-unavailable');
    // a suspended trainer cannot take on a client (their access is paused until an admin lifts it)
    if (((await kv.get(`users/${inv.trainerId}`)) as UserRec | null)?.status === 'suspended')
      fail('failed-precondition', 'trainer-unavailable');
    let consent: Consent;
    try {
      // The client's OWN choice; with no body every level stays off (R-BE-REL-3, R-BE-CON-5).
      consent = parseConsent(body.consent, ALL_OFF);
    } catch {
      return fail('invalid-argument', 'invalid-consent');
    }
    const { cid, coaching } = await createRelationship(ctx, kv, {
      clientId: actor.uid,
      trainerId: inv.trainerId,
      mode: inv.mode,
      consent,
      inviteId: token,
    });
    await kv.merge(`invites/${token}`, { claimedAt: now, claimedBy: actor.uid });
    for (const ch of consentChanges(ALL_OFF, coaching.consent)) {
      const id = `${now}-${ch.category}`;
      await kv.set(`users/${actor.uid}/consentLog/${id}`, {
        id,
        at: now,
        category: ch.category,
        from: ch.from,
        to: ch.to,
        by: 'client',
      });
    }
    // the notice text reads `detail` (the other side's name), same as the "removed" notices below
    const clientName = (await userName(kv, actor.uid)).name;
    await notice(
      kv,
      inv.trainerId,
      'client-assigned',
      actor.uid,
      now,
      `ca-${token}`,
      clientName || null,
    );
    await notice(
      kv,
      actor.uid,
      'trainer-assigned',
      inv.trainerId,
      now,
      `ta-${token}`,
      trainer.name || null,
    );
    return {
      cid,
      trainerId: inv.trainerId,
      mode: coaching.mode,
      consent: coaching.consent,
      consentVersion: coaching.consentVersion,
      keyEpoch: coaching.keyEpoch,
    };
  });
}

/**
 * The caller's own link to a trainer: who it is (display name only), since when, the conversation id and the mode.
 * A client cannot read another user's profile, so this is the one place the trainer's name reaches the client device.
 */
export async function coachMyLink(ctx: Ctx, actor: Actor) {
  const c = (await ctx.kv.get(`coaching/${actor.uid}`)) as CoachingDoc | null;
  if (!c || c.status !== 'active') return { linked: false as const };
  const t = await userName(ctx.kv, c.trainerId);
  return {
    linked: true as const,
    trainer: { id: c.trainerId, name: t.name },
    since: c.acceptedAt,
    cid: conversationId(ctx.pepper, actor.uid, c.trainerId),
    mode: c.mode,
    consentVersion: c.consentVersion,
    keyEpoch: c.keyEpoch,
  };
}

/* ---- ending, mode, consent ------------------------------------------------------------------------------------ */
export async function coachEnd(ctx: Ctx, actor: Actor, body: Record<string, unknown>) {
  const clientId = str(body.clientId, 128);
  if (!isUid(clientId)) fail('invalid-argument', 'bad-client');
  const now = ctx.now();
  return ctx.kv.tx(async (kv) => {
    const c = await loadCoaching(kv, clientId);
    const byClient = actor.uid === clientId;
    const byTrainer = isCoach(actor) && actor.uid === c.trainerId;
    if (!byClient && !byTrainer && actor.role !== 'admin') fail('permission-denied', 'not-allowed');
    if (c.status === 'ended') return { ok: true as const, already: true };
    await endRelationship(
      ctx,
      kv,
      c,
      byClient ? 'client' : byTrainer ? 'trainer' : 'admin',
      actor.uid,
      now,
    );
    return { ok: true as const, already: false };
  });
}

/**
 * The single end-of-relationship body (client, trainer, admin demotion/deletion all use it). Inside a transaction.
 * Removes everything the removed trainer could still hold or reach: the wrapped key and ring, the grant, evidence, the
 * live doc, the per-client plan/schedule documents (sealed under a key that no longer exists for them) and the
 * PLAINTEXT runnable programs `programs/prg-{client}-*` the trainer authored for this client (plan-security B-11).
 */
export async function endRelationship(
  ctx: Ctx,
  kv: Kv,
  c: CoachingDoc,
  endedBy: 'client' | 'trainer' | 'admin',
  actorUid: string,
  now: number,
): Promise<void> {
  const clientId = c.clientId;
  const cid = conversationId(ctx.pepper, clientId, c.trainerId);
  await kv.merge(`coaching/${clientId}`, {
    status: 'ended',
    endedAt: now,
    endedBy,
    keyEpoch: nextEpoch(c.keyEpoch),
    updatedAt: now,
  });
  if (await kv.get(`users/${clientId}`))
    await kv.merge(`users/${clientId}`, { trainerId: null, updatedAt: now });
  // Conversation: inactive and the wrapped key REMOVED, so the removed trainer holds nothing for the next epoch.
  const conv = await kv.get(convPath(cid));
  if (conv) {
    const rest = { ...conv };
    delete rest.ck;
    await kv.set(convPath(cid), { ...rest, active: false, endedAt: now });
    // the wraps of earlier epochs go with it: a trainer who is linked again later starts a new link period
    for (const r of await kv.list(`${convPath(cid)}/keyring`)) await kv.del(r.path);
    // the shared notes are sealed under the conversation key that just went: nobody can read them again, so they go too
    // (the trainer's private notes live under users/{trainer}/clientNotes and are theirs to keep)
    for (const r of await kv.list(`${convPath(cid)}/notes`)) await kv.del(r.path);
    for (const r of await kv.list(`${convPath(cid)}/requests`, {
      where: [['status', '==', 'pending']],
    }))
      await kv.merge(r.path, { status: 'cancelled', decidedAt: now });
  }
  await kv.del(`liveSessions/${clientId}`);
  await kv.del(`users/${clientId}/grants/${c.trainerId}`);
  await deleteEvidence(kv, c.trainerId, clientId, null);
  await deletePerClientDocs(kv, c);
  for (const side of [clientId, c.trainerId]) await kv.del(`rateLimits/${cid}_${side}`);
  // each side is told WHO ended it, by name ("Oleh is no longer your client"): the notice text reads `detail`
  const [clientName, trainerName] = await Promise.all([
    userName(kv, clientId),
    userName(kv, c.trainerId),
  ]);
  await notice(
    kv,
    clientId,
    'trainer-removed',
    actorUid,
    now,
    `tr-${now}`,
    trainerName.name || null,
  );
  await notice(
    kv,
    c.trainerId,
    'client-removed',
    actorUid,
    now,
    `cr-${now}`,
    clientName.name || null,
  );
}

/** schedules/plans of ONE client and the plaintext programs the trainer authored for them (ids `prg-{client}-*`). */
export async function deletePerClientDocs(kv: Kv, c: CoachingDoc): Promise<void> {
  const clientId = c.clientId;
  const prefix = `prg-${clientId}-`;
  const programIds = new Set<string>();
  const plan = await kv.get(`plans/${clientId}`);
  if (typeof plan?.programId === 'string') programIds.add(plan.programId);
  for (const v of await kv.list(`plans/${clientId}/versions`)) {
    if (typeof v.data.programId === 'string') programIds.add(v.data.programId);
    await kv.del(v.path);
  }
  await kv.del(`plans/${clientId}`);
  await kv.del(`schedules/${clientId}`);
  const asg = await kv.get(`assignments/${clientId}`);
  if (typeof asg?.programId === 'string') programIds.add(asg.programId);
  for (const id of programIds) {
    if (!id.startsWith(prefix) || id.includes('/')) continue;
    const prog = await kv.get(`programs/${id}`);
    if (prog && prog.authorId === c.trainerId) await kv.del(`programs/${id}`);
    if (asg?.programId === id) await kv.del(`assignments/${clientId}`);
  }
}

/** Evidence snapshots of one client (R-BE-DEC-9); `cat` = one category or all. Matches on open fields only. */
async function deleteEvidence(
  kv: Kv,
  trainerId: string,
  clientId: string,
  cat: Category | null,
): Promise<number> {
  let n = 0;
  const decisions = await kv.list(`users/${trainerId}/decisions`, {
    where: [['clientId', '==', clientId]],
  });
  for (const d of decisions) {
    for (const e of await kv.list(`${d.path}/evidence`)) {
      if (cat && e.data.category !== cat && e.id !== cat) continue;
      await kv.del(e.path);
      n++;
    }
  }
  return n;
}

export async function setCoachingMode(ctx: Ctx, actor: Actor, body: Record<string, unknown>) {
  const clientId = str(body.clientId, 128);
  const mode = body.mode as CoachMode;
  if (!MODES.includes(mode)) fail('invalid-argument', 'invalid-mode');
  const now = ctx.now();
  return ctx.kv.tx(async (kv) => {
    const c = await loadCoaching(kv, clientId);
    if (c.status !== 'active') fail('failed-precondition', 'not-active');
    const isClient = actor.uid === clientId;
    // A trainer can only REDUCE visibility (program); widening is the client's call (R-BE-REL-6).
    if (!isClient && !(isCoach(actor) && actor.uid === c.trainerId && mode === 'program'))
      fail('permission-denied', 'not-allowed');
    if (mode === c.mode) return { mode, consentVersion: c.consentVersion };
    const patch: Doc = { mode, updatedAt: now };
    let version = c.consentVersion;
    if (mode === 'program') {
      patch.consent = { ...ALL_OFF };
      patch.consentVersion = version = version + 1;
      for (const d of downgrades(consentChanges(c.consent, ALL_OFF)))
        await applyOff(kv, c, d.category);
    }
    await kv.merge(`coaching/${clientId}`, patch);
    return { mode, consentVersion: version };
  });
}

/** To 'off': the derived effects doc and the trainer's evidence of that category go (R-BE-CON-1, R-BE-DEC-9). */
async function applyOff(kv: Kv, c: CoachingDoc, cat: Category): Promise<void> {
  await kv.del(`users/${c.clientId}/shares/${cat}`);
  await deleteEvidence(kv, c.trainerId, c.clientId, cat);
  // the live presence doc is readable by the trainer without a consent check (rules); it exists only under totals, so
  // the server removes it here instead of waiting for the athlete's device to notice (offline, app closed mid-workout)
  if (cat === 'totals') await kv.del(`liveSessions/${c.clientId}`);
}

export async function setConsent(ctx: Ctx, actor: Actor, body: Record<string, unknown>) {
  const clientId = actor.uid;
  const now = ctx.now();
  return ctx.kv.tx(async (kv) => {
    const c = await loadCoaching(kv, clientId);
    if (c.status !== 'active') fail('failed-precondition', 'not-active');
    if (c.mode === 'program') fail('failed-precondition', 'program-mode');
    if (body.consent === undefined && !CATEGORIES.includes(body.category as Category))
      fail('invalid-argument', 'invalid-category');
    let next: Consent;
    try {
      next =
        body.consent !== undefined
          ? parseConsent(body.consent, c.consent)
          : parseConsent({ [body.category as string]: body.level }, c.consent);
    } catch {
      return fail('invalid-argument', 'invalid-level');
    }
    const ch = consentChanges(c.consent, next);
    if (!ch.length) return { consent: c.consent, consentVersion: c.consentVersion };
    const version = c.consentVersion + 1;
    await kv.merge(`coaching/${clientId}`, {
      consent: next,
      consentVersion: version,
      updatedAt: now,
    });
    for (const x of ch) {
      const id = `${now}-${x.category}`;
      await kv.set(`users/${clientId}/consentLog/${id}`, {
        id,
        at: now,
        category: x.category,
        from: x.from,
        to: x.to,
        by: 'client',
      });
    }
    for (const d of downgrades(ch)) {
      if (d.to === 'off') await applyOff(kv, c, d.category);
      else {
        await deleteEvidence(kv, c.trainerId, clientId, d.category); // effects: granular evidence goes
        // the activity list is session-level detail: it exists only at totals `full`
        if (d.category === 'totals') await kv.del(`users/${clientId}/shares/totals`);
      }
    }
    return { consent: next, consentVersion: version };
  });
}

/* ---- reading -------------------------------------------------------------------------------------------------- */
export interface CategoryResult {
  state: 'locked' | 'not-applicable' | 'ok';
  level?: 'effects' | 'full';
  asOf?: number;
  docs?: Doc[];
  view?: unknown;
  /**
   * Sealed derived view the client device published for THIS level (totals at `full`: the activity list). Opened on the
   * trainer's device with the client's grant; never returned below the level that earns it.
   */
  extras?: Doc[];
}

const WORKOUT_OPEN = ['id', 'startedAt', 'finishedAt', 'stats', 'autoFinished'] as const;
const pick = (d: Doc, keys: readonly string[]): Doc =>
  Object.fromEntries(keys.filter((k) => k in d).map((k) => [k, d[k]]));
const weekStart = (at: number): number => {
  const d = new Date(at);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
};

async function readCategory(
  kv: Kv,
  clientId: string,
  cat: Category,
  level: 'effects' | 'full',
  since: number,
): Promise<Pick<CategoryResult, 'docs' | 'view' | 'extras'>> {
  const share = async () => {
    const s = await kv.get(`users/${clientId}/shares/${cat}`);
    return s ? [s] : [];
  };
  if (cat === 'totals') {
    // open fields only: never `exercises` / `enc` (R-BE-CON-3)
    const rows = await kv.list(`users/${clientId}/workouts`, {
      where: [['startedAt', '>=', since]],
      orderBy: ['startedAt', 'desc'],
      limit: 400,
    });
    const open = rows.map((r) => pick({ id: r.id, ...r.data }, WORKOUT_OPEN));
    if (level === 'full') return { docs: open, extras: await share() };
    const weeks = new Map<number, { sessions: number; volumeKg: number; minutes: number }>();
    let last: number | null = null;
    for (const w of open) {
      const at = w.startedAt as number;
      last = last === null ? at : Math.max(last, at);
      const k = weekStart(at);
      const e = weeks.get(k) ?? { sessions: 0, volumeKg: 0, minutes: 0 };
      e.sessions += 1;
      e.volumeKg += Number((w.stats as { volumeKg?: number } | undefined)?.volumeKg ?? 0);
      if (typeof w.finishedAt === 'number') e.minutes += Math.round((w.finishedAt - at) / 60000);
      weeks.set(k, e);
    }
    return {
      view: {
        weeks: [...weeks]
          .sort((a, b) => b[0] - a[0])
          .map(([weekStartAt, v]) => ({ weekStart: weekStartAt, ...v })),
        lastSessionAt: last,
      },
    };
  }
  if (level === 'effects') return { docs: await share() };
  if (cat === 'sets') {
    const rows = await kv.list(`users/${clientId}/workouts`, {
      where: [['startedAt', '>=', since]],
      orderBy: ['startedAt', 'desc'],
      limit: 200,
    });
    return { docs: rows.map((r) => ({ id: r.id, ...r.data })) }; // sealed: the trainer opens them with the grant
  }
  if (cat === 'sleep' || cat === 'injury') {
    const rows = await kv.list(`users/${clientId}/${cat === 'sleep' ? 'sleeps' : 'injuries'}`, {
      limit: 200,
    });
    return { docs: rows.map((r) => ({ id: r.id, ...r.data })) };
  }
  if (cat === 'body' || cat === 'nutrition') {
    const d = await kv.get(`users/${clientId}/meta/${cat}`);
    return { docs: d ? [{ id: cat, ...d }] : [] };
  }
  return { docs: [] }; // checkins: not built in V1 (Q-08)
}

export async function writeAudit(
  kv: Kv,
  a: {
    reader: Actor;
    subject: string;
    cat: Category;
    level: string | null;
    via: ReadVia;
    now: number;
  },
): Promise<void> {
  const id = auditId(a.reader.uid, a.subject, a.cat, a.via, a.now);
  const path = `users/${a.subject}/audit/${id}`;
  const cur = await kv.get(path);
  if (cur) {
    await kv.merge(path, { count: Number(cur.count ?? 1) + 1, lastAt: a.now });
    return;
  }
  const r = await userName(kv, a.reader.uid);
  await kv.set(path, {
    id,
    readerId: a.reader.uid,
    readerName: r.name || null,
    readerRole: a.reader.role,
    subjectId: a.subject,
    resource: `coach:${a.cat}`,
    category: a.cat,
    level: a.level,
    via: a.via,
    count: 1,
    at: a.now,
    lastAt: a.now,
  });
}

const parseVia = (v: unknown, dflt: ReadVia): ReadVia =>
  READ_VIA.includes(v as ReadVia) ? (v as ReadVia) : dflt;

/** The ONE read path for a coach (R-BE-CON-2). Returns only requested categories, each cut by the stored level. */
export async function coachRead(ctx: Ctx, actor: Actor, body: Record<string, unknown>) {
  const clientId = str(body.clientId, 128);
  if (!isUid(clientId)) fail('invalid-argument', 'bad-client');
  const cats = Array.isArray(body.categories) ? (body.categories as unknown[]) : [];
  if (
    !cats.length ||
    cats.length > CATEGORIES.length ||
    !cats.every((c) => CATEGORIES.includes(c as Category))
  )
    fail('invalid-argument', 'invalid-categories');
  const wanted = [...new Set(cats as Category[])];
  const via = parseVia(body.via, 'client360');
  const since = typeof body.since === 'number' && Number.isFinite(body.since) ? body.since : 0;
  const now = ctx.now();
  const kv = ctx.kv;
  const c = await loadCoaching(kv, clientId);
  requireTrainerOf(c, actor);
  if (c.status !== 'active') fail('permission-denied', 'not-active');
  const results: Record<string, CategoryResult> = {};
  for (const cat of wanted) {
    const g = gateCategory(c, cat, now);
    if (g.state !== 'ok') {
      results[cat] = { state: g.state };
      continue;
    }
    const data = await readCategory(kv, clientId, cat, g.level, since);
    results[cat] = { state: 'ok', level: g.level, asOf: now, ...data };
    await kv.tx((t) =>
      writeAudit(t, { reader: actor, subject: clientId, cat, level: g.level, via, now }),
    );
  }
  // Sealed categories are opened on the trainer's device with the client's vault grant (ciphertext for THIS trainer
  // only; the client's rules keep the grant owner-read, so the server hands it over, as `athleteWorkout` does).
  const needsKey = Object.entries(results).some(
    ([k, r]) => r.state === 'ok' && (k !== 'totals' || !!r.extras?.length),
  );
  const grant = needsKey ? await kv.get(`users/${clientId}/grants/${c.trainerId}`) : null;
  return { results, grant, mode: c.mode, consentVersion: c.consentVersion, serverTime: now };
}

/** Reads that never reach the server otherwise (exports from the device cache, chat-share previews). */
export async function logRead(
  ctx: Ctx,
  actor: Actor,
  body: Record<string, unknown>,
): Promise<{ ok: true }> {
  const clientId = str(body.clientId, 128);
  const cat = body.category as Category;
  if (!CATEGORIES.includes(cat)) fail('invalid-argument', 'invalid-category');
  const c = await loadCoaching(ctx.kv, clientId);
  requireTrainerOf(c, actor);
  if (c.status !== 'active') fail('permission-denied', 'not-active');
  const now = ctx.now();
  const g = gateCategory(c, cat, now);
  if (g.state !== 'ok') return { ok: true }; // nothing readable, nothing to log
  await ctx.kv.tx((t) =>
    writeAudit(t, {
      reader: actor,
      subject: clientId,
      cat,
      level: g.level,
      via: parseVia(body.via, 'view'),
      now,
    }),
  );
  return { ok: true };
}

export const MAX_EXPORT_CLIENTS = 100;
export const EXPORT_GRANT_TTL = 5 * 60_000;

/**
 * Server-side export gate (plan-security B-14). A CSV/JSON export may only be produced after this call returned: it
 * checks relationship + consent exactly like `coachRead`, writes the audit entry (`via: 'export'`, one coalesced entry
 * per reader/subject/category/day) BEFORE answering, and fails as a whole when the log cannot be written. So there is
 * no export without a log line, and the client-reported `coachLogRead` stays a secondary record only.
 *
 *   release: true (default)  returns the data like `coachRead` (cut by the stored level) for each client
 *   release: false           returns only the grant `{ exportId, expiresAt, clients: { id: [categories] } }` for exports
 *                            built from the device cache (roster, decisions, Client 360 tables): the client app must obtain
 *                            it BEFORE it writes the file and refuses to export when the call fails
 * A client that is not the caller's, an ended link or a locked category is simply absent from the grant.
 */
export async function coachExport(ctx: Ctx, actor: Actor, body: Record<string, unknown>) {
  if (!isCoach(actor)) fail('permission-denied', 'not-a-coach');
  const raw = Array.isArray(body.clientIds) ? body.clientIds : body.clientId ? [body.clientId] : [];
  const ids = [...new Set(raw.map((x) => str(x, 128)))];
  if (!ids.length || ids.length > MAX_EXPORT_CLIENTS || !ids.every(isUid))
    fail('invalid-argument', 'bad-client');
  const cats = Array.isArray(body.categories) ? (body.categories as unknown[]) : [];
  if (!cats.length || !cats.every((c) => CATEGORIES.includes(c as Category)))
    fail('invalid-argument', 'invalid-categories');
  const wanted = [...new Set(cats as Category[])];
  const now = ctx.now();
  const exportId = `ex-${ctx.newToken()}`;
  if (body.release === false) {
    const clients: Record<string, Category[]> = {};
    for (const clientId of ids) {
      const c = (await ctx.kv.get(`coaching/${clientId}`)) as CoachingDoc | null;
      if (!c || c.trainerId !== actor.uid || c.status !== 'active') continue;
      const ok: Category[] = [];
      for (const cat of wanted) {
        const g = gateCategory(c, cat, now);
        if (g.state !== 'ok') continue;
        await ctx.kv.tx((t) =>
          writeAudit(t, {
            reader: actor,
            subject: clientId,
            cat,
            level: g.level,
            via: 'export',
            now,
          }),
        );
        ok.push(cat);
      }
      if (ok.length) clients[clientId] = ok;
    }
    return { exportId, expiresAt: now + EXPORT_GRANT_TTL, clients, serverTime: now };
  }
  const results: Record<string, unknown> = {};
  for (const clientId of ids) {
    try {
      results[clientId] = await coachRead(ctx, actor, {
        clientId,
        categories: wanted,
        since: body.since,
        via: 'export',
      });
    } catch (e) {
      if (!(e instanceof CoachError)) throw e;
      results[clientId] = { error: e.reason };
    }
  }
  return { exportId, expiresAt: now + EXPORT_GRANT_TTL, results, serverTime: now };
}

export async function coachRoster(ctx: Ctx, actor: Actor) {
  if (!isCoach(actor)) fail('permission-denied', 'not-a-coach');
  const now = ctx.now();
  const rows = await ctx.kv.list('coaching', { where: [['trainerId', '==', actor.uid]] });
  const live = rows
    .map((r) => r.data as unknown as CoachingDoc)
    .filter((c) => c.status !== 'ended');
  // the names are independent reads: ask for all of them at once
  const names = await Promise.all(live.map((c) => userName(ctx.kv, c.clientId)));
  const clients = live.map((c, i) => ({
    clientId: c.clientId,
    name: names[i].name,
    status: c.status,
    mode: c.mode,
    consent: c.consent,
    consentVersion: c.consentVersion,
    keyEpoch: c.keyEpoch,
    cid: conversationId(ctx.pepper, c.clientId, c.trainerId),
  }));
  const invites = (await ctx.kv.list('invites', { where: [['trainerId', '==', actor.uid]] }))
    .map((r) => r.data as unknown as CoachInviteDoc)
    .filter((i) => i.kind === 'coach-link' && !i.claimedAt && !i.revokedAt && i.expiresAt > now)
    .map((i) => ({
      inviteId: i.token,
      name: i.displayName,
      mode: i.mode,
      sentAt: i.createdAt,
      expiresAt: i.expiresAt,
    }));
  return { clients, invites, serverTime: now };
}

/* ---- conversations: unread, purge, rate limit ----------------------------------------------------------------- */
interface MsgDoc {
  from: string;
  at: number;
  deleted?: boolean;
  del?: { state: string };
}

/** Trigger body: recompute lastAt / lastFrom / unread from the OPEN fields of the messages. */
export async function recomputeConversation(ctx: Ctx, cid: string): Promise<{ changed: boolean }> {
  if (!isCid(cid)) return { changed: false };
  const kv = ctx.kv;
  const conv = await kv.get(convPath(cid));
  if (!conv) return { changed: false };
  const msgs = await kv.list(`${convPath(cid)}/messages`, { orderBy: ['at', 'desc'], limit: 500 });
  const open = msgs.map((m) => m.data as unknown as MsgDoc);
  const last = open.find((m) => !m.deleted && m.del?.state !== 'pending');
  const patch: Doc = {
    unread: unreadMap(conv as never, open),
    lastAt: last?.at ?? null,
    lastFrom: last ? (last.from === conv.clientId ? 'client' : 'trainer') : null,
  };
  const same =
    JSON.stringify([conv.unread, conv.lastAt ?? null, conv.lastFrom ?? null]) ===
    JSON.stringify([patch.unread, patch.lastAt, patch.lastFrom]);
  if (same) return { changed: false };
  await kv.merge(convPath(cid), patch);
  return { changed: true };
}

/**
 * Per-sender flood limit (C.3). The count uses SERVER time, never the client-chosen `at`: each sender has a counter doc
 * `rateLimits/{cid}_{uid}` mapping message id -> the server time at which this trigger first saw it (idempotent for a
 * retried trigger). Over the limit the NEWEST message is removed, not counted and not notified. A sender who stamps `at`
 * in the past gains nothing (the rules also bound `at` to +-2 min of request time).
 */
export async function enforceMessageRate(
  ctx: Ctx,
  cid: string,
  mid: string,
): Promise<'ok' | 'removed'> {
  const msgPath = `${convPath(cid)}/messages/${mid}`;
  const m = (await ctx.kv.get(msgPath)) as { from?: string } | null;
  if (!m?.from || typeof m.from !== 'string' || m.from.includes('/')) return 'ok';
  const path = `rateLimits/${cid}_${m.from}`;
  const now = ctx.now();
  return ctx.kv.tx(async (t) => {
    const cur = await t.get(path);
    const prev = (cur?.hits ?? {}) as Record<string, number>;
    const hits: Record<string, number> = {};
    for (const [id, at] of Object.entries(prev))
      if (typeof at === 'number' && at > now - 60_000) hits[id] = at;
    if (mid in hits) return 'ok' as const; // a retried trigger: already counted
    if (rateLimited([...Object.values(hits), now], now)) {
      await t.del(msgPath);
      if (cur) await t.set(path, { hits, updatedAt: now });
      return 'removed' as const;
    }
    hits[mid] = now;
    await t.set(path, { hits, updatedAt: now });
    return 'ok' as const;
  });
}

/** After a new message: rate check, unread, and a content-free push ("New message", never text or name; C.3). */
export async function afterMessageCreated(ctx: Ctx, cid: string, mid: string): Promise<void> {
  if ((await enforceMessageRate(ctx, cid, mid)) === 'removed') {
    await recomputeConversation(ctx, cid);
    return;
  }
  await recomputeConversation(ctx, cid);
  const conv = await ctx.kv.get(convPath(cid));
  const m = await ctx.kv.get(`${convPath(cid)}/messages/${mid}`);
  if (!conv || !m || conv.active !== true) return;
  const to = m.from === conv.clientId ? (conv.trainerId as string) : (conv.clientId as string);
  await ctx.notify?.(to, 'message');
}

export interface SweepResult {
  requestsExpired: number;
  messagesTombstoned: number;
  notesPurged: number;
  auditDeleted: number;
  rotationFlagged: number;
  rateLimitsPurged: number;
}

/** The hourly job: request expiry, straggling deletes, audit retention, 90-day key rotation flags. */
export async function sweep(ctx: Ctx): Promise<SweepResult> {
  const kv = ctx.kv;
  const now = ctx.now();
  const out: SweepResult = {
    requestsExpired: 0,
    messagesTombstoned: 0,
    notesPurged: 0,
    auditDeleted: 0,
    rotationFlagged: 0,
    rateLimitsPurged: 0,
  };

  const pending = await kv.group('requests', {
    where: [
      ['status', '==', 'pending'],
      ['expiresAt', '<=', now],
    ],
    limit: 400,
  });
  const due = pending.map((p) => ({
    path: p.path,
    status: p.data.status as ReqStatus,
    expiresAt: Number(p.data.expiresAt),
  }));
  for (const r of expiredRequests(due, now)) {
    await kv.merge(r.path, { status: 'expired', decidedAt: now });
    out.requestsExpired++;
  }

  // The client commits its own delete after 8 s; this catches closed tabs. The ciphertext is physically dropped.
  const dels = await kv.group('messages', {
    where: [
      ['del.state', '==', 'pending'],
      ['del.at', '<=', now - UNDO_GRACE],
    ],
    limit: 400,
  });
  for (const m of dels) {
    const d = m.data;
    await kv.set(m.path, {
      id: d.id,
      from: d.from,
      at: d.at,
      v: d.v,
      keyEpoch: d.keyEpoch,
      deleted: true,
      deletedAt: now,
    });
    out.messagesTombstoned++;
  }
  const noteDels = await kv.group('notes', {
    where: [
      ['del.state', '==', 'pending'],
      ['del.at', '<=', now - UNDO_GRACE],
    ],
    limit: 400,
  });
  for (const n of noteDels) {
    await kv.del(n.path);
    out.notesPurged++;
  }

  const old = await kv.group('audit', { where: [['at', '<', now - AUDIT_RETENTION]], limit: 400 });
  for (const a of old) {
    await kv.del(a.path);
    out.auditDeleted++;
  }

  const stale = await kv.list('rateLimits', { where: [['updatedAt', '<', now - DAY]], limit: 400 });
  for (const r of stale) {
    await kv.del(r.path);
    out.rateLimitsPurged++;
  }

  const convs = await kv.list('conversations', { where: [['active', '==', true]], limit: 400 });
  for (const c of convs) {
    if (c.data.rotateDue === true) continue;
    const since = Number(c.data.rotatedAt ?? c.data.createdAt ?? now);
    if (rotationDue(since, now)) {
      await kv.merge(c.path, { rotateDue: true });
      out.rotationFlagged++;
    }
  }
  return out;
}

/**
 * Conversation write trigger: a newly published key epoch clears the rotation flags and stamps `rotatedAt`; a re-wrap of
 * the SAME epoch for a new trainer key (a different wrap fingerprint) clears `keyStale`, which is what it was asked for.
 */
export async function onConversationKey(
  ctx: Ctx,
  cid: string,
  before: Doc | null,
  after: Doc | null,
): Promise<boolean> {
  if (!after) return false;
  if (Number(after.keyEpoch ?? 0) > Number(before?.keyEpoch ?? 0)) {
    await ctx.kv.merge(convPath(cid), { rotatedAt: ctx.now(), rotateDue: false, keyStale: false });
    return true;
  }
  const fp = (d: Doc | null): unknown => (d?.ck as { fp?: unknown } | undefined)?.fp;
  if (after.keyStale === true && fp(after) !== undefined && fp(after) !== fp(before)) {
    await ctx.kv.merge(convPath(cid), { keyStale: false });
    return true;
  }
  return false;
}

/** Trainer key changed: flag every active conversation so the client device re-wraps (only after the signature verifies). */
export async function onCoachKeyChanged(
  ctx: Ctx,
  trainerId: string,
  before: Doc | null,
  after: Doc | null,
): Promise<number> {
  if (!after) return 0;
  const fp = (k: Doc | null) => (k?.pub ? keyFingerprint(k.pub as never) : null);
  if (fp(before) === fp(after)) return 0;
  const convs = await ctx.kv.list('conversations', {
    where: [
      ['trainerId', '==', trainerId],
      ['active', '==', true],
    ],
  });
  for (const c of convs) await ctx.kv.merge(c.path, { keyStale: true });
  return convs.length;
}

/** "Reset secure chat" / suspected device loss: sets the flag the client device acts on (new epoch, new CK). */
export async function chatResetKey(ctx: Ctx, actor: Actor, body: Record<string, unknown>) {
  const cid = str(body.cid, 40);
  if (!isCid(cid)) fail('invalid-argument', 'bad-cid');
  const conv = await ctx.kv.get(convPath(cid));
  if (!conv || conv.clientId !== actor.uid) return fail('permission-denied', 'not-allowed');
  await ctx.kv.merge(convPath(cid), { rotateDue: true });
  return { ok: true as const };
}

/* ---- reschedule requests -------------------------------------------------------------------------------------- */
async function partyOf(
  kv: Kv,
  clientId: string,
  actor: Actor,
): Promise<{ side: 'client' | 'trainer'; c: CoachingDoc }> {
  const c = await loadCoaching(kv, clientId);
  if (c.status !== 'active') fail('failed-precondition', 'not-active');
  const side =
    actor.uid === clientId
      ? 'client'
      : isCoach(actor) && actor.uid === c.trainerId
        ? 'trainer'
        : null;
  if (!side) return fail('permission-denied', 'not-allowed');
  return { side, c };
}

const REQUEST_KEYS = [
  'id',
  'from',
  'status',
  'createdAt',
  'decidedAt',
  'expiresAt',
  'slotKey',
  'supersedes',
  'keyEpoch',
  'enc',
];

/**
 * The requester seals the content; this validates the OPEN fields only (it never holds a key): active relationship,
 * requester side, window, ttl <= 14 d and ONE pending request per slotKey. Idempotent by id.
 */
export async function rescheduleCreate(ctx: Ctx, actor: Actor, body: Record<string, unknown>) {
  const clientId = str(body.clientId, 128);
  const raw = (body.request ?? {}) as Doc;
  const now = ctx.now();
  return ctx.kv.tx(async (kv) => {
    const { side, c } = await partyOf(kv, clientId, actor);
    const cid = conversationId(ctx.pepper, clientId, c.trainerId);
    // the id becomes a path segment: exactly the allowed alphabet, never truncated, never a '/'
    const id = typeof raw.id === 'string' && REQUEST_ID.test(raw.id) ? raw.id : '';
    if (!id || raw.from !== side) fail('invalid-argument', 'bad-request');
    if (Object.keys(raw).some((k) => !REQUEST_KEYS.includes(k)))
      fail('invalid-argument', 'unknown-field');
    if (raw.status !== 'pending' || 'decidedAt' in raw) fail('invalid-argument', 'bad-status');
    if (
      raw.supersedes !== undefined &&
      !(typeof raw.supersedes === 'string' && REQUEST_ID.test(raw.supersedes))
    )
      fail('invalid-argument', 'bad-request');
    // same shape and cap as the rules' `sealedCk`: { v, iv, ct } only, bounded; no plaintext sibling can ride along
    const envProblem = ckEnvelopeProblem(raw.enc);
    if (envProblem)
      fail('invalid-argument', envProblem === 'too-large' ? 'too-large' : 'not-sealed');
    if (!Number.isInteger(raw.keyEpoch) || (raw.keyEpoch as number) < 1)
      fail('invalid-argument', 'not-sealed');
    const convKey = Number((await kv.get(convPath(cid)))?.keyEpoch ?? 0);
    if (convKey > 0 && raw.keyEpoch !== convKey) fail('failed-precondition', 'stale-epoch');
    const existing = await kv.list(`${convPath(cid)}/requests`);
    if (existing.some((e) => e.id === id)) return { id, already: true as const };
    if (existing.filter((e) => e.data.status === 'pending').length >= MAX_PENDING_REQUESTS)
      fail('resource-exhausted', 'too-many-requests');
    const p = requestProblem(
      {
        createdAt: Number(raw.createdAt),
        expiresAt: Number(raw.expiresAt),
        slotKey: String(raw.slotKey),
      },
      now,
      existing.map((e) => ({
        slotKey: String(e.data.slotKey),
        status: e.data.status as ReqStatus,
      })),
    );
    if (p) return fail(p === 'duplicate-slot' ? 'already-exists' : 'invalid-argument', p);
    await kv.set(`${convPath(cid)}/requests/${id}`, raw);
    await ctx.notify?.(side === 'client' ? c.trainerId : clientId, 'request');
    return { id, already: false as const };
  });
}

export async function rescheduleRespond(ctx: Ctx, actor: Actor, body: Record<string, unknown>) {
  const clientId = str(body.clientId, 128);
  const id = str(body.id, 80);
  const to = body.status as ReqStatus;
  const now = ctx.now();
  return ctx.kv.tx(async (kv) => {
    const { side, c } = await partyOf(kv, clientId, actor);
    const path = `${convPath(conversationId(ctx.pepper, clientId, c.trainerId))}/requests/${id}`;
    const r = await kv.get(path);
    if (!r) return fail('not-found', 'no-such-request');
    // an answer that comes too late says so (the sweep may already have flipped the stored status to `expired`)
    if (r.status === 'expired' || (r.status === 'pending' && Number(r.expiresAt) <= now))
      fail('failed-precondition', 'expired');
    if (
      !canDecide({ from: r.from as 'client' | 'trainer', status: r.status as ReqStatus }, side, to)
    )
      fail('failed-precondition', 'cannot-decide');
    await kv.merge(path, { status: to, decidedAt: now });
    return { id, status: to };
  });
}

/* ---- trainer key signature (C.2 no. 5) ------------------------------------------------------------------------ */
/** Canonical string the server signs for a coach key. Pure, so the client verifies the very same bytes. */
export const coachKeySigPayload = (
  uid: string,
  fp: string,
  updatedAt: number,
  kid: string,
): string => `coachkey|1|${kid}|${uid}|${fp}|${updatedAt}`;

export interface Signer {
  kid: string;
  sign(payload: string): string;
}
export async function coachKeySign(ctx: Ctx, actor: Actor, signer: Signer) {
  if (!isCoach(actor)) fail('permission-denied', 'not-a-coach');
  const k = await ctx.kv.get(`coachKeys/${actor.uid}`);
  const pub = k?.pub as { kty?: string; crv?: string; x?: string; y?: string } | undefined;
  if (
    !k ||
    !pub ||
    pub.kty !== 'EC' ||
    pub.crv !== 'P-256' ||
    typeof pub.x !== 'string' ||
    typeof pub.y !== 'string'
  )
    return fail('failed-precondition', 'no-public-key');
  const fp = keyFingerprint(pub);
  const sig = signer.sign(coachKeySigPayload(actor.uid, fp, Number(k.updatedAt), signer.kid));
  await ctx.kv.merge(`coachKeys/${actor.uid}`, { sig, kid: signer.kid, signedAt: ctx.now() });
  return { fp, sig, kid: signer.kid };
}

/* ---- plan versions (R-BE-PRG-9) ---------------------------------------------------------------------------- */
/**
 * Atomic publish of a draft version: the active trainer only, `n == liveVersion + 1`, the previous live version is
 * superseded, the assignment points at the version's program, and ONE unread "program-updated" notice is kept.
 */
export async function publishPlanVersion(ctx: Ctx, actor: Actor, body: Record<string, unknown>) {
  const clientId = str(body.clientId, 128);
  const n = body.n;
  if (!isUid(clientId) || !Number.isInteger(n) || (n as number) < 1)
    fail('invalid-argument', 'bad-version');
  const ver = n as number;
  const now = ctx.now();
  const published = await ctx.kv.tx(async (kv) => {
    const c = await loadCoaching(kv, clientId);
    requireTrainerOf(c, actor);
    if (c.status !== 'active') fail('failed-precondition', 'not-active');
    const plan = await kv.get(`plans/${clientId}`);
    if (!plan) return fail('not-found', 'no-plan');
    const live = Number(plan.liveVersion ?? 0);
    if (ver !== live + 1) fail('failed-precondition', 'version-order');
    const v = await kv.get(`plans/${clientId}/versions/${ver}`);
    if (!v) return fail('not-found', 'no-such-version');
    if (v.state !== 'draft') fail('failed-precondition', 'not-a-draft');
    // The runnable program of this version (written by the trainer's device before Send, template level, no targets):
    // it must exist and be the trainer's own, otherwise the member could not start a session from the plan.
    const programId = str(v.programId, 200);
    const prog = await kv.get(`programs/${programId}`);
    if (!prog) return fail('failed-precondition', 'no-program');
    if (prog.authorId !== actor.uid) fail('permission-denied', 'program-not-yours');
    if (live > 0) await kv.merge(`plans/${clientId}/versions/${live}`, { state: 'superseded' });
    await kv.merge(`plans/${clientId}/versions/${ver}`, { state: 'live', publishedAt: now });
    await kv.merge(`plans/${clientId}`, {
      liveVersion: ver,
      programId: v.programId,
      rev: Number(plan.rev ?? 0) + 1,
      updatedAt: now,
    });
    // Program becomes runnable and the member's assignment moves to it in this same transaction (as `assignProgram`
    // does for a plain program). A continuing plan keeps `startedAt` so adherence does not restart at every version.
    await kv.merge(`programs/${programId}`, { status: 'active', updatedAt: now });
    const asg = await kv.get(`assignments/${clientId}`);
    const continuing =
      !!asg && asg.assignedBy === actor.uid && Number.isFinite(Number(asg.startedAt));
    await kv.set(`assignments/${clientId}`, {
      memberId: clientId,
      programId,
      assignedBy: actor.uid,
      startedAt: continuing ? Number(asg.startedAt) : now,
    });
    // one unread notice per client: a newer publish replaces the older one (same id)
    const nid = `pu-${clientId}`;
    await kv.set(`users/${clientId}/notices/${nid}`, {
      id: nid,
      kind: 'program-updated',
      actor: actor.uid,
      detail: null,
      ref: { cid: conversationId(ctx.pepper, clientId, c.trainerId), version: ver },
      createdAt: now,
      readAt: null,
    });
    return { liveVersion: ver };
  });
  // content-free push ("Program updated"), only after the publish committed; a failed push never fails it
  await ctx.notify?.(clientId, 'program');
  return published;
}

/**
 * The member tells the trainer a published version was opened: one notice per client in the TRAINER's inbox
 * (`pa-{clientId}`, replaced by a newer version), read by the trainer's program tab ("Seen by Oleh"). Only open facts
 * (which version, when); idempotent; the member can only report a version that is live.
 */
export async function programAck(ctx: Ctx, actor: Actor, body: Record<string, unknown>) {
  const version = body.version;
  if (!Number.isInteger(version) || (version as number) < 1)
    fail('invalid-argument', 'bad-version');
  const now = ctx.now();
  return ctx.kv.tx(async (kv) => {
    const c = await loadCoaching(kv, actor.uid);
    if (c.status !== 'active') fail('failed-precondition', 'not-active');
    const plan = await kv.get(`plans/${actor.uid}`);
    if (!plan || Number(plan.liveVersion ?? 0) < (version as number))
      return fail('failed-precondition', 'version-order');
    const id = `pa-${actor.uid}`;
    const cur = await kv.get(`users/${c.trainerId}/notices/${id}`);
    if (
      cur &&
      Number((cur.ref as { version?: unknown } | undefined)?.version) >= (version as number)
    )
      return { ok: true as const, already: true as const };
    await kv.set(`users/${c.trainerId}/notices/${id}`, {
      id,
      kind: 'program-seen',
      actor: actor.uid,
      detail: null,
      ref: { version: version as number },
      createdAt: now,
      readAt: null,
    });
    return { ok: true as const, already: false as const };
  });
}

/**
 * Retired plaintext trainer notes (`trainerAddNote`, plan-security B-01). The callable now stores only a note sealed on the
 * trainer's device with the conversation key (same shape, AAD inputs and caps as `conversations/{cid}/notes` in the rules)
 * and refuses any `text`. The server validates the open fields and the envelope; it never holds a key.
 */
export async function addSealedNote(ctx: Ctx, actor: Actor, body: Record<string, unknown>) {
  const clientId = str(body.id, 128);
  if (!isUid(clientId)) fail('invalid-argument', 'bad-client');
  if ('text' in body) fail('failed-precondition', 'use-sealed-notes');
  const noteId = typeof body.noteId === 'string' && REQUEST_ID.test(body.noteId) ? body.noteId : '';
  if (!noteId) fail('invalid-argument', 'bad-note');
  const problem = ckEnvelopeProblem(body.enc);
  if (problem) fail('invalid-argument', problem === 'too-large' ? 'too-large' : 'not-sealed');
  const now = ctx.now();
  const at = body.at;
  if (!Number.isInteger(at) || Math.abs((at as number) - now) > MAX_AT_SKEW)
    fail('invalid-argument', 'bad-time');
  return ctx.kv.tx(async (kv) => {
    const c = await loadCoaching(kv, clientId);
    requireTrainerOf(c, actor);
    if (c.status !== 'active') fail('failed-precondition', 'not-active');
    const cid = conversationId(ctx.pepper, clientId, c.trainerId);
    const conv = await kv.get(convPath(cid));
    const epoch = Number(conv?.keyEpoch ?? 0);
    if (!conv || epoch < 1 || body.keyEpoch !== epoch) fail('failed-precondition', 'stale-epoch');
    const path = `${convPath(cid)}/notes/${noteId}`;
    if (await kv.get(path)) return { ok: true as const, id: noteId, already: true };
    await kv.set(path, {
      id: noteId,
      by: actor.uid,
      at,
      updatedAt: at,
      keyEpoch: epoch,
      enc: body.enc,
    });
    return { ok: true as const, id: noteId, already: false };
  });
}

/* ---- device signing keys (C.2 no. 7) ----------------------------------------------------------------------- */
export const MAX_SIGN_KEYS = 10;
/** The server signs "this uid owns this device key" so a receiver never trusts an unsigned directory entry. */
export const signKeySigPayload = (
  srvKid: string,
  uid: string,
  kid: string,
  publicRaw: string,
): string => `signkey|1|${srvKid}|${uid}|${kid}|${publicRaw}`;

/** Publishes the caller's device signing key (uncompressed P-256 point, base64) under a server signature. */
export async function publishSignKey(
  ctx: Ctx,
  actor: Actor,
  body: Record<string, unknown>,
  signer: Signer,
) {
  const kid = str(body.kid, 40);
  const publicRaw = str(body.publicRaw, 200);
  if (!/^[0-9a-f]{16}$/.test(kid)) fail('invalid-argument', 'bad-kid');
  if (!/^[A-Za-z0-9+/]{87}=$/.test(publicRaw)) fail('invalid-argument', 'bad-key'); // 65 bytes
  if (Buffer.from(publicRaw, 'base64')[0] !== 4) fail('invalid-argument', 'bad-key'); // uncompressed point
  const now = ctx.now();
  return ctx.kv.tx(async (kv) => {
    const own = await kv.list(`signKeys/${actor.uid}/keys`, { orderBy: ['createdAt', 'asc'] });
    const existing = own.find((r) => r.id === kid);
    if (existing && existing.data.publicRaw !== publicRaw) fail('already-exists', 'kid-taken');
    if (!existing) {
      // keep the newest MAX_SIGN_KEYS - 1 so the new one fits
      for (const old of own.slice(0, Math.max(0, own.length - (MAX_SIGN_KEYS - 1))))
        await kv.del(old.path);
    }
    const sig = signer.sign(signKeySigPayload(signer.kid, actor.uid, kid, publicRaw));
    await kv.set(`signKeys/${actor.uid}/keys/${kid}`, {
      uid: actor.uid,
      kid,
      publicRaw,
      createdAt: existing ? Number(existing.data.createdAt) : now,
      sig,
      srvKid: signer.kid,
    });
    return { kid, sig, srvKid: signer.kid };
  });
}
