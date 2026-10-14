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
import { aggregateWorkouts, legacyCut } from './coach/legacy';
import { ALL_OFF } from './coach/logic';
import { coachCallOptions, coachCtx, coachKv } from './coach/runtime';
import { CoachError, addSealedNote, createRelationship } from './coach/service';
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

/**
 * The roster of legacy `users.trainerId` clients. Every row is cut by the client's CONSENT (coach/legacy.ts), the same
 * levels `coachRead` uses: `off` shows the person and `locked: true` with zeros, `effects` the weekly numbers, `full`
 * the live state and totals too. Nothing beyond the open `stats` of a workout is ever read here.
 */
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
      const cut = await legacyCut(coachKv, uid, u.id);
      const level = cut?.totals ?? 'off';
      const ident = {
        id: u.id,
        name: displayName(u),
        avatar: !!u.avatarExt,
        avatarRev: u.avatarExt ? (u.updatedAt ?? 0) : 0,
      };
      if (level === 'off')
        return {
          ...ident,
          locked: true,
          lastSessionAt: null,
          live: false,
          liveStartedAt: null,
          liveSets: 0,
          liveVolumeKg: 0,
          totalSessions: 0,
          weekSessions: 0,
          weekVolumeKg: 0,
          weekDeltaPct: null,
          dormantDays: null,
        };
      const full = level === 'full';
      const workouts = aggregateWorkouts(cut, await listUserWorkouts(u.id));
      const last = lastSession(workouts);
      const weekWs = workouts.filter((w) => w.startedAt >= now - 7 * DAY);
      const prevWeekWs = workouts.filter(
        (w) => w.startedAt < now - 7 * DAY && w.startedAt >= now - 14 * DAY,
      );
      const weekVol = weekWs.reduce((v, w) => v + workoutStrengthStats(w).volumeKg, 0);
      const prevWeekVol = prevWeekWs.reduce((v, w) => v + workoutStrengthStats(w).volumeKg, 0);
      const liveW = full && last.live ? workouts[0] : null;
      const liveStats = liveW ? workoutStrengthStats(liveW) : null;
      return {
        ...ident,
        locked: false,
        lastSessionAt: last.at,
        live: full && last.live,
        liveStartedAt: full ? last.liveStartedAt : null,
        liveSets: liveStats?.sets ?? 0,
        liveVolumeKg: liveStats?.volumeKg ?? 0,
        totalSessions: full ? workouts.length : 0,
        weekSessions: weekWs.length,
        weekVolumeKg: weekVol,
        weekDeltaPct: prevWeekVol > 0 ? ((weekVol - prevWeekVol) / prevWeekVol) * 100 : null,
        dormantDays: last.at && now - last.at > 30 * DAY ? Math.floor((now - last.at) / DAY) : null,
      };
    }),
  );
  return { clients: rows, serverTime: now };
});

export const trainerCreateClient = onCall(coachCallOptions, async (req) => {
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
      // set by the relationship below (coaching doc, conversation, consent all off), never written here directly
      trainerId: null,
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
  // The trainer of a client they created is a real relationship: coaching doc + conversation, EVERY consent level off
  // (the client decides at first sign-in). No `users.trainerId`-only relationship exists any more.
  const cctx = coachCtx();
  await cctx.kv.tx((kv) =>
    createRelationship(cctx, kv, {
      clientId: id,
      trainerId: uid,
      mode: 'app',
      consent: { ...ALL_OFF },
      inviteId: null,
    }),
  );
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
  return memberDetail(u, await legacyCut(coachKv, uid, u.id));
});

/**
 * Plaintext notes are retired (plan-security B-01): the callable accepts ONLY a note sealed on the trainer's device with
 * the conversation key `{ id: clientId, noteId, at, keyEpoch, enc }` and files it where the rules and the client read it
 * (`conversations/{cid}/notes`). A request carrying `text` is refused with `use-sealed-notes`.
 */
export const trainerAddNote = onCall(coachCallOptions, async (req) => {
  const { uid, user } = await requireRole(req, ['trainer', 'admin']);
  const body = (req.data ?? {}) as Record<string, unknown>;
  try {
    return await addSealedNote(coachCtx(), { uid, role: user.role }, body);
  } catch (e) {
    if (e instanceof CoachError) throw new HttpsError(e.code, e.reason, { reason: e.reason });
    throw e;
  }
});
