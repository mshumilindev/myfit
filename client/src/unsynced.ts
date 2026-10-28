/**
 * What has not reached the server yet, and the wait before sign-out wipes the device (SPO-384).
 *
 * Sign-out removes Firestore's offline cache, which also holds the writes it has not confirmed, and the chat outbox with
 * it. So before anything is removed we (1) count what is still waiting, (2) give it a few seconds to go out while the
 * session still works, and (3) if it did not, ask the person with the real count. Nothing here imports Firebase: the
 * Firestore wait and the chat queues register themselves (keeps this file a leaf, like the sign-out flushers in api.ts).
 */
import { getSyncMeta } from './syncMeta';

/** How long sign-out waits for the queues to empty before it asks. */
export const DRAIN_MS = 5000;
const POLL_MS = 250;
/** Sleep nights the person deleted that the server has not confirmed (store.ts `SLEEP_TOMB_KEY`). */
const SLEEP_TOMB_KEY = 'spotter.sleepTombstones.v1';

export interface UnsyncedSource {
  /** How many items of this queue are still waiting (never throws). */
  count: () => number;
}

const sources = new Map<string, UnsyncedSource>();
let firestoreDrain: (() => Promise<void>) | null = null;
let prompt: ((remaining: number, proceed: () => void) => void) | null = null;

/** A queue that holds changes only this device has (a chat outbox, …). One entry per id; the latest registration wins. */
export function registerUnsynced(id: string, src: UnsyncedSource): void {
  sources.set(id, src);
}
/** Resolves when every Firestore write has been confirmed by the server; rejects when it cannot. */
export function registerFirestoreDrain(fn: (() => Promise<void>) | null): void {
  firestoreDrain = fn;
}
/** The app's "N changes are still queued, sign out anyway?" question (App.tsx). `proceed` signs out and discards them. */
export function setUnsyncedPrompt(
  fn: ((remaining: number, proceed: () => void) => void) | null,
): void {
  prompt = fn;
}
/** Hands the question to the app; false when nothing can ask (then nothing is wiped). */
export function askUnsynced(remaining: number, proceed: () => void): boolean {
  if (!prompt) return false;
  prompt(remaining, proceed);
  return true;
}

function sleepDeletes(): number {
  try {
    const raw = localStorage.getItem(SLEEP_TOMB_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.length : 0;
  } catch {
    return 0;
  }
}

/** Unconfirmed workouts + chat messages not yet delivered + sleep deletes not yet confirmed. */
export function unsyncedCount(): number {
  let n = getSyncMeta().pendingWrites + sleepDeletes();
  for (const s of sources.values()) {
    try {
      n += Math.max(0, s.count());
    } catch {
      /* a broken source must not block sign-out */
    }
  }
  return n;
}

/**
 * Waits (up to `timeoutMs`) for the queues to empty and Firestore to confirm its writes. `ok` only when both are done;
 * otherwise `remaining` is the count (at least 1 when Firestore itself did not confirm, since it has no per-collection count).
 */
export async function drainUnsynced(
  timeoutMs: number = DRAIN_MS,
): Promise<{ ok: boolean; remaining: number }> {
  let fsOk = true;
  let fsWait: Promise<void> = Promise.resolve();
  if (firestoreDrain) {
    fsOk = false;
    try {
      fsWait = firestoreDrain().then(
        () => {
          fsOk = true;
        },
        () => undefined, // refused: stays not-ok, and the wait ends now
      );
    } catch {
      fsWait = Promise.resolve();
    }
  }
  let stop = false;
  let poll: ReturnType<typeof setTimeout> | undefined;
  const queues = new Promise<void>((resolve) => {
    const tick = () => {
      if (stop) return;
      if (unsyncedCount() === 0) resolve();
      else poll = setTimeout(tick, POLL_MS);
    };
    tick();
  });
  let limit: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    limit = setTimeout(resolve, timeoutMs);
  });
  await Promise.race([Promise.all([queues, fsWait]).then(() => undefined), timeout]);
  stop = true;
  clearTimeout(poll);
  clearTimeout(limit);
  const count = unsyncedCount();
  const ok = fsOk && count === 0;
  return { ok, remaining: ok ? 0 : Math.max(1, count) };
}
