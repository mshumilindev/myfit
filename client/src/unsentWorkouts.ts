/**
 * Finished workouts whose write is still waiting for the encryption key (SPO-269): the write is parked in memory
 * and would be lost with the tab, and the next server snapshot would then drop the workout from this device.
 * The ids are kept in localStorage (never the data: that stays in the app state), per account, until the write
 * has been handed to Firestore's own offline queue; they are re-sent on the next start.
 */
export const UNSENT_KEY = 'spotter.unsentWorkouts.v1';
function readUnsent(uid: string): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(UNSENT_KEY) ?? 'null') as {
      uid?: string;
      ids?: unknown;
    } | null;
    if (!raw || raw.uid !== uid || !Array.isArray(raw.ids)) return new Set();
    return new Set(raw.ids.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}
export const unsentWorkouts = new Set<string>();
let unsentUid: string | null = null;
export function saveUnsent(uid: string): void {
  try {
    if (unsentWorkouts.size === 0) localStorage.removeItem(UNSENT_KEY);
    else localStorage.setItem(UNSENT_KEY, JSON.stringify({ uid, ids: [...unsentWorkouts] }));
  } catch {
    /* storage full or blocked: the write still goes out in this session */
  }
}
export function loadUnsent(uid: string): void {
  if (unsentUid !== uid) {
    unsentWorkouts.clear();
    unsentUid = uid;
  }
  for (const id of readUnsent(uid)) unsentWorkouts.add(id);
}
/** Re-sends the finished workouts whose write never reached Firestore's queue (idempotent upsert). */
export function resendUnsentWorkouts<W extends { finishedAt: number | null }>(
  uid: string,
  find: (id: string) => W | undefined,
  write: (w: W) => void,
): void {
  loadUnsent(uid);
  for (const id of [...unsentWorkouts]) {
    const w = find(id);
    if (w && w.finishedAt !== null) write(w);
    else unsentWorkouts.delete(id);
  }
  saveUnsent(uid);
}

/**
 * Latest write generation per workout id. A write parked while the vault key is missing checks it before it fires, so a
 * delete (or a newer write) made in the meantime wins and a parked setDoc cannot bring a deleted document back.
 */
export const workoutWriteGen = new Map<string, number>();
export const bumpWorkoutGen = (id: string): number => {
  const g = (workoutWriteGen.get(id) ?? 0) + 1;
  workoutWriteGen.set(id, g);
  return g;
};
