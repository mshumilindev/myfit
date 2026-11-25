/** Typed maxes: the Firestore listener, the writes, and a small in-memory store the page and the rules read. */
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { useSyncExternalStore } from 'react';
import { auth, db } from '../firebase';
import { EMPTY_MAXES, openMaxes, sealMaxes, withMax, withoutMax, type MaxesDoc } from './maxesData';

let current: MaxesDoc = EMPTY_MAXES;
/** True once the stored document has been read (or is known not to exist): until then `current` is not the person's data. */
let loaded = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export const subscribeMaxes = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

/** False until the stored document has been read: an export before that would be silently empty. */
export const isMaxesLoaded = (): boolean => loaded;

export const getTypedMaxes = (): MaxesDoc => current;
export const useTypedMaxes = (): MaxesDoc => useSyncExternalStore(subscribeMaxes, getTypedMaxes);

const uid = (): string | null => auth.currentUser?.uid ?? null;

const maxesRef = (u: string) => doc(db, 'users', u, 'meta', 'maxes');

/** Take the stored document into `current` before a write builds on it, so a write never replaces maxes it has not seen. */
async function ensureLoaded(u: string): Promise<void> {
  if (loaded) return;
  try {
    const snap = await getDoc(maxesRef(u));
    if (snap.exists()) {
      const m = await openMaxes(snap.data());
      if (m && m.updatedAt >= current.updatedAt) current = m;
    }
    loaded = true;
  } catch {
    /* offline without a cached copy: write on what is here; the first snapshot merges later */
  }
}

async function write(change: (cur: MaxesDoc) => MaxesDoc): Promise<void> {
  const u = uid();
  if (!u) return;
  await ensureLoaded(u);
  const before = current;
  const next = change(before);
  if (next === before) return;
  const now = Date.now();
  current = { ...next, updatedAt: now }; // shown at once; the snapshot of our own write confirms it
  emit();
  try {
    await setDoc(maxesRef(u), await sealMaxes(next, now));
  } catch (e) {
    if (current.updatedAt === now) {
      current = before; // the write did not go through: do not keep showing it as saved
      emit();
    }
    throw e;
  }
}

/** Type a max for an exercise (replaces the estimate from history). */
export const saveMax = (name: string, kg: number): Promise<void> =>
  write((cur) => withMax(cur, name, kg, Date.now()));

/** Forget the typed max of an exercise: the estimate from history applies again. */
export const clearMax = (name: string): Promise<void> =>
  write((cur) => withoutMax(cur, name, Date.now()));

/** Start the listener for a signed-in person. Returns the stop function (sign-out). */
export function startMaxesSync(u: string): () => void {
  const stop = onSnapshot(
    maxesRef(u),
    (snap) => {
      if (!snap.exists()) {
        // Nothing stored (and the server said so): there is nothing to merge before a first write.
        if (!snap.metadata?.fromCache) loaded = true;
        return;
      }
      void openMaxes(snap.data()).then((m) => {
        if (!m) return;
        loaded = true;
        if (m.updatedAt >= current.updatedAt) {
          current = m;
          emit();
        }
      });
    },
    (e) => console.warn('[maxes] listener', e),
  );
  return () => {
    stop();
    loaded = false;
    current = EMPTY_MAXES;
    emit();
  };
}

/** Test and design-lab harness: fill the store without Firestore. */
export function seedMaxes(next: MaxesDoc): void {
  current = next;
  loaded = true;
  emit();
}
