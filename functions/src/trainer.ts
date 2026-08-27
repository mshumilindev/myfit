/**
 * Trainer Cloud Functions (AC-TRAINER), ported from server/src/trainer.ts.
 * Read-only over assigned clients only; not-your-client is a permission error
 * that still names the person (AC-TRAINER-08). No set-writing route (AC-ROLE-05).
 */
import { onCall } from 'firebase-functions/v2/https';
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
} from './lib';
import { memberDetail } from './admin';
import { listUserWorkouts, workoutStrengthStats, lastSession } from './aggregates';

const DAY = 24 * 60 * 60 * 1000;
const INVITE_TTL = 7 * DAY;
const USERNAME_MAX = 64;

function cleanUsername(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, USERNAME_MAX) : '';
}

interface InviteDoc {
  token: string;
  userId: string;
  createdBy: string;
  kind: 'invite';
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

export const trainerClients = onCall(async (req) => {
  const { uid } = await requireRole(req, ['trainer', 'admin']);
  const now = Date.now();
  const snap = await db.collection('users').where('trainerId', '==', uid).get();
  const clients = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<UserDoc, 'id'>) }))
    .sort(
      (a, b) =>
        (a.firstName ?? a.username).localeCompare(b.firstName ?? b.username) ||
        a.username.localeCompare(b.username),
    );

  const rows = await Promise.all(
    clients.map(async (u) => {
      const workouts = await listUserWorkouts(u.id);
      const last = lastSession(workouts);
      const weekWs = workouts.filter((w) => w.startedAt >= now - 7 * DAY);
      const prevWeekWs = workouts.filter(
        (w) => w.startedAt < now - 7 * DAY && w.startedAt >= now - 14 * DAY,
      );
      const weekVol = weekWs.reduce((v, w) => v + workoutStrengthStats(w).volumeKg, 0);
      const prevWeekVol = prevWeekWs.reduce((v, w) => v + workoutStrengthStats(w).volumeKg, 0);
      const liveW = last.live ? workouts[0] : null;
      const liveStats = liveW ? workoutStrengthStats(liveW) : null;
      return {
        id: u.id,
        name: displayName(u),
        avatar: !!u.avatarExt,
        lastSessionAt: last.at,
        live: last.live,
        liveStartedAt: last.liveStartedAt,
        liveSets: liveStats?.sets ?? 0,
        liveVolumeKg: liveStats?.volumeKg ?? 0,
        totalSessions: workouts.length,
        weekSessions: weekWs.length,
        weekVolumeKg: weekVol,
        weekDeltaPct: prevWeekVol > 0 ? ((weekVol - prevWeekVol) / prevWeekVol) * 100 : null,
        dormantDays: last.at && now - last.at > 30 * DAY ? Math.floor((now - last.at) / DAY) : null,
      };
    }),
  );
  return { clients: rows, serverTime: now };
});

export const trainerCreateClient = onCall(async (req) => {
  const { uid, user: trainer } = await requireRole(req, ['trainer']);
  const body = (req.data ?? {}) as Record<string, unknown>;
  const names = parseNameInput(body);
  const username = cleanUsername(body.username);
  if (names.firstName.length < 2) throw new HttpsError('invalid-argument', 'first name required');
  if (username.length < 2) throw new HttpsError('invalid-argument', 'valid username required');

  const id = newId();
  await db.runTransaction(async (tx) => {
    const uSnap = await tx.get(usernameRef(username.toLowerCase()));
    if (uSnap.exists) {
      const holder = await usersById((uSnap.data() as { userId: string }).userId);
      throw new HttpsError('already-exists', 'username taken', {
        holder: holder ? displayName(holder) : null,
      });
    }
    const now = Date.now();
    const doc: Omit<UserDoc, 'id'> = {
      username,
      usernameLower: username.toLowerCase(),
      firstName: names.firstName,
      lastName: names.lastName,
      role: 'member',
      status: 'invited',
      trainerId: uid,
      avatarExt: null,
      createdAt: now,
      updatedAt: now,
    };
    tx.set(db.collection('users').doc(id), doc);
    tx.set(usernameRef(username.toLowerCase()), { userId: id });
  });

  const now = Date.now();
  const invite: InviteDoc = {
    token: newToken(),
    userId: id,
    createdBy: uid,
    kind: 'invite',
    createdAt: now,
    expiresAt: now + INVITE_TTL,
    claimedAt: null,
    revokedAt: null,
    reRequestedAt: null,
  };
  await db.collection('invites').doc(invite.token).set(invite);
  await createNotice(id, 'trainer-assigned', displayName(trainer), displayName(trainer));
  const client = (await usersById(id))!;
  return {
    client: {
      id: client.id,
      name: displayName(client),
      avatar: false,
      lastSessionAt: null,
      live: false,
      liveStartedAt: null,
      liveSets: 0,
      liveVolumeKg: 0,
      totalSessions: 0,
      weekSessions: 0,
      weekVolumeKg: 0,
      weekDeltaPct: null,
      programName: null,
      programWeek: null,
      dormantDays: null,
    },
    invite,
  };
});

export const trainerClientDetail = onCall(async (req) => {
  const { uid } = await requireRole(req, ['trainer', 'admin']);
  const id = (req.data ?? {}).id as unknown;
  if (typeof id !== 'string') throw new HttpsError('invalid-argument', 'id required');
  const u = await usersById(id);
  if (!u || u.trainerId !== uid) {
    throw new HttpsError('permission-denied', 'not your client', {
      name: u ? displayName(u) : null,
    });
  }
  await recordAudit(uid, u.id, 'trainer-detail');
  return memberDetail(u);
});

export const trainerAddNote = onCall(async (req) => {
  const { uid } = await requireRole(req, ['trainer', 'admin']);
  const body = (req.data ?? {}) as Record<string, unknown>;
  const id = body.id;
  const text = body.text;
  if (typeof id !== 'string') throw new HttpsError('invalid-argument', 'id required');
  const u = await usersById(id);
  if (!u || u.trainerId !== uid) throw new HttpsError('permission-denied', 'not your client');
  if (typeof text !== 'string' || !text.trim())
    throw new HttpsError('invalid-argument', 'text required');
  const noteId = newId();
  await db
    .collection('users')
    .doc(u.id)
    .collection('trainerNotes')
    .doc(noteId)
    .set({
      id: noteId,
      trainerId: uid,
      memberId: u.id,
      text: text.trim().slice(0, 2000),
      createdAt: Date.now(),
    });
  return { ok: true, id: noteId };
});
