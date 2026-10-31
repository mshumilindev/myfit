/**
 * Account deletion (SPO-285, GDPR Art. 17): ONE cascade used by `adminDeleteUser` and by the self-service
 * `deleteMyAccount`, written on the `Kv` seam plus four small ports (tree delete, Storage, Auth, legacy notes) so every
 * rule runs in unit tests without Firebase. Registry: `claude/SPO-252-my-data-spike.md` (R1-R43).
 *
 * Order matters (a failure midway must be retryable, the Auth user goes LAST):
 *   1. sessions revoked, coaching purged (relationships end with notices, conversations, keys, ... : `lifecycle.ts`);
 *   2. everything that points AT the account from outside `users/{uid}`: team, programs, invites, passkeys, login
 *      counters, sleep queue, trainer-authored legacy notes, trainees detached;
 *   3. Storage `avatars/{uid}/`;
 *   4. `users/{uid}` with every subcollection (the anchor: it holds the username and the team pointer, so it goes AFTER
 *      the steps that read it);
 *   5. username reservation, password hash, assignment (needed until here to verify the password on a retry);
 *   6. the Auth user, then the user tree once more (a request in flight from another device cannot leave orphans).
 * Every step is a delete-if-present, so running the whole cascade again is safe.
 *
 * Kept on purpose (other people's own records, spec SPO-252 section 6): `audit` and `consentLog` entries OTHER users hold
 * about this account, notices other users hold, the 90-day team activity entries of a team the account only belonged to.
 * Nothing about the person is kept by Spotter itself: no tombstone, no counter. Whether a minimal proof of deletion
 * should be kept is an open lawyer question (SPO-258).
 */
import { HttpsError } from 'firebase-functions/v2/https';
import type { Kv } from './coach/kv';
import { purgeAccountCoaching, type PurgeReport } from './coach/lifecycle';
import { conversationId, isUid } from './coach/logic';
import type { Ctx } from './coach/service';

/** The parts of the cascade that are not plain documents. `accountDeletion.ts` binds them to Firebase. */
export interface DeletionPorts {
  /** Ends the person's refresh tokens (a person who never signed in has no auth record: fine). */
  revokeSessions(uid: string): Promise<void>;
  /** A document and EVERY subcollection beneath it (`recursiveDelete`). Absent is fine. */
  deleteTree(path: string): Promise<void>;
  /** Every Storage object under the prefix. */
  deleteStorage(prefix: string): Promise<void>;
  /**
   * FALLBACK for legacy `users/*\/trainerNotes` written by this trainer: walks every user document. Used only when the
   * collection-group query below fails because its index is not deployed yet (`deleteTrainerAuthoredNotes`).
   */
  walkTrainerAuthoredNotes(trainerUid: string): Promise<void>;
  /** The Auth record; absent is fine. */
  deleteAuthUser(uid: string): Promise<void>;
}

export interface DeletionReport extends PurgeReport {
  /** trainees whose `trainerId` was cleared */
  detached: number;
}

type UserRec = {
  usernameLower?: string;
  teamId?: string | null;
  role?: string;
  status?: string;
  deletionStartedAt?: number;
} | null;

/** gRPC FAILED_PRECONDITION: Firestore's answer to a collection-group query whose index does not exist (yet). */
const missingIndex = (e: unknown): boolean => {
  const x = e as { code?: unknown; message?: unknown } | null;
  return (
    x?.code === 9 ||
    x?.code === 'failed-precondition' ||
    /requires an index/i.test(String(x?.message))
  );
};

/**
 * Legacy trainer notes this account wrote about other people (`users/{client}/trainerNotes`, field `trainerId`): ONE
 * collection-group query (single-field index `trainerNotes.trainerId`, `firestore.indexes.json`) instead of a walk over
 * every user. If the index is not deployed yet the query fails and the bounded-by-nothing walk runs instead, so
 * deletion never depends on the index being there.
 */
