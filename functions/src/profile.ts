/**
 * Profile Cloud Functions (O-10, AC-ROLE-08/09), ported from server/src/profile.ts.
 *
 * Avatars are no longer served here — they live in Cloud Storage and are gated
 * by storage.rules; the client uploads/deletes directly and records `avatarExt`
 * on its own user doc. What remains server-side: the cross-user profile read
 * (audited, role-gated), self password change (bcrypt), and self identity edit
 * (username uniqueness).
 */
import { onCall } from 'firebase-functions/v2/https';
import {
  db,
  requireAuth,
  loadUser,
  HttpsError,
  displayName,
  parseNameInput,
  hashPassword,
  verifyPassword,
  validPassword,
  recordAudit,
  usernameRef,
  type UserDoc,
} from './lib';
import {
  listUserWorkouts,
  workoutStrengthStats,
  exerciseVolumeKg,
  type StoredWorkout,
} from './aggregates';

const DAY = 24 * 60 * 60 * 1000;
const USERNAME_MAX = 64;

function cleanUsername(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, USERNAME_MAX) : '';
}
async function usersById(id: string): Promise<UserDoc | null> {
  const s = await db.collection('users').doc(id).get();
  return s.exists ? { id, ...(s.data() as Omit<UserDoc, 'id'>) } : null;
}
function canReadProfile(viewer: UserDoc, target: UserDoc): 'self' | 'admin' | 'trainer' | null {
  if (viewer.status === 'suspended') return null;
  if (viewer.id === target.id) return 'self';
  if (viewer.role === 'admin') return 'admin';
  if (viewer.role === 'trainer' && target.trainerId === viewer.id) return 'trainer';
  return null;
}

async function personJson(u: UserDoc) {
  const trainer = u.trainerId ? await usersById(u.trainerId) : null;
  const clientCount =
    u.role === 'trainer'
      ? (await db.collection('users').where('trainerId', '==', u.id).count().get()).data().count
      : 0;
  return {
    id: u.id,
    name: displayName(u),
    username: u.username,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    role: u.role,
    status: u.status,
    joinedAt: u.createdAt,
    trainerId: u.trainerId,
    trainerName: trainer ? displayName(trainer) : null,
    clientCount,
    avatar: !!u.avatarExt,
  };
}

async function accessList(u: UserDoc) {
  const adminsSnap = await db.collection('users').where('role', '==', 'admin').get();
  const admins = adminsSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<UserDoc, 'id'>) }))
    .filter((a) => a.id !== u.id)
    .map((a) => ({ id: a.id, name: displayName(a), role: 'admin' as const }));
  const trainer = u.trainerId ? await usersById(u.trainerId) : null;
  return [
    ...admins,
    ...(trainer ? [{ id: trainer.id, name: displayName(trainer), role: 'trainer' as const }] : []),
  ];
}

// --- aggregate computations over the nested workout docs --------------------

function isStrength(kind?: string) {
  return (kind ?? 'strength') === 'strength';
}
function strengthVol(w: StoredWorkout): number {
  return workoutStrengthStats(w).volumeKg;
}
function volumeSince(workouts: StoredWorkout[], since: number): number {
  return workouts.filter((w) => w.startedAt >= since).reduce((v, w) => v + strengthVol(w), 0);
}

function trainingSummary(workouts: StoredWorkout[], now = Date.now()) {
  let liveSessions = 0;
  let firstSessionAt: number | null = null;
  let lastSessionAt: number | null = null;
  let durationMs = 0;
  let sets = 0;
  const exNames = new Set<string>();
  let volumeKg = 0;
  let cardioMinutes = 0;
  for (const w of workouts) {
    if (w.finishedAt === null) liveSessions++;
    firstSessionAt = firstSessionAt === null ? w.startedAt : Math.min(firstSessionAt, w.startedAt);
    lastSessionAt = lastSessionAt === null ? w.startedAt : Math.max(lastSessionAt, w.startedAt);
    if (w.finishedAt) durationMs += w.finishedAt - w.startedAt;
    const stats = workoutStrengthStats(w);
    sets += stats.sets;
    volumeKg += stats.volumeKg;
    for (const e of w.exercises ?? []) {
      if (isStrength(e.kind)) {
        exNames.add(e.name?.toLowerCase() ?? '');
      } else {
        for (const s of e.sets ?? [])
          cardioMinutes += (s as { durationMin?: number }).durationMin ?? 0;
      }
    }
  }
  const sessions30 = workouts.filter((w) => w.startedAt >= now - 30 * DAY).length;
  return {
    sessions: workouts.length,
    sessions30,
    perWeek30: Math.round((sessions30 / 30) * 7 * 10) / 10,
    liveSessions,
    firstSessionAt,
    lastSessionAt,
    durationMs,
    sets,
    exercises: [...exNames].filter(Boolean).length,
    volumeKg,
    cardioMinutes,
    volume30: volumeSince(workouts, now - 30 * DAY),
    volume7: volumeSince(workouts, now - 7 * DAY),
  };
}

