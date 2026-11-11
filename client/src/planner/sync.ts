/**
 * Planner plans and prefs: the Firestore listeners, the writes, and a small in-memory store the screens read.
 * Documents are sealed (`data.ts`); Firestore's own cache makes writes work offline and shows pending writes at once.
 */
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useSyncExternalStore } from 'react';
import { auth, db } from '../firebase';
import { mirrorCollection } from '../vaultIO';
import { DEFAULT_PREFS, openPrefs, sealPlan, sealPrefs } from './data';
import type { PlanDoc, PlannerPrefs } from './types';

let plans: PlanDoc[] = [];
let prefs: PlannerPrefs = DEFAULT_PREFS;
let locked = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

/** Design-comparison harness only (design-lab/cmp.tsx): fill the store without Firestore. */
export function seedPlannerPreview(next: PlanDoc[]): void {
  plans = next;
  emit();
}

export const getPlans = (): PlanDoc[] => plans;
export const getPrefs = (): PlannerPrefs => prefs;
/** Plans that exist but cannot be opened yet (no vault key on this device). */
export const lockedPlans = (): number => locked;

export const usePlans = (): PlanDoc[] => useSyncExternalStore(subscribe, getPlans);
export const usePrefs = (): PlannerPrefs => useSyncExternalStore(subscribe, getPrefs);

const uid = (): string | null => auth.currentUser?.uid ?? null;

export async function savePlan(plan: PlanDoc): Promise<void> {
  const u = uid();
  if (!u) return;
  await setDoc(doc(db, 'users', u, 'plannerEvents', plan.id), await sealPlan(plan, Date.now()));
}

export async function deletePlan(id: string): Promise<void> {
  const u = uid();
  if (u) await deleteDoc(doc(db, 'users', u, 'plannerEvents', id));
}

export async function savePrefs(next: PlannerPrefs): Promise<void> {
  const u = uid();
  if (!u) return;
  await setDoc(doc(db, 'users', u, 'meta', 'planner'), await sealPrefs(next, Date.now()));
}

/** Start the listeners for a signed-in person. Returns the stop function (sign-out, add-on removed). */
export function startPlannerSync(u: string): () => void {
  const mirror = mirrorCollection<PlanDoc>((items, info) => {
    plans = items;
    locked = info.locked;
    emit();
  });
  const stopPlans = onSnapshot(
    collection(db, 'users', u, 'plannerEvents'),
    (snap) => mirror.push(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
    (e) => console.warn('[planner] plans listener', e),
  );
  const stopPrefs = onSnapshot(
    doc(db, 'users', u, 'meta', 'planner'),
    (snap) => {
      if (!snap.exists()) return;
      void openPrefs(snap.data()).then((p) => {
        if (p) {
          prefs = { ...DEFAULT_PREFS, ...p };
          emit();
        }
      });
    },
    (e) => console.warn('[planner] prefs listener', e),
  );
  return () => {
    stopPlans();
    stopPrefs();
    mirror.dispose();
    plans = [];
    prefs = DEFAULT_PREFS;
    locked = 0;
    emit();
  };
}