export async function deleteTrainerAuthoredNotes(
  kv: Kv,
  ports: Pick<DeletionPorts, 'walkTrainerAuthoredNotes'>,
  trainerUid: string,
): Promise<void> {
  let rows: { path: string }[];
  try {
    rows = await kv.group('trainerNotes', { where: [['trainerId', '==', trainerUid]] });
  } catch (e) {
    if (!missingIndex(e)) throw e;
    await ports.walkTrainerAuthoredNotes(trainerUid);
    return;
  }
  await del(kv, rows);
}

const del = async (kv: Kv, rows: { path: string }[]): Promise<number> => {
  for (const r of rows) await kv.del(r.path);
  return rows.length;
};

/** Team data (SPO-196): the team the account OWNS, and its place in a team it only belongs to. */
async function purgeTeams(
  ctx: Ctx,
  ports: DeletionPorts,
  uid: string,
  user: UserRec,
): Promise<void> {
  const kv = ctx.kv;
  // the owned team: the other members go back to their own default team, then members/acl/activity/the team doc go
  for (const m of await kv.list(`teams/${uid}/members`)) {
    if (m.id === uid) continue;
    const u = (await kv.get(`users/${m.id}`)) as UserRec;
    if (u && u.teamId === uid)
      await kv.merge(`users/${m.id}`, { teamId: m.id, updatedAt: ctx.now() });
  }
  await ports.deleteTree(`teams/${uid}`);
  await del(kv, await kv.list('teamInvites', { where: [['teamId', '==', uid]] }));
  await del(kv, await kv.list('teamRequests', { where: [['teamId', '==', uid]] }));

  // a team the account only belongs to: its membership row, and a manager's wrapped keys on the team's clients
  const teamId = user?.teamId;
  if (teamId && teamId !== uid && isUid(teamId)) {
    const rec = await kv.get(`teams/${teamId}/members/${uid}`);
    if (rec?.role === 'manager') {
      for (const tr of await kv.list(`teams/${teamId}/members`)) {
        if (tr.data.role !== 'trainer') continue;
        for (const c of await kv.list('coaching', { where: [['trainerId', '==', tr.id]] }))
          await kv.del(
            `conversations/${conversationId(ctx.pepper, c.id, tr.id)}/delegations/${uid}`,
          );
      }
    }
    await kv.del(`teams/${teamId}/members/${uid}`);
    await kv.del(`teams/${teamId}/acl/${uid}`);
  }
  // what this account wrote into other teams' queues
  await del(kv, await kv.list('teamInvites', { where: [['invitedBy', '==', uid]] }));
  for (const field of ['requestedBy', 'clientId', 'trainerId'])
    await del(kv, await kv.list('teamRequests', { where: [[field, '==', uid]] }));
}

/**
 * Deletes the account and everything Spotter holds about it. `uid` comes from the caller's session or from an admin
 * after the role check, never from request data of an ordinary user.
 */
