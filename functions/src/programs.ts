/**
 * Programs Cloud Functions (AD-03/TR-02/O-07), ported from server/src/programs.ts.
 *
 * Authoring (list/create/update own program) is now client-direct Firestore
 * (guarded by rules: only the author writes their program). What stays here is
 * the cross-user / invariant-bearing work: assignment (one active per member),
 * status activation (member single-active + self-assignment), delete-cascade of
 * assignments, and the member's adherence read.
 */
import { onCall } from 'firebase-functions/v2/https';
import {
  db,
  requireAuth,
  requireRole,
  loadUser,
  HttpsError,
  displayName,
  createNotice,
  type UserDoc,
} from './lib';
import { listUserWorkouts } from './aggregates';

const DAY_MS = 24 * 60 * 60 * 1000;

interface ProgramDoc {
  id: string;
  authorId: string;
  name: string;
  weeks: number;
  daysPerWeek: number;
  status: 'draft' | 'active' | 'archived';
  dayNames: Record<string, string>;
  items: Array<{ day: number }>;
  updatedAt: number;
}
interface AssignmentDoc {
  memberId: string;
  programId: string;
  assignedBy: string;
  startedAt: number;
}

async function programById(id: string): Promise<ProgramDoc | null> {
  const s = await db.collection('programs').doc(id).get();
  return s.exists ? { id, ...(s.data() as Omit<ProgramDoc, 'id'>) } : null;
}
async function usersById(id: string): Promise<UserDoc | null> {
  const s = await db.collection('users').doc(id).get();
  return s.exists ? { id, ...(s.data() as Omit<UserDoc, 'id'>) } : null;
}

/** Progress of a member inside their assigned program (Today card, O-07). */
export async function programProgress(memberId: string) {
  const asgSnap = await db.collection('assignments').doc(memberId).get();
  if (!asgSnap.exists) return null;
  const asg = asgSnap.data() as AssignmentDoc;
  const p = await programById(asg.programId);
  if (!p) return null;
  const by = await usersById(asg.assignedBy);
  const workouts = await listUserWorkouts(memberId);
  const done = workouts.filter((w) => w.startedAt >= asg.startedAt && w.finishedAt !== null).length;
  const openEnded = p.weeks === 0;
  const elapsedDays = Math.max(0, Math.floor((Date.now() - asg.startedAt) / DAY_MS));
  const week = openEnded
    ? Math.floor(elapsedDays / 7) + 1
    : Math.min(p.weeks, Math.floor(elapsedDays / 7) + 1);
  const total = openEnded ? 0 : p.weeks * p.daysPerWeek;
  const expectedSoFar = openEnded
    ? Math.max(1, week * p.daysPerWeek)
    : Math.min(total, Math.max(1, week * p.daysPerWeek));
  return {
    program: p,
    assignedBy: by?.username ?? null,
    startedAt: asg.startedAt,
    week,
    done,
    total,
    expectedSoFar,
    adherence: expectedSoFar > 0 ? Math.min(1, done / expectedSoFar) : null,
  };
}

export const programMine = onCall(async (req) => {
  const uid = requireAuth(req);
  return { assignment: await programProgress(uid) };
});

export const setProgramStatus = onCall(async (req) => {
  const uid = requireAuth(req);
  const body = (req.data ?? {}) as Record<string, unknown>;
  const id = body.id;
  const status = body.status;
  if (typeof id !== 'string') throw new HttpsError('invalid-argument', 'id required');
  if (status !== 'draft' && status !== 'active' && status !== 'archived')
    throw new HttpsError('invalid-argument', 'bad status');
  const p = await programById(id);
  if (!p || p.authorId !== uid) throw new HttpsError('permission-denied', 'not yours');
  if (status === 'active') {
    for (let day = 1; day <= p.daysPerWeek; day++) {
      if (!(p.items ?? []).some((it) => Number(it.day) === day))
        throw new HttpsError('failed-precondition', 'incomplete', { day });
    }
  }
  const me = await loadUser(uid);
  const now = Date.now();
  const batch = db.batch();
  if (me.role === 'member' && status === 'active') {
    // At most one active self-authored program (AC-PROG-05).
    const others = await db
      .collection('programs')
      .where('authorId', '==', uid)
      .where('status', '==', 'active')
      .get();
    for (const d of others.docs)
      if (d.id !== id) batch.update(d.ref, { status: 'archived', updatedAt: now });
    batch.set(db.collection('assignments').doc(uid), {
      memberId: uid,
      programId: id,
      assignedBy: uid,
      startedAt: now,
    });
  } else if (me.role === 'member') {
    const asg = await db.collection('assignments').doc(uid).get();
    if (asg.exists && (asg.data() as AssignmentDoc).programId === id)
      batch.delete(db.collection('assignments').doc(uid));
  }
  batch.update(db.collection('programs').doc(id), { status, updatedAt: now });
  await batch.commit();
  return { ok: true };
});

export const assignProgram = onCall(async (req) => {
  const { uid, user: me } = await requireRole(req, ['trainer', 'admin']);
  const body = (req.data ?? {}) as Record<string, unknown>;
  const id = body.id;
  const memberId = body.memberId;
  const startWeek = body.startWeek;
  if (typeof id !== 'string') throw new HttpsError('invalid-argument', 'id required');
  if (typeof memberId !== 'string') throw new HttpsError('invalid-argument', 'memberId required');
  const p = await programById(id);
  if (!p || (me.role !== 'admin' && p.authorId !== uid))
    throw new HttpsError('permission-denied', 'not yours');
  const member = await usersById(memberId);
  if (!member) throw new HttpsError('not-found', 'member not found');
  if (me.role !== 'admin' && member.trainerId !== uid)
    throw new HttpsError('permission-denied', 'not your client');
  const sw = Math.max(1, Math.min(p.weeks === 0 ? 52 : p.weeks, Number(startWeek) || 1));
  const startedAt = Date.now() - (sw - 1) * 7 * DAY_MS;
  const prior = await db.collection('assignments').doc(memberId).get();
  await db.collection('assignments').doc(memberId).set({
    memberId,
    programId: p.id,
    assignedBy: uid,
    startedAt,
  });
  if (memberId !== uid) {
    await createNotice(
      memberId,
      prior.exists ? 'program-replaced' : 'program-assigned',
      displayName(me),
      p.name,
    );
  }
  return { ok: true };
});

export const unassignProgram = onCall(async (req) => {
  await requireRole(req, ['trainer', 'admin']);
  const memberId = (req.data ?? {}).memberId as unknown;
  if (typeof memberId !== 'string') throw new HttpsError('invalid-argument', 'memberId required');
  await db
    .collection('assignments')
    .doc(memberId)
    .delete()
    .catch(() => undefined);
  return { ok: true };
});

export const deleteProgram = onCall(async (req) => {
  const uid = requireAuth(req);
  const id = (req.data ?? {}).id as unknown;
  if (typeof id !== 'string') throw new HttpsError('invalid-argument', 'id required');
  const p = await programById(id);
  if (!p) return { ok: true };
  if (p.authorId !== uid) throw new HttpsError('permission-denied', 'not yours');
  const batch = db.batch();
  batch.delete(db.collection('programs').doc(id));
  const assigned = await db.collection('assignments').where('programId', '==', id).get();
  for (const d of assigned.docs) batch.delete(d.ref);
  await batch.commit();
  return { ok: true };
});
