/**
 * Account lifecycle for coaching (plan-security B-02, B-08, B-01 admin path, Q-19): role change, deletion cascade,
 * admin trainer assignment through the invite/accept model, and the legacy `users.trainerId` backfill. All on the `Kv`
 * seam so every rule runs in unit tests; `admin.ts` binds them to Firestore and to Auth (`revokeRefreshTokens`).
 */
import type { Kv } from './kv';
import {
  createRelationship,
  deletePerClientDocs,
  endRelationship,
  notice,
  CoachError,
  type Actor,
  type Ctx,
} from './service';
import { ALL_OFF, INVITE_TTL, isUid, type CoachInviteDoc, type CoachingDoc } from './logic';

const fail = (code: ConstructorParameters<typeof CoachError>[0], reason: string): never => {
  throw new CoachError(code, reason);
};

interface UserRec {
  role?: string;
  status?: string;
  trainerId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string;
}
const isCoachRole = (r: unknown): boolean => r === 'trainer' || r === 'admin';
const nameOf = (u: UserRec | null): string =>
  [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.username || '';

/* ---- role change / suspension ------------------------------------------------------------------------------------ */
/**
 * A user lost coach rights (demoted to member, or deleted). Every ACTIVE relationship they hold as the trainer ends
 * now (same body as `coachEnd`: key removed, grant/evidence/live/plan/programs gone, both sides get a notice), so no
 * stale custom-token claim and no stale `coaching` doc can keep a path to a client's data open. A SUSPENSION does not
 * end anything: the rules (`freshCoach()`), `requireRole` and `coachRead` all refuse a suspended trainer immediately
 * and the relationship resumes when an admin lifts it. Returns how many relationships ended.
 */
export async function endTrainerRelationships(
  ctx: Ctx,
  trainerId: string,
  endedBy: 'admin' | 'trainer' = 'admin',
): Promise<number> {
  const rows = await ctx.kv.list('coaching', {
    where: [
      ['trainerId', '==', trainerId],
      ['status', '==', 'active'],
    ],
  });
  let n = 0;
  for (const r of rows) {
    const clientId = r.id;
    await ctx.kv.tx(async (kv) => {
      const c = (await kv.get(`coaching/${clientId}`)) as CoachingDoc | null;
      if (!c || c.status !== 'active' || c.trainerId !== trainerId) return;
      await endRelationship(ctx, kv, c, endedBy, trainerId, ctx.now());
      n++;
    });
  }
  return n;
}

/* ---- deletion cascade -------------------------------------------------------------------------------------------- */
export interface PurgeReport {
  ended: number;
  conversations: number;
  docs: number;
}

async function delAll(kv: Kv, coll: string, rep: PurgeReport): Promise<void> {
  for (const r of await kv.list(coll)) {
    await kv.del(r.path);
    rep.docs++;
  }
}

/**
 * Everything coaching about `uid` (client AND trainer side), per plan-security C.3 "account deletion deletes
 * conversations, schedules, plans, programs prg-*, live docs, keys, keyring, requests, audit per policy":
 *  - active relationships end first (notices, grants, evidence, wrapped keys, plan/schedule/prg-* program docs);
 *  - conversations of every pair the user was ever in, with messages, shared notes, requests, keyring and rate counters;
 *  - the trainer's PRIVATE notes and decisions (with evidence) about the deleted client;
 *  - coaching docs (+summary), coach public key, device signing keys, live doc, invites by or for the user.
 * Kept on purpose: the `audit` entries other users hold ("who read my data", denormalised reader name, 400-day retention)
 * and `consentLog` of OTHER users; they are those users' own records.
 */
export async function purgeAccountCoaching(ctx: Ctx, uid: string): Promise<PurgeReport> {
  if (!isUid(uid)) fail('invalid-argument', 'bad-user');
  const kv = ctx.kv;
  const rep: PurgeReport = { ended: 0, conversations: 0, docs: 0 };

  rep.ended += await endTrainerRelationships(ctx, uid, 'admin');
  const mine = (await kv.get(`coaching/${uid}`)) as CoachingDoc | null;
  if (mine?.status === 'active') {
    await kv.tx((t) => endRelationship(ctx, t, mine, 'admin', uid, ctx.now()));
    rep.ended++;
  }

  const trainersOfClient = new Set<string>();
  const convs = new Map<string, { path: string; clientId: string; trainerId: string }>();
  for (const q of [
    await kv.list('conversations', { where: [['clientId', '==', uid]] }),
    await kv.list('conversations', { where: [['trainerId', '==', uid]] }),
  ])
    for (const r of q)
      convs.set(r.id, {
        path: r.path,
        clientId: String(r.data.clientId),
        trainerId: String(r.data.trainerId),
      });
  for (const [cid, c] of convs) {
    if (c.clientId === uid) trainersOfClient.add(c.trainerId);
    for (const sub of ['messages', 'notes', 'requests', 'keyring'])
      await delAll(kv, `${c.path}/${sub}`, rep);
    await kv.del(`rateLimits/${cid}_${c.clientId}`);
    await kv.del(`rateLimits/${cid}_${c.trainerId}`);
    await kv.del(c.path);
    rep.conversations++;
  }
  if (mine) trainersOfClient.add(mine.trainerId);

  // the trainer's private records ABOUT this client (sealed under the trainer's own key, but they name the person)
  for (const tid of trainersOfClient) {
    if (!isUid(tid) || tid === uid) continue;
    for (const n of await kv.list(`users/${tid}/clientNotes`, {
      where: [['clientId', '==', uid]],
    })) {
      await kv.del(n.path);
      rep.docs++;
    }
    for (const d of await kv.list(`users/${tid}/decisions`, { where: [['clientId', '==', uid]] })) {
      await delAll(kv, `${d.path}/evidence`, rep);
      await kv.del(d.path);
      rep.docs++;
    }
  }

  // coaching docs: as client (any status) and as trainer (the client keeps no pointer at a deleted trainer)
  if (mine) {
    await deletePerClientDocs(kv, mine); // survivors of a relationship that ended before this cascade existed
    await delAll(kv, `coaching/${uid}/summary`, rep);
    await kv.del(`coaching/${uid}`);
  }
  for (const r of await kv.list('coaching', { where: [['trainerId', '==', uid]] })) {
    await delAll(kv, `${r.path}/summary`, rep);
    await kv.del(r.path);
    rep.docs++;
  }

  for (const p of [`schedules/${uid}`, `plans/${uid}`, `liveSessions/${uid}`, `coachKeys/${uid}`])
    await kv.del(p);
  await delAll(kv, `plans/${uid}/versions`, rep);
  await delAll(kv, `signKeys/${uid}/keys`, rep);

  for (const field of ['trainerId', 'targetUserId'] as const)
    for (const r of await kv.list('invites', { where: [[field, '==', uid]] })) {
      await kv.del(r.path);
      rep.docs++;
    }
  return rep;
}

/* ---- admin assigns a trainer: through the invite/accept model ---------------------------------------------------- */
export interface AssignResult {
  ok: true;
  /** the client has to accept (and chooses what to share): nothing is linked yet */
  pending?: true;
  inviteId?: string;
  ended?: boolean;
  already?: boolean;
}

/**
 * Replaces the old `users.trainerId` write (plan-security B-01: a relationship with no consent and no coaching doc).
 * `trainerId: null` ends the active relationship; otherwise the previous relationship (if any) ends and a TARGETED invite
 * for that client is created. The client accepts and decides the consent levels exactly like any other link; nothing
 * becomes readable by the trainer before that. Idempotent: an open invite for the same pair is returned again.
 */
export async function adminAssignTrainer(
  ctx: Ctx,
  actor: Actor,
  body: Record<string, unknown>,
): Promise<AssignResult> {
  if (actor.role !== 'admin') fail('permission-denied', 'not-allowed');
  const id = typeof body.id === 'string' ? body.id : '';
  const trainerId = typeof body.trainerId === 'string' && body.trainerId ? body.trainerId : null;
  if (!isUid(id)) fail('invalid-argument', 'bad-client');
  const kv = ctx.kv;
  const user = (await kv.get(`users/${id}`)) as UserRec | null;
  if (!user) return fail('not-found', 'no-such-user');
  const now = ctx.now();
  const cur = (await kv.get(`coaching/${id}`)) as CoachingDoc | null;
  const active = cur?.status === 'active' ? cur : null;

  if (trainerId === null) {
    if (!active) {
      // a legacy pointer without a coaching doc: just clear it
      if (user.trainerId) await kv.merge(`users/${id}`, { trainerId: null, updatedAt: now });
      return { ok: true, ended: false };
    }
    await kv.tx((t) => endRelationship(ctx, t, active, 'admin', actor.uid, now));
    return { ok: true, ended: true };
  }
  if (!isUid(trainerId) || trainerId === id) fail('invalid-argument', 'bad-trainer');
  const tr = (await kv.get(`users/${trainerId}`)) as UserRec | null;
  if (!tr || !isCoachRole(tr.role) || tr.status === 'suspended')
    fail('failed-precondition', 'trainer-unavailable');
  if (active?.trainerId === trainerId) return { ok: true, already: true };
  if (active) await kv.tx((t) => endRelationship(ctx, t, active, 'admin', actor.uid, now));

  const open = (await kv.list('invites', { where: [['trainerId', '==', trainerId]] })).find((r) => {
    const i = r.data as unknown as CoachInviteDoc;
    return (
      i.kind === 'coach-link' &&
      i.targetUserId === id &&
      !i.claimedAt &&
      !i.revokedAt &&
      i.expiresAt > now
    );
  });
  if (open) return { ok: true, pending: true, inviteId: open.id };

  const token = ctx.newToken();
  const inv: CoachInviteDoc & { assignedBy: string } = {
    kind: 'coach-link',
    token,
    trainerId,
    mode: 'app',
    request: { ...ALL_OFF },
    targetUserId: id,
    displayName: nameOf(user) || 'Client',
    createdAt: now,
    expiresAt: now + INVITE_TTL,
    claimedAt: null,
    claimedBy: null,
    revokedAt: null,
    assignedBy: actor.uid,
  };
  await kv.set(`invites/${token}`, inv as unknown as Record<string, unknown>);
  await ctx.notify?.(id, 'invite');
  return { ok: true, pending: true, inviteId: token };
}

/* ---- Q-19: backfill from legacy users.trainerId ----------------------------------------------------------------- */
export type MigrateOutcome =
  | 'created'
  | 'already-linked'
  | 'reconciled'
  | 'trainer-unavailable'
  | 'client-suspended'
  | 'self'
  | 'bad-pointer';

export interface MigrateReport {
  dryRun: boolean;
  scanned: number;
  counts: Record<MigrateOutcome, number>;
  /** user id + outcome only (no names, no content), capped */
  items: { id: string; outcome: MigrateOutcome }[];
  /** pass back as `after` to continue; null when the scan reached the end */
  next: string | null;
}

/** One legacy pointer -> the new model, inside the caller's transaction (shared by the admin backfill and self-service adoption). */
async function migrateOne(
  ctx: Ctx,
  kv: Kv,
  clientId: string,
  u: UserRec,
  tid: string,
  dryRun: boolean,
): Promise<MigrateOutcome> {
  const c = (await kv.get(`coaching/${clientId}`)) as CoachingDoc | null;
  if (c?.status === 'active') {
    if (c.trainerId === tid) return 'already-linked';
    // the coaching doc is the authority; the legacy pointer follows it
    if (!dryRun) await kv.merge(`users/${clientId}`, { trainerId: c.trainerId });
    return 'reconciled';
  }
  const t = (await kv.get(`users/${tid}`)) as UserRec | null;
  if (!t || !isCoachRole(t.role) || t.status === 'suspended') return 'trainer-unavailable';
  if (u.status === 'suspended') return 'client-suspended';
  if (dryRun) return 'created';
  const now = ctx.now();
  await createRelationship(ctx, kv, {
    clientId,
    trainerId: tid,
    mode: 'app',
    consent: { ...ALL_OFF },
    inviteId: null,
  });
  await kv.merge(`coaching/${clientId}`, { migratedFrom: 'legacy-trainerId' });
  // one notice each side, stable ids so a re-run never duplicates them
  await notice(kv, clientId, 'trainer-assigned', tid, now, `mg-${clientId}`, nameOf(t) || null);
  await notice(kv, tid, 'client-assigned', clientId, now, `mg-${clientId}`, nameOf(u) || null);
  return 'created';
}

/**
 * Self-service adoption (the client app calls it once per session): the caller's OWN legacy `users.trainerId` becomes the
 * new-model relationship, exactly as the admin backfill would make it (mode `app`, every consent level off), so the trainer
 * card the app already shows opens the real screens. Never touches anyone else; idempotent.
 */
export async function adoptMyLegacyTrainer(
  ctx: Ctx,
  actor: Actor,
): Promise<{
  adopted: boolean;
  outcome: MigrateOutcome | 'no-legacy-trainer';
  trainerId: string | null;
}> {
  const uid = actor.uid;
  if (!isUid(uid) || uid.includes(':'))
    return { adopted: false, outcome: 'bad-pointer', trainerId: null };
  const r = await ctx.kv.tx(
    async (
      kv,
    ): Promise<{ outcome: MigrateOutcome | 'no-legacy-trainer'; trainerId: string | null }> => {
      const u = ((await kv.get(`users/${uid}`)) as UserRec | null) ?? {};
      const tid = u.trainerId;
      if (typeof tid !== 'string' || !tid) return { outcome: 'no-legacy-trainer', trainerId: null };
      if (!isUid(tid) || tid.includes(':')) return { outcome: 'bad-pointer', trainerId: null };
      if (tid === uid) return { outcome: 'self', trainerId: null };
      return { outcome: await migrateOne(ctx, kv, uid, u, tid, false), trainerId: tid };
    },
  );
  return { adopted: r.outcome === 'created', ...r };
}

/**
 * Creates the new-model relationship (`coaching/{client}`, conversation, `users.trainerId`) for every legacy
 * `users.trainerId` that has none. The migrated relationship is mode `app` with EVERY consent level off: a legacy trainer
 * could read everything before, and the new model gives that choice back to the client (who gets the usual
 * "trainer assigned" notice). Idempotent (a second run reports `already-linked`), resumable (`after`/`limit`), and a
 * dry run writes nothing.
 */
export async function migrateLegacyRelationships(
  ctx: Ctx,
  o: { dryRun?: boolean; limit?: number; after?: string } = {},
): Promise<MigrateReport> {
  const dryRun = o.dryRun !== false; // dry run unless explicitly turned off
  const limit = Math.min(Math.max(Math.floor(o.limit ?? 200), 1), 400);
  const rows = await ctx.kv.list('users', { limit, after: o.after ?? '' });
  const counts: Record<MigrateOutcome, number> = {
    created: 0,
    'already-linked': 0,
    reconciled: 0,
    'trainer-unavailable': 0,
    'client-suspended': 0,
    self: 0,
    'bad-pointer': 0,
  };
  const items: MigrateReport['items'] = [];
  const note = (id: string, outcome: MigrateOutcome) => {
    counts[outcome]++;
    if (items.length < 200) items.push({ id, outcome });
  };
  for (const r of rows) {
    const u = r.data as UserRec;
    const tid = u.trainerId;
    if (typeof tid !== 'string' || !tid) continue;
    if (!isUid(tid) || tid.includes(':') || r.id.includes(':')) {
      note(r.id, 'bad-pointer');
      continue;
    }
    if (tid === r.id) {
      note(r.id, 'self');
      continue;
    }
    const outcome = await ctx.kv.tx((kv) => migrateOne(ctx, kv, r.id, u, tid, dryRun));
    note(r.id, outcome);
  }
  return {
    dryRun,
    scanned: rows.length,
    counts,
    items,
    next: rows.length === limit ? rows[rows.length - 1].id : null,
  };
}
