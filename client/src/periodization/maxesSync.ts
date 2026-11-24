/** Typed maxes: the Firestore listener, the writes, and a small in-memory store the page and the rules read. */
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useSyncExternalStore } from 'react';
import { auth, db } from '../firebase';
import { EMPTY_MAXES, openMaxes, sealMaxes, withMax, withoutMax, type MaxesDoc } from './maxesData';

let current: MaxesDoc = EMPTY_MAXES;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export const subscribeMaxes = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

export const getTypedMaxes = (): MaxesDoc => current;
export const useTypedMaxes = (): MaxesDoc => useSyncExternalStore(subscribeMaxes, getTypedMaxes);

const uid = (): string | null => auth.currentUser?.uid ?? null;

async function write(next: MaxesDoc): Promise<void> {
  const u = uid();
  if (!u) return;
  const now = Date.now();
  current = { ...next, updatedAt: now }; // shown at once; the snapshot of our own write confirms it
  emit();
  await setDoc(doc(db, 'users', u, 'meta', 'maxes'), await sealMaxes(next, now));
}

/** Type a max for an exercise (replaces the estimate from history). */
export const saveMax = (name: string, kg: number): Promise<void> =>
  write(withMax(current, name, kg, Date.now()));

/** Forget the typed max of an exercise: the estimate from history applies again. */
export const clearMax = (name: string): Promise<void> =>
  write(withoutMax(current, name, Date.now()));

/** Start the listener for a signed-in person. Returns the stop function (sign-out). */
export function startMaxesSync(u: string): () => void {
  const stop = onSnapshot(
    doc(db, 'users', u, 'meta', 'maxes'),
    (snap) => {
      if (!snap.exists()) return;
      void openMaxes(snap.data()).then((m) => {
        if (m && m.updatedAt >= current.updatedAt) {
          current = m;
          emit();
        }
      });
    },
    (e) => console.warn('[maxes] listener', e),
  );
  return () => {
    stop();
    current = EMPTY_MAXES;
    emit();
  };
}

/** Test and design-lab harness: fill the store without Firestore. */
export function seedMaxes(next: MaxesDoc): void {
  current = next;
  emit();
}
