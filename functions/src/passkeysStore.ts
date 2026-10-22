/** Firestore storage of passkeys and their challenges (SPO-211), plus the cleanup other modules call when access changes. */
import { db } from './lib';
import {
  PasskeyError,
  type ChallengeDoc,
  type PasskeyDoc,
  type PasskeyStore,
} from './passkeysCore';

export const firestoreStore: PasskeyStore = {
  async putChallenge(id, doc) {
    // `expireAt` is a Date so a Firestore TTL policy on passkeyChallenges.expireAt can sweep abandoned challenges.
    await db
      .collection('passkeyChallenges')
      .doc(id)
      .set({ ...doc, expireAt: new Date(doc.expiresAt + 60 * 60 * 1000) });
  },
  async takeChallenge(id) {
    const ref = db.collection('passkeyChallenges').doc(id);
    // Read + delete in one transaction: two parallel verifications cannot both consume the same challenge.
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      tx.delete(ref);
      return snap.data() as ChallengeDoc;
    });
  },
  async getPasskey(id) {
    const snap = await db.collection('passkeys').doc(id).get();
    return snap.exists ? (snap.data() as PasskeyDoc) : null;
  },
  async savePasskey(id, doc) {
    try {
      await db.collection('passkeys').doc(id).create(doc);
    } catch (e) {
      if (
        (e as { code?: number | string })?.code === 6 ||
        (e as { code?: string })?.code === 'already-exists'
      )
        throw new PasskeyError('permission-denied', 'This passkey is already registered.');
      throw e;
    }
  },
  async deletePasskey(id) {
    await db.collection('passkeys').doc(id).delete();
  },
  async updatePasskey(id, patch) {
    await db.collection('passkeys').doc(id).update(patch);
  },
  async listPasskeys(userId) {
    const snap = await db.collection('passkeys').where('userId', '==', userId).get();
    return snap.docs.map((d) => {
      const p = d.data() as PasskeyDoc;
      return { id: d.id, transports: p.transports, deviceId: p.deviceId ?? null };
    });
  },
};

/** Removes the person's passkeys, optionally keeping the ones of one device. Called on password change / reset, role change and suspension. */
export async function deletePasskeysOf(userId: string, keepDeviceId?: string): Promise<number> {
  const snap = await db.collection('passkeys').where('userId', '==', userId).get();
  const doomed = snap.docs.filter(
    (d) => !(keepDeviceId && (d.data() as PasskeyDoc).deviceId === keepDeviceId),
  );
  await Promise.all(doomed.map((d) => d.ref.delete()));
  return doomed.length;
}

/** Removes the passkeys made on one device (that device was signed out). */
export async function deletePasskeysOfDevice(userId: string, deviceId: string): Promise<void> {
  const snap = await db
    .collection('passkeys')
    .where('userId', '==', userId)
    .where('deviceId', '==', deviceId)
    .get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}
