/**
 * Account deletion on Firebase (SPO-285): the ports of `accountDeletionCore.ts` bound to Admin SDK, and the self-service
 * callable `deleteMyAccount`. `admin.ts` (`adminDeleteUser`) uses the same `firebaseDeletionPorts` and the same cascade.
 */
import { onCall } from 'firebase-functions/v2/https';
import { authAdmin, bucket, db, verifyPassword } from './lib';
import { coachCallOptions, coachCtx } from './coach/runtime';
import {
  deleteAccountCascade,
  deleteMyAccountHandler,
  type DeleteMyAccountPorts,
  type DeletionPorts,
} from './accountDeletionCore';

const notFound = (e: unknown): boolean => (e as { code?: string })?.code === 'auth/user-not-found';

export const firebaseDeletionPorts: DeletionPorts = {
  async revokeSessions(uid) {
    try {
      await authAdmin.revokeRefreshTokens(uid);
    } catch (e) {
      if (!notFound(e)) throw e;
    }
  },
  async deleteTree(path) {
    await db.recursiveDelete(db.doc(path));
  },
  async deleteStorage(prefix) {
    await bucket.deleteFiles({ prefix, force: true });
  },
  async walkTrainerAuthoredNotes(trainerUid) {
    // the fallback for `deleteTrainerAuthoredNotes` (collection-group query) when its index is not deployed yet
    const users = await db.collection('users').select().get();
    for (const user of users.docs) {
      const notes = await user.ref
        .collection('trainerNotes')
        .where('trainerId', '==', trainerUid)
        .get();
      for (const note of notes.docs) await note.ref.delete();
    }
  },
  async deleteAuthUser(uid) {
    try {
      await authAdmin.deleteUser(uid); // the Auth record would otherwise outlive the account
    } catch (e) {
      if (!notFound(e)) throw e;
    }
  },
};

/** Port for the phantom-parent sweep (`accountMaintenanceCore.ts`): `users/{id}` ids that have subcollections but no document. */
export const phantomUserIds = async (): Promise<string[]> => {
  const [all, real] = await Promise.all([
    db.collection('users').listDocuments(), // includes "missing" parents, ids only
    db.collection('users').select().get(), // only documents that exist
  ]);
  const have = new Set(real.docs.map((d) => d.id));
  return all.map((r) => r.id).filter((id) => !have.has(id));
};

/** The admin path: same cascade, the caller has already been checked. */
export const adminCascade = (uid: string) =>
  deleteAccountCascade(coachCtx(), firebaseDeletionPorts, uid);

const selfPorts: DeleteMyAccountPorts = { ...firebaseDeletionPorts, verifyPassword };

/**
 * Deletes the signed-in caller's own account and nothing else (the uid is the session's; the request carries only the
 * password, which is the server-verified step-up, and `confirm: true`). Idempotent: a retry finishes what is left.
 */
export const deleteMyAccount = onCall(
  { ...coachCallOptions, timeoutSeconds: 540, memory: '512MiB', maxInstances: 5 },
  async (req) => {
    const out = await deleteMyAccountHandler(coachCtx(), selfPorts, {
      uid: req.auth?.uid,
      data: req.data,
      now: Date.now(),
    });
    console.info('[account-deletion] self-service deletion completed'); // no uid, no name: nothing personal in logs
    return out;
  },
);
