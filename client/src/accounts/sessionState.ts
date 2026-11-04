/**
 * Instant sign-out of a revoked device (SPO-436). The session functions mirror `revokedAt` into
 * `users/{uid}/sessionState/{deviceId}`; this device listens to its own document and ends itself the moment the flag
 * appears. Offline it simply stays quiet: the check at start / focus / back online (sessions.ts) is the fallback.
 */
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

/** `onRevoked` runs once. Returns the unsubscribe. A listener error is ignored (the periodic check still runs). */
export function watchRevokedFlag(uid: string, deviceId: string, onRevoked: () => void): () => void {
  let done = false;
  return onSnapshot(
    doc(db, 'users', uid, 'sessionState', deviceId),
    (snap) => {
      // A cached copy may hold an old flag: only the server's word ends a device.
      // A cached copy may hold an old flag: only the server's word ends a device.
      if (done || snap.metadata?.fromCache || !snap.exists() || !snap.data()?.revokedAt) return;
      done = true;
      onRevoked();
    },
    () => undefined,
  );
}