interface GymDoc {
  id: string;
  name: string;
  favorite?: boolean;
  lat: number;
  lng: number;
  radiusM: number;
}

function recentSessions(workouts: StoredWorkout[], gyms: Map<string, GymDoc>) {
  return workouts.slice(0, 30).map((w) => {
    let exercises = 0;
    for (const e of w.exercises ?? []) {
      if (!isStrength(e.kind)) continue;
      exercises++;
    }
    const stats = workoutStrengthStats(w);
    const names = [...(w.exercises ?? [])]
      .map((e, i) => ({ e: e as { name?: string; position?: number }, i }))
      .sort((a, b) => (a.e.position ?? a.i) - (b.e.position ?? b.i))
      .slice(0, 4)
      .map((x) => x.e.name ?? '');
    const gym = w.gymId ? gyms.get(w.gymId) : undefined;
    return {
      id: w.id,
      startedAt: w.startedAt,
      finishedAt: w.finishedAt,
      autoFinished: !!w.autoFinished,
      live: w.finishedAt === null,
      durationMs: w.finishedAt ? w.finishedAt - w.startedAt : null,
      gymId: gym?.id ?? null,
      gymName: gym?.name ?? null,
      sets: stats.sets,
      exercises,
      volumeKg: stats.volumeKg,
      exerciseNames: names,
    };
  });
}

function gymStats(workouts: StoredWorkout[], gyms: GymDoc[]) {
  return gyms
    .map((g) => {
      const mine = workouts.filter((w) => w.gymId === g.id);
      return {
        id: g.id,
        name: g.name,
        favorite: g.favorite ? 1 : 0,
        lat: g.lat,
        lng: g.lng,
        radiusM: g.radiusM,
        sessions: mine.length,
        lastSessionAt: mine.reduce<number | null>(
          (m, w) => (m === null ? w.startedAt : Math.max(m, w.startedAt)),
          null,
        ),
        volumeKg: mine.reduce((v, w) => v + strengthVol(w), 0),
      };
    })
    .sort(
      (a, b) => b.sessions - a.sessions || b.favorite - a.favorite || a.name.localeCompare(b.name),
    )
    .slice(0, 20);
}

function topExercises(workouts: StoredWorkout[]) {
  const map = new Map<
    string,
    {
      name: string;
      sets: number;
      sessions: Set<string>;
      lastAt: number;
      volumeKg: number;
      bestE1rm: number;
    }
  >();
  for (const w of workouts) {
    for (const e of w.exercises ?? []) {
      if (!isStrength(e.kind)) continue;
      const name = (e as { name?: string }).name ?? '';
      const key = name.toLowerCase();
      const agg = map.get(key) ?? {
        name,
        sets: 0,
        sessions: new Set<string>(),
        lastAt: 0,
        volumeKg: 0,
        bestE1rm: 0,
      };
      agg.volumeKg += exerciseVolumeKg(e);
      for (const s of e.sets ?? []) {
        agg.sets++;
        // e1RM uses the entered (per-side) load, not the doubled volume weight.
        agg.bestE1rm = Math.max(agg.bestE1rm, (s.weight ?? 0) * (1 + (s.reps ?? 0) / 30));
      }
      agg.sessions.add(w.id);
      agg.lastAt = Math.max(agg.lastAt, w.startedAt);
      map.set(key, agg);
    }
  }
  return [...map.values()]
    .filter((a) => a.sets > 0)
    .sort((a, b) => b.volumeKg - a.volumeKg || b.sets - a.sets)
    .slice(0, 8)
    .map((a) => ({
      name: a.name,
      sets: a.sets,
      sessions: a.sessions.size,
      lastAt: a.lastAt,
      volumeKg: a.volumeKg,
      bestE1rm: a.bestE1rm,
    }));
}

async function notesFor(userId: string) {
  const snap = await db.collection('users').doc(userId).collection('trainerNotes').get();
  const notes = snap.docs
    .map((d) => d.data() as { id: string; text: string; createdAt: number; trainerId: string })
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 30);
  return Promise.all(
    notes.map(async (n) => {
      const tr = await usersById(n.trainerId);
      return {
        id: n.id,
        text: n.text,
        createdAt: n.createdAt,
        trainerName: tr ? displayName(tr) : '—',
      };
    }),
  );
}

async function auditFor(userId: string) {
  const snap = await db.collection('users').doc(userId).collection('audit').get();
  return snap.docs
    .map(
      (d) =>
        d.data() as { at: number; resource: string; readerName: string | null; readerRole: string },
    )
    .sort((a, b) => b.at - a.at)
    .slice(0, 200)
    .map((r) => ({
      at: r.at,
      resource: r.resource,
      readerName: r.readerName ?? null,
      readerRole: r.readerRole ?? 'admin',
    }));
}