export async function deleteAccountCascade(
  ctx: Ctx,
  ports: DeletionPorts,
  uid: string,
): Promise<DeletionReport> {
  if (!isUid(uid)) throw new HttpsError('invalid-argument', 'bad-user');
  const kv = ctx.kv;
  const user = (await kv.get(`users/${uid}`)) as UserRec; // null on a retry after the tree is gone

  // 1. coaching first (plan-security B-08): relationships end with notices, then conversations, keys, requests ...
  await ports.revokeSessions(uid);
  const rep = await purgeAccountCoaching(ctx, uid);

  // 2. pointers at the account from outside `users/{uid}`
  let detached = 0;
  for (const t of await kv.list('users', { where: [['trainerId', '==', uid]] })) {
    await kv.merge(t.path, { trainerId: null, updatedAt: ctx.now() });
    detached++;
  }
  await deleteTrainerAuthoredNotes(kv, ports, uid);
  for (const p of await kv.list('programs', { where: [['authorId', '==', uid]] })) {
    await del(kv, await kv.list('assignments', { where: [['programId', '==', p.id]] }));
    await kv.del(p.path);
  }
  await del(kv, await kv.list('invites', { where: [['userId', '==', uid]] }));
  await del(kv, await kv.list('passkeys', { where: [['userId', '==', uid]] }));
  await del(kv, await kv.list('passkeyChallenges', { where: [['userId', '==', uid]] }));
  if (user?.usernameLower)
    await del(
      kv,
      await kv.list('loginAttempts', { where: [['identifier', '==', user.usernameLower]] }),
    );
  await kv.del(`sleepSchedules/${uid}`);
  await purgeTeams(ctx, ports, uid, user);

  // 3. Storage
  await ports.deleteStorage(`avatars/${uid}/`);

  // 4. the anchor: users/{uid} with workouts, meta, grants, consentRecords, sessions, keyLog, notices, audit, ...
  await ports.deleteTree(`users/${uid}`);

  // 5. identity rows (kept until here so a retry can still verify the password)
  for (const r of await kv.list('usernames', { where: [['userId', '==', uid]] }))
    await kv.del(r.path);
  if (user?.usernameLower) {
    const res = await kv.get(`usernames/${user.usernameLower}`);
    if (res && res.userId === uid) await kv.del(`usernames/${user.usernameLower}`);
  }
  // The email index, and the sign-in counters typed with those addresses or from linking one (they hold the address).
  for (const r of await kv.list('emails', { where: [['userId', '==', uid]] })) {
    await del(
      kv,
      await kv.list('loginAttempts', { where: [['identifier', '==', decodeURIComponent(r.id)]] }),
    );
    await kv.del(r.path);
  }
  await del(kv, await kv.list('loginAttempts', { where: [['identifier', '==', `attach:${uid}`]] }));
  await kv.del(`credentials/${uid}`);
  await kv.del(`assignments/${uid}`);
  await kv.del(`${RATE_COLLECTION}/${RATE_PREFIX}${uid}`);

  // 6. Auth last; then the tree again in case a write from another device landed in between
  await ports.deleteAuthUser(uid);
  await ports.deleteTree(`users/${uid}`);
  return { ...rep, detached };
}

/* ---- the self-service callable ------------------------------------------------------------------------------------ */
export const RATE_COLLECTION = 'rateLimits';
export const RATE_PREFIX = 'acctdel_';
export const ATTEMPT_MAX = 5;
export const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

export interface DeleteMyAccountArgs {
  uid: string | undefined;
  data: unknown;
  now: number;
}
export interface DeleteMyAccountPorts extends DeletionPorts {
  verifyPassword(plain: string, hash: string): boolean;
}

function parseInput(data: unknown): { password: string } {
  const d = data as Record<string, unknown> | null;
  if (!d || typeof d !== 'object' || Array.isArray(d))
    throw new HttpsError('invalid-argument', 'bad-input');
  for (const k of Object.keys(d))
    if (k !== 'password' && k !== 'confirm') throw new HttpsError('invalid-argument', 'bad-input');
  if (d.confirm !== true) throw new HttpsError('invalid-argument', 'not-confirmed');
  if (typeof d.password !== 'string' || d.password.length > 72)
    throw new HttpsError('invalid-argument', 'bad-input');
  return { password: d.password };
}

/**
 * The attempt limiter, atomic (one `kv.tx` per step, so concurrent calls cannot all read "4 of 5" and pass together).
 * An attempt is RESERVED before the password is checked and handed back when the password was right, so in the end only
 * failed verifications stay counted: a person who typed the right password and met `last-admin` or a network error
 * is not locked out of their own deletion, while N parallel guesses can never exceed `ATTEMPT_MAX` in flight.
 */
