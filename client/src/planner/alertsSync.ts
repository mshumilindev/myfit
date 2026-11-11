/**
 * Shared ring state across the owner's devices: `users/{uid}/plannerAlerts/{ringKey}` (no content, so not sealed).
 * A dismiss or snooze is written in a transaction with the race rule of `mergeAlert`; every other open device hears it at once
 * and stops ringing. The local store in `RingLayer` stays the first answer, so it also works offline (the write queues).
 */
import { collection, doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { useSyncExternalStore } from 'react';
import { auth, db } from '../firebase';
import { foldAlerts, mergeAlert } from './alertsCore';
import type { AlertState } from './alertsCore';

type Folded = ReturnType<typeof foldAlerts>;
const EMPTY: Folded = { handled: new Set(), snoozed: {} };
let folded: Folded = EMPTY;
const subs = new Set<() => void>();
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

/** Listen to the shared ring states of a signed-in person. Returns the stop function. */
export function startAlertsSync(u: string): () => void {
  const stop = onSnapshot(
    collection(db, 'users', u, 'plannerAlerts'),
    (snap) => {
      const states: Record<string, AlertState> = {};
      for (const d of snap.docs) states[d.id] = d.data() as AlertState;
      folded = foldAlerts(states);
      subs.forEach((f) => f());
    },
    (e) => console.warn('[planner] alerts listener', e),
  );
  return () => {
    stop();
    folded = EMPTY;
    subs.forEach((f) => f());
  };
}

/** Dismissed keys and snooze ends heard from any device (this one included, once the write lands). */
export const useSharedAlerts = (): Folded => useSyncExternalStore(subscribe, () => folded);

const deviceId = (() => {
  try {
    const k = 'planner.device.v1';
    let v = localStorage.getItem(k);
    if (!v) {
      v = Math.random().toString(36).slice(2, 10);
      localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return 'anon';
  }
})();

/** Write a dismiss / snooze for one ring. Never throws: the local state already took effect. */
export async function writeAlert(
  key: string,
  planId: string,
  dueAt: number,
  next: { state: 'snoozed' | 'dismissed'; snoozeUntil?: number },
): Promise<void> {
  const u = auth.currentUser?.uid;
  if (!u) return;
  const ref = doc(db, 'users', u, 'plannerAlerts', key);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const merged = mergeAlert(snap.exists() ? (snap.data() as AlertState) : undefined, next);
      if (!merged) return;
      tx.set(ref, {
        ...merged,
        by: deviceId,
        eventId: planId,
        dueAt,
        updatedAt: Date.now(),
      });
    });
  } catch (e) {
    console.warn('[planner] alert write', e);
  }
}
