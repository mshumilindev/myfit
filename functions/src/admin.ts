/**
 * Admin Cloud Functions (AC-ADMIN, AC-INVITE, AC-ROLE), ported from
 * server/src/admin.ts. Every callable re-checks the caller is an admin via
 * requireRole (role read fresh from Firestore), so a demoted admin loses access
 * on the next call. Cross-user reads (detail/export) are audited.
 */
import { onCall } from 'firebase-functions/v2/https';
import type { DocumentReference, WriteBatch } from 'firebase-admin/firestore';
import {
  db,
  requireRole,
  HttpsError,
  newId,
  newToken,
  displayName,
  parseNameInput,
  usernameRef,
  createNotice,
  recordAudit,
  type UserDoc,
  type Role,
} from './lib';
import { listUserWorkouts, volume30d, lastSession, workoutStrengthStats } from './aggregates';

const DAY = 24 * 60 * 60 * 1000;
const INVITE_TTL = 7 * DAY;
const USERNAME_MAX = 64;

const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;
function cleanUsername(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, USERNAME_MAX) : '';
}

interface InviteDoc {
  token: string;
  userId: string;
  createdBy: string;
  kind: 'invite' | 'reset';
  createdAt: number;
  expiresAt: number;
  claimedAt: number | null;
  revokedAt: number | null;
  reRequestedAt: number | null;
}

async function usersById(id: string): Promise<UserDoc | null> {
  const s = await db.collection('users').doc(id).get();
  return s.exists ? { id, ...(s.data() as Omit<UserDoc, 'id'>) } : null;
}

async function validateTrainerAssignment(
  subjectId: string,
  trainerId: unknown,
): Promise<string | null> {
  if (trainerId === null || trainerId === undefined || trainerId === '') return null;
  if (!isId(trainerId)) throw new HttpsError('invalid-argument', 'trainer required');
  if (trainerId === subjectId) throw new HttpsError('invalid-argument', 'cannot train yourself');
  const tr = await usersById(trainerId);
  if (!tr || tr.role !== 'trainer') throw new HttpsError('invalid-argument', 'not a trainer');
  if (tr.status !== 'active') throw new HttpsError('invalid-argument', 'trainer must be active');
  return trainerId;
}

/** Revoke any outstanding invite of this kind, then issue a fresh one. */
async function issueInvite(
  userId: string,
  createdBy: string,
  kind: 'invite' | 'reset',
): Promise<InviteDoc> {
  const now = Date.now();
  const outstanding = await db
    .collection('invites')
    .where('userId', '==', userId)
    .where('kind', '==', kind)
    .get();
  const batch = db.batch();
  for (const d of outstanding.docs) {
    const inv = d.data() as InviteDoc;
    if (!inv.claimedAt && !inv.revokedAt) batch.update(d.ref, { revokedAt: now });
  }
  const inv: InviteDoc = {
    token: newToken(),
    userId,
    createdBy,
    kind,
    createdAt: now,
    expiresAt: now + INVITE_TTL,
    claimedAt: null,
    revokedAt: null,
    reRequestedAt: null,
  };
  batch.set(db.collection('invites').doc(inv.token), inv);
  await batch.commit();
  return inv;
}

async function latestInvite(userId: string): Promise<InviteDoc | null> {
  const snap = await db.collection('invites').where('userId', '==', userId).get();
  const invites = snap.docs
    .map((d) => d.data() as InviteDoc)
    .filter((i) => i.kind === 'invite')
    .sort((a, b) => b.createdAt - a.createdAt);
  return invites[0] ?? null;
}

async function commitBatch(batch: WriteBatch, writes: number): Promise<void> {
  if (writes > 0) await batch.commit();
}

async function flushIfFull(
  batch: WriteBatch,
  writes: number,
): Promise<{ batch: WriteBatch; writes: number }> {
  if (writes < 450) return { batch, writes };
  await batch.commit();
  return { batch: db.batch(), writes: 0 };
}

async function queueDelete(
  state: { batch: WriteBatch; writes: number },
  ref: DocumentReference,
): Promise<{ batch: WriteBatch; writes: number }> {
  state.batch.delete(ref);
  return flushIfFull(state.batch, state.writes + 1);
}