async function reserveAttempt(kv: Kv, uid: string, now: number): Promise<void> {
  const rate = `${RATE_COLLECTION}/${RATE_PREFIX}${uid}`;
  await kv.tx(async (t) => {
    const cur = (await t.get(rate)) as { count: number; windowStart: number } | null;
    const fresh = !cur || now - cur.windowStart > ATTEMPT_WINDOW_MS;
    const count = fresh ? 0 : cur.count;
    if (count >= ATTEMPT_MAX) throw new HttpsError('resource-exhausted', 'too-many-attempts');
    await t.set(rate, {
      count: count + 1,
      windowStart: fresh ? now : cur.windowStart,
      updatedAt: now,
    });
  });
}
async function refundAttempt(kv: Kv, uid: string, now: number): Promise<void> {
  const rate = `${RATE_COLLECTION}/${RATE_PREFIX}${uid}`;
  await kv.tx(async (t) => {
    const cur = (await t.get(rate)) as { count: number; windowStart: number } | null;
    if (!cur) return;
    if (cur.count <= 1) await t.del(rate);
    else await t.set(rate, { ...cur, count: cur.count - 1, updatedAt: now });
  });
}

/**
 * Last-admin guard, atomic with CLAIMING the deletion: inside one transaction the account counts the OTHER admins that
 * are neither suspended nor already being deleted, and if there is one, marks itself `deletionStartedAt`. Two admins
 * deleting at the same moment therefore cannot both pass (the second sees the first's mark). The mark sits on a document
 * that is deleted a moment later; if a later step fails and the person walks away, the mark stays and only means "this
 * admin no longer counts", which is what a half-deleted account is.
 */
async function claimAsAdmin(kv: Kv, uid: string, now: number): Promise<void> {
  await kv.tx(async (t) => {
    const admins = await t.list('users', { where: [['role', '==', 'admin']] });
    const others = admins.filter(
      (r) => r.id !== uid && r.data.status !== 'suspended' && !r.data.deletionStartedAt,
    );
    if (others.length === 0)
      throw new HttpsError('failed-precondition', 'last-admin', { reason: 'last-admin' });
    await t.merge(`users/${uid}`, { deletionStartedAt: now });
  });
}

/**
 * `deleteMyAccount`: deletes ONLY the caller. Order of checks: signed in, input, [live account only: reserve an attempt
 * (atomic), password (the step-up, verified on the server), hand the attempt back, not the last admin], cascade. A retry
 * after the user document is already gone (a step failed late) skips the password: the caller still holds the session of
 * that uid, nothing else is reachable.
 *
 * OPEN (SPO-285 S5): the step-up is the password only. An account with no password hash (a future passkey-only account)
 * is refused with the distinct `no-password-method` instead of looking like a wrong password, but it CANNOT delete itself
 * yet: the repo has no fresh-sign-in / passkey-assertion step-up for an already signed-in session (`passkeyLoginVerify`
 * signs in, it does not assert freshness for another callable), and inventing one here would be unreviewed crypto.
 */
export async function deleteMyAccountHandler(
  ctx: Ctx,
  ports: DeleteMyAccountPorts,
  a: DeleteMyAccountArgs,
): Promise<{ ok: true }> {
  if (!a.uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const uid = a.uid;
  const { password } = parseInput(a.data);
  const kv = ctx.kv;
  const user = (await kv.get(`users/${uid}`)) as UserRec;
  if (user) {
    await reserveAttempt(kv, uid, a.now);
    const hash = ((await kv.get(`credentials/${uid}`)) as { passwordHash?: string } | null)
      ?.passwordHash;
    if (!hash) {
      await refundAttempt(kv, uid, a.now); // nothing was verified, nothing failed
      throw new HttpsError('failed-precondition', 'no-password-method', {
        reason: 'no-password-method',
      });
    }
    if (!password || !ports.verifyPassword(password, hash))
      throw new HttpsError('permission-denied', 'bad-password', { reason: 'bad-password' });
    await refundAttempt(kv, uid, a.now); // right password: only failed verifications stay counted
    if (user.role === 'admin') await claimAsAdmin(kv, uid, a.now);
  }
  await deleteAccountCascade(ctx, ports, uid);
  return { ok: true };
}