async function fullProfilePayload(
  viewer: UserDoc,
  target: UserDoc,
  relation: 'self' | 'admin' | 'trainer',
) {
  const workouts = await listUserWorkouts(target.id);
  const gymsSnap = await db.collection('users').doc(target.id).collection('gyms').get();
  const gyms = gymsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GymDoc, 'id'>) }));
  const gymMap = new Map(gyms.map((g) => [g.id, g]));
  // Body metrics (§6a.4): the target's own doc, read via Admin SDK so an
  // authorized admin/trainer can view it read-only despite client rules.
  const bodySnap = await db.collection('users').doc(target.id).collection('meta').doc('body').get();
  const bodyRaw = bodySnap.exists ? (bodySnap.data() as Record<string, unknown>) : null;
  const bodyMetrics = bodyRaw
    ? { ...bodyRaw, weights: Array.isArray(bodyRaw.weights) ? bodyRaw.weights : [] }
    : null;
  return {
    viewer: { id: viewer.id, relation, role: viewer.role },
    person: await personJson(target),
    access: await accessList(target),
    summary: trainingSummary(workouts),
    sessions: recentSessions(workouts, gymMap),
    gyms: gymStats(workouts, gyms),
    topExercises: topExercises(workouts),
    notes: await notesFor(target.id),
    audit: relation === 'self' ? await auditFor(target.id) : [],
    bodyMetrics,
  };
}

// --- callables --------------------------------------------------------------

export const profileMe = onCall(async (req) => {
  const uid = requireAuth(req);
  const u = await loadUser(uid);
  return {
    id: u.id,
    name: displayName(u),
    username: u.username,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    role: u.role,
    avatar: !!u.avatarExt,
    access: await accessList(u),
  };
});

export const updateProfile = onCall(async (req) => {
  const uid = requireAuth(req);
  const u = await loadUser(uid);
  if (u.status === 'suspended') throw new HttpsError('permission-denied', 'forbidden');
  const body = (req.data ?? {}) as Record<string, unknown>;
  const username = cleanUsername(body.username);
  const names = parseNameInput(body);
  if (names.firstName.length < 2 || names.firstName.length > USERNAME_MAX)
    throw new HttpsError('invalid-argument', 'First name must be 2-64 characters.');
  if (username.length < 2)
    throw new HttpsError('invalid-argument', 'Username must be 2-64 characters.');

  const nameLower = username.toLowerCase();
  await db.runTransaction(async (tx) => {
    if (nameLower !== u.usernameLower) {
      const uSnap = await tx.get(usernameRef(nameLower));
      if (uSnap.exists) throw new HttpsError('already-exists', 'That username is already taken.');
    }
    tx.update(db.collection('users').doc(uid), {
      firstName: names.firstName,
      lastName: names.lastName,
      username,
      usernameLower: nameLower,
      updatedAt: Date.now(),
    });
    if (nameLower !== u.usernameLower) {
      if (u.usernameLower) tx.delete(usernameRef(u.usernameLower));
      tx.set(usernameRef(nameLower), { userId: uid });
    }
  });
  const updated = await loadUser(uid);
  return fullProfilePayload(updated, updated, 'self');
});

export const changePassword = onCall(async (req) => {
  const uid = requireAuth(req);
  const u = await loadUser(uid);
  if (u.status === 'suspended') throw new HttpsError('permission-denied', 'forbidden');
  const body = (req.data ?? {}) as Record<string, unknown>;
  const { currentPassword, newPassword } = body;
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string')
    throw new HttpsError('invalid-argument', 'Current and new password are required.');
  const credSnap = await db.collection('credentials').doc(uid).get();
  const hash = credSnap.exists ? (credSnap.data() as { passwordHash?: string }).passwordHash : null;
  if (!hash || !verifyPassword(currentPassword, hash))
    throw new HttpsError('unauthenticated', 'Current password is wrong.');
  if (!validPassword(newPassword))
    throw new HttpsError('invalid-argument', 'Password: 6 to 72 characters.');
  if (currentPassword === newPassword)
    throw new HttpsError('invalid-argument', 'New password must be different.');
  await db
    .collection('credentials')
    .doc(uid)
    .set({ passwordHash: hashPassword(newPassword) });
  return { ok: true };
});

export const profileUser = onCall(async (req) => {
  const uid = requireAuth(req);
  const viewer = await loadUser(uid);
  const rawId = (req.data ?? {}).id as unknown;
  const targetId = rawId === 'me' || typeof rawId !== 'string' ? viewer.id : rawId;
  const target = await usersById(targetId);
  if (!target) throw new HttpsError('not-found', 'not found');
  const relation = canReadProfile(viewer, target);
  if (!relation) throw new HttpsError('permission-denied', 'forbidden');
  await recordAudit(viewer.id, target.id, 'profile');
  return fullProfilePayload(viewer, target, relation);
});