async function queueUpdate(
  state: { batch: WriteBatch; writes: number },
  ref: DocumentReference,
  data: Record<string, unknown>,
): Promise<{ batch: WriteBatch; writes: number }> {
  state.batch.update(ref, data);
  return flushIfFull(state.batch, state.writes + 1);
}

async function deleteTrainerAuthoredNotes(
  state: { batch: WriteBatch; writes: number },
  trainerId: string,
): Promise<{ batch: WriteBatch; writes: number }> {
  const users = await db.collection('users').select().get();
  for (const user of users.docs) {
    const notes = await user.ref
      .collection('trainerNotes')
      .where('trainerId', '==', trainerId)
      .get();
    for (const note of notes.docs) state = await queueDelete(state, note.ref);
  }
  return state;
}

export interface PersonJson {
  id: string;
  name: string;
  username: string;
  firstName: string;
  lastName: string | null;
  role: string;
  status: string;
  trainerId: string | null;
  trainerName: string | null;
  clientCount: number;
  lastSessionAt: number | null;
  live: boolean;
  liveStartedAt: number | null;
  volume30: number;
  avatar: boolean;
  invite: {
    state: 'sent' | 'expired' | 'revoked' | 'claimed';
    expiresAt: number;
    claimedAt: number | null;
    reRequestedAt: number | null;
    token: string;
  } | null;
}

async function buildPerson(u: UserDoc): Promise<PersonJson> {
  const trainer = u.trainerId ? await usersById(u.trainerId) : null;
  const clientCount =
    u.role === 'trainer'
      ? (await db.collection('users').where('trainerId', '==', u.id).count().get()).data().count
      : 0;
  const workouts = await listUserWorkouts(u.id);
  const last = lastSession(workouts);
  const inv = await latestInvite(u.id);
  let invite: PersonJson['invite'] = null;
  if (inv) {
    const state = inv.revokedAt
      ? 'revoked'
      : inv.claimedAt
        ? 'claimed'
        : Date.now() > inv.expiresAt
          ? 'expired'
          : 'sent';
    invite = {
      state,
      expiresAt: inv.expiresAt,
      claimedAt: inv.claimedAt,
      reRequestedAt: inv.reRequestedAt,
      token: inv.token,
    };
  }
  return {
    id: u.id,
    name: displayName(u),
    username: u.username,
    firstName: (u.firstName ?? displayName(u)) as string,
    lastName: u.lastName ?? null,
    role: u.role,
    status: u.status,
    trainerId: u.trainerId,
    trainerName: trainer ? displayName(trainer) : null,
    clientCount,
    lastSessionAt: last.at,
    live: last.live,
    liveStartedAt: last.liveStartedAt,
    volume30: volume30d(workouts),
    avatar: !!u.avatarExt,
    invite,
  };
}

// --- people list ------------------------------------------------------------

export const adminPeople = onCall(async (req) => {
  await requireRole(req, ['admin']);
  const snap = await db.collection('users').get();
  const users = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<UserDoc, 'id'>) }))
    .sort(
      (a, b) =>
        (a.firstName ?? a.username).localeCompare(b.firstName ?? b.username) ||
        (a.lastName ?? '').localeCompare(b.lastName ?? '') ||
        a.username.localeCompare(b.username),
    );
  const people = await Promise.all(users.map(buildPerson));
  return { people, serverTime: Date.now() };
});

// --- create user + invite ---------------------------------------------------

