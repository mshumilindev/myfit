/**
 * The sealed single-document `users/{uid}/meta/<name>` stores of the person's own settings (SPO-217): physique goals,
 * home sets, mastery history and the Atlas settings. Writes wait for the vault key and are sealed (never plaintext);
 * reads open the document with the key through a mirror, which keeps legacy (not yet migrated) plaintext documents readable.
 */
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { mirrorCollection, prepareWrite } from './vaultIO';

export type SealedMetaName =
  | 'goals'
  | 'home'
  | 'mastery'
  | 'coach'
  | 'exercisePrefs'
  | 'sleepPrefs'
  | 'widgetData'
  | 'challenges'
  | 'atlasChatState';

/** A plain JSON copy of `value` carrying the integer freshness stamp the rules demand. */
export const stampedCopy = (value: object, updatedAt: number): Record<string, unknown> =>
  JSON.parse(JSON.stringify({ ...value, updatedAt }));

export function writeSealedMeta(
  uid: string,
  name: SealedMetaName,
  data: Record<string, unknown>,
  onError: (e: unknown) => void,
): void {
  prepareWrite(name, data)
    .then((d) => setDoc(doc(db, 'users', uid, 'meta', name), d))
    .catch(onError);
}

/**
 * Listens to the document. `apply` gets `[]` when it does not exist; while it is sealed and the vault is locked it gets
 * `[]` with `info.locked > 0`, which must NOT be read as "no server copy". Returns the unsubscribe.
 */
export function watchSealedMeta<T extends Record<string, unknown>>(
  uid: string,
  name: SealedMetaName,
  apply: (items: T[], info: { locked: number }) => void,
  onError: (e: unknown) => void,
): () => void {
  const mirror = mirrorCollection<T>(apply);
  const off = onSnapshot(
    doc(db, 'users', uid, 'meta', name),
    (snap) => mirror.push(snap.exists() ? [snap.data()] : []),
    onError,
  );
  return () => {
    off();
    mirror.dispose();
  };
}