export const adminCreateUser = onCall(async (req) => {
  const { user: admin } = await requireRole(req, ['admin']);
  const body = (req.data ?? {}) as Record<string, unknown>;
  const { trainerId = null, role = 'member' } = body;
  const names = parseNameInput(body);
  const explicitUsername = cleanUsername(body.username);
  if (names.firstName.length < 2) throw new HttpsError('invalid-argument', 'first name required');
  if (explicitUsername.length < 2)
    throw new HttpsError('invalid-argument', 'valid username required');
  if (role !== 'member' && role !== 'trainer' && role !== 'admin')
    throw new HttpsError('invalid-argument', 'role must be member, trainer or admin');

  const id = newId();
  const assignedTrainerId = await validateTrainerAssignment(id, trainerId);
  const username = explicitUsername;

  // Reserve identity + create the invited (password-less) account atomically.
  await db.runTransaction(async (tx) => {
    const uSnap = await tx.get(usernameRef(username.toLowerCase()));
    if (uSnap.exists) {
      const holder = await usersById((uSnap.data() as { userId: string }).userId);
      throw new HttpsError('already-exists', 'username taken', {
        holder: holder ? displayName(holder) : null,
      });
    }
    const doc: Omit<UserDoc, 'id'> = {
      username,
      usernameLower: username.toLowerCase(),
      firstName: names.firstName,
      lastName: names.lastName,
      role: role as Role,
      status: 'invited',
      trainerId: assignedTrainerId,
      avatarExt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    tx.set(db.collection('users').doc(id), doc);
    tx.set(usernameRef(username.toLowerCase()), { userId: id });
  });

  const invite = await issueInvite(id, admin.id, 'invite');
  const person = await buildPerson((await usersById(id))!);
  return { person, invite };
});

export const adminIssueInvite = onCall(async (req) => {
  const { user: admin } = await requireRole(req, ['admin']);
  const id = (req.data ?? {}).id as unknown;
  if (!isId(id)) throw new HttpsError('invalid-argument', 'id required');
  if (!(await usersById(id))) throw new HttpsError('not-found', 'not found');
  return { invite: await issueInvite(id, admin.id, 'invite') };
});

export const adminResetPassword = onCall(async (req) => {
  const { user: admin } = await requireRole(req, ['admin']);
  const id = (req.data ?? {}).id as unknown;
  if (!isId(id)) throw new HttpsError('invalid-argument', 'id required');
  if (!(await usersById(id))) throw new HttpsError('not-found', 'not found');
  return { invite: await issueInvite(id, admin.id, 'reset') };
});

export const adminRevokeInvite = onCall(async (req) => {
  await requireRole(req, ['admin']);
  const token = (req.data ?? {}).token as unknown;
  if (typeof token !== 'string') throw new HttpsError('invalid-argument', 'token required');
  const ref = db.collection('invites').doc(token);
  const snap = await ref.get();
  if (snap.exists && !(snap.data() as InviteDoc).claimedAt)
    await ref.update({ revokedAt: Date.now() });
  return { ok: true };
});

// --- edit identity ----------------------------------------------------------

export const adminEditUser = onCall(async (req) => {
  await requireRole(req, ['admin']);
  const body = (req.data ?? {}) as Record<string, unknown>;
  const id = body.id;
  if (!isId(id)) throw new HttpsError('invalid-argument', 'id required');
  const u = await usersById(id);
  if (!u) throw new HttpsError('not-found', 'not found');

  const names = parseNameInput(body);
  const username = cleanUsername(body.username) || u.username;
  const nextFirst = names.firstName || u.firstName || '';
  const nextLast = names.firstName ? names.lastName : u.lastName;
  if (username.length < 2) throw new HttpsError('invalid-argument', 'valid username required');
  if (nextFirst.length < 2) throw new HttpsError('invalid-argument', 'first name required');

  const nameLower = username.toLowerCase();
  await db.runTransaction(async (tx) => {
    if (nameLower !== u.usernameLower) {
      const uSnap = await tx.get(usernameRef(nameLower));
      if (uSnap.exists) {
        const holder = await usersById((uSnap.data() as { userId: string }).userId);
        throw new HttpsError('already-exists', 'username taken', {
          holder: holder ? displayName(holder) : null,
        });
      }
    }
    tx.update(db.collection('users').doc(u.id), {
      firstName: nextFirst,
      lastName: nextLast,
      username,
      usernameLower: nameLower,
      updatedAt: Date.now(),
    });
    if (nameLower !== u.usernameLower) {
      if (u.usernameLower) tx.delete(usernameRef(u.usernameLower));
      tx.set(usernameRef(nameLower), { userId: u.id });
    }
  });
  return { ok: true };
});

// --- trainer assignment -----------------------------------------------------

export const adminAssignTrainer = onCall(async (req) => {
  const { user: admin } = await requireRole(req, ['admin']);
  const body = (req.data ?? {}) as Record<string, unknown>;
  const id = body.id;
  const trainerId = (body.trainerId ?? null) as string | null;
  if (!isId(id)) throw new HttpsError('invalid-argument', 'id required');
  const u = await usersById(id);
  if (!u) throw new HttpsError('not-found', 'not found');
  const assignedTrainerId = await validateTrainerAssignment(u.id, trainerId);
  const prevTrainer = u.trainerId;
  await db
    .collection('users')
    .doc(u.id)
    .update({ trainerId: assignedTrainerId, updatedAt: Date.now() });
  const adminName = displayName(admin);
  const memberName = displayName(u);
  if (assignedTrainerId !== null) {
    const trRow = (await usersById(assignedTrainerId))!;
    await createNotice(u.id, 'trainer-assigned', adminName, displayName(trRow));
    await createNotice(assignedTrainerId, 'client-assigned', adminName, memberName);
  } else {
    await createNotice(u.id, 'trainer-removed', adminName, null);
  }
  if (prevTrainer && prevTrainer !== assignedTrainerId) {
    await createNotice(prevTrainer, 'client-removed', adminName, memberName);
  }
  return { ok: true };
});

// --- role / suspension ------------------------------------------------------

export const adminChangeRole = onCall(async (req) => {
  const { uid, user: admin } = await requireRole(req, ['admin']);
  const body = (req.data ?? {}) as Record<string, unknown>;
  const id = body.id;
  const role = body.role;
  if (role !== 'member' && role !== 'trainer' && role !== 'admin')
    throw new HttpsError('invalid-argument', 'bad role');
  if (!isId(id)) throw new HttpsError('invalid-argument', 'id required');
  if (id === uid) throw new HttpsError('invalid-argument', 'cannot change own role');
  const patch: Record<string, unknown> = { role, updatedAt: Date.now() };
  // Demoting away from trainer leaves their clients; keep parity (no cascade).
  await db.collection('users').doc(id).update(patch);
  // If we just created the first admin ever via this path, remember it.
  if (role === 'admin')
    await db.collection('meta').doc('app').set({ hasAdmin: true }, { merge: true });
  await createNotice(id, 'role-changed', displayName(admin), String(role));
  return { ok: true };
});

export const adminSuspend = onCall(async (req) => {
  const { uid } = await requireRole(req, ['admin']);
  const id = (req.data ?? {}).id as unknown;
  if (!isId(id)) throw new HttpsError('invalid-argument', 'id required');
  if (id === uid) throw new HttpsError('invalid-argument', 'cannot suspend yourself');
  await db.collection('users').doc(id).update({ status: 'suspended', updatedAt: Date.now() });
  return { ok: true };
});

export const adminUnsuspend = onCall(async (req) => {
  await requireRole(req, ['admin']);
  const id = (req.data ?? {}).id as unknown;
  if (!isId(id)) throw new HttpsError('invalid-argument', 'id required');
  const ref = db.collection('users').doc(id);
  const snap = await ref.get();
  if (snap.exists && (snap.data() as UserDoc).status === 'suspended')
    await ref.update({ status: 'active', updatedAt: Date.now() });
  return { ok: true };
});

// --- delete (cascade) -------------------------------------------------------

export const adminDeleteUser = onCall(async (req) => {
  const { uid } = await requireRole(req, ['admin']);
  const id = (req.data ?? {}).id as unknown;
  if (!isId(id)) throw new HttpsError('invalid-argument', 'id required');
  if (id === uid) throw new HttpsError('invalid-argument', 'cannot delete yourself');
  const u = await usersById(id);
  if (!u) throw new HttpsError('not-found', 'not found');

  let state = { batch: db.batch(), writes: 0 };
  // Detach trainees.
  const trainees = await db.collection('users').where('trainerId', '==', id).get();
  for (const d of trainees.docs) state = await queueUpdate(state, d.ref, { trainerId: null });
  // Their reservations + invites + assignment.
  if (u.usernameLower) state = await queueDelete(state, usernameRef(u.usernameLower));
  state = await queueDelete(state, db.collection('credentials').doc(id));
  state = await queueDelete(state, db.collection('assignments').doc(id));
  const invites = await db.collection('invites').where('userId', '==', id).get();
  for (const d of invites.docs) state = await queueDelete(state, d.ref);
  // Trainer notes this user authored across other members. This intentionally
  // walks user subcollections instead of collectionGroup('trainerNotes') so
  // deletion does not depend on a production index existing.
  state = await deleteTrainerAuthoredNotes(state, id);
  // Programs they authored + assignments pointing at those programs.
  const programs = await db.collection('programs').where('authorId', '==', id).get();
  for (const p of programs.docs) {
    state = await queueDelete(state, p.ref);
    const assigned = await db.collection('assignments').where('programId', '==', p.id).get();
    for (const a of assigned.docs) state = await queueDelete(state, a.ref);
  }
  await commitBatch(state.batch, state.writes);
  // Nuke the user doc + all subcollections (workouts/gyms/notices/audit/...).
  await db.recursiveDelete(db.collection('users').doc(id));
  return { ok: true };
});

// --- audited detail + export ------------------------------------------------

export async function memberDetail(u: UserDoc) {
  const workouts = await listUserWorkouts(u.id, 40);
  const gymNames = new Map<string, string>();
  const gymsSnap = await db.collection('users').doc(u.id).collection('gyms').get();
  for (const g of gymsSnap.docs) gymNames.set(g.id, (g.data() as { name: string }).name);

  const sessions = workouts.map((w) => {
    const stats = workoutStrengthStats(w);
    return {
      id: w.id,
      startedAt: w.startedAt,
      finishedAt: w.finishedAt,
      live: w.finishedAt === null,
      sets: stats.sets,
      volumeKg: stats.volumeKg,
      gymName: w.gymId ? (gymNames.get(w.gymId) ?? null) : null,
    };
  });
  const count30 = sessions.filter((s) => s.startedAt >= Date.now() - 30 * DAY);

  const notesSnap = await db.collection('users').doc(u.id).collection('trainerNotes').get();
  const notes = await Promise.all(
    notesSnap.docs
      .map((d) => d.data() as { id: string; text: string; createdAt: number; trainerId: string })
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(async (n) => {
        const tr = await usersById(n.trainerId);
        return {
          id: n.id,
          text: n.text,
          createdAt: n.createdAt,
          trainerName: tr ? displayName(tr) : '—',
        };
      }),
  );

  return {
    person: await buildPerson(u),
    volume30: volume30d(workouts),
    sessions30: count30.length,
    perWeek: Math.round((count30.length / 30) * 7 * 10) / 10,
    sessions,
    notes,
  };
}

export const adminUserDetail = onCall(async (req) => {
  const { uid } = await requireRole(req, ['admin']);
  const id = (req.data ?? {}).id as unknown;
  if (!isId(id)) throw new HttpsError('invalid-argument', 'id required');
  const u = await usersById(id);
  if (!u) throw new HttpsError('not-found', 'not found');
  await recordAudit(uid, u.id, 'detail');
  return memberDetail(u);
});

export const adminExportUser = onCall(async (req) => {
  const { uid } = await requireRole(req, ['admin']);
  const id = (req.data ?? {}).id as unknown;
  if (!isId(id)) throw new HttpsError('invalid-argument', 'id required');
  const u = await usersById(id);
  if (!u) throw new HttpsError('not-found', 'not found');
  await recordAudit(uid, u.id, 'export');
  const workouts = (await listUserWorkouts(u.id)).sort((a, b) => a.startedAt - b.startedAt);
  const gyms = (await db.collection('users').doc(u.id).collection('gyms').get()).docs.map((d) => ({
    id: d.id,
    ...(d.data() as object),
  }));
  return {
    exportedAt: Date.now(),
    person: {
      id: u.id,
      name: displayName(u),
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
    },
    workouts,
    gyms,
  };
});
