/**
 * What stays on a device after sign-out or after a coaching relationship ends, and how it is removed.
 *
 *   sign-out        EVERYTHING of the account: the sealed coach store, the device signer, the avatar cache, the callable
 *                   read cache (`spotter.cache.*`), the last coach route and Firestore's offline persistence. Firestore's
 *                   cache cannot be cleared while the SDK runs, so sign-out sets a flag, deletes what it can now and
 *                   reloads; the flag is honoured BEFORE the SDK opens its database (`runPendingWipe`, main.tsx).
 *   relationship    the sealed entries of that conversation (`wipeCid`), the read cache and the last route at once. The
 *   end             Firestore cache holds the client's documents too: it is dropped at the next start, but only when
 *                   every local write has reached the server (`waitForPendingWrites`), so ending a relationship can
 *                   never discard an unsynced workout. If writes are still pending, the sign-out wipe covers it.
 *
 * Everything is best-effort and injectable (tests); nothing here throws.
 */

export const FS_WIPE_FLAG = 'spotter.wipeFs';
/** The IndexedDB databases that hold coach data (sealed chat store, device signer) and cached avatars. */
export const COACH_IDB_NAMES = ['spotter.coach.chat', 'spotter.coach.sign', 'spotter-avatars'];
/** The old PLAINTEXT read caches (callable reads, the assigned program). Nothing writes them any more; they are removed. */
const CACHE_PREFIX = 'spotter.cache.';
const LEGACY_PLAINTEXT_KEYS = ['spotter.programMine'];
const COACH_LOCAL_KEYS = ['coach:last'];

export interface WipeEnv {
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'> | null;
  idb: {
    databases?: () => Promise<{ name?: string }[]>;
    deleteDatabase: (name: string) => unknown;
  } | null;
  /** Resolves when every Firestore write has reached the server; rejects / never settles when it cannot. */
  pendingWritesDone?: () => Promise<void>;
  /** ms to wait for the writes and for a blocked deleteDatabase */
  waitMs?: number;
  reload?: () => void;
}

export function browserEnv(): WipeEnv {
  let storage: WipeEnv['storage'];
  try {
    storage = typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    storage = null; // access denied (blocked site data)
  }
  return {
    storage,
    idb: typeof indexedDB === 'undefined' ? null : (indexedDB as unknown as WipeEnv['idb']),
    reload: () => {
      if (import.meta.env.MODE === 'test') return;
      try {
        window.location.reload();
      } catch {
        /* nothing to do */
      }
    },
  };
}

const settleIn = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function removeKeys(env: WipeEnv, match: (k: string) => boolean): void {
  const s = env.storage;
  if (!s) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && match(k)) keys.push(k);
    }
    keys.forEach((k) => s.removeItem(k));
  } catch {
    /* best effort */
  }
}

async function deleteDb(env: WipeEnv, name: string): Promise<void> {
  const idb = env.idb;
  if (!idb) return;
  await Promise.race([
    new Promise<void>((res) => {
      try {
        const r = idb.deleteDatabase(name) as {
          onsuccess: (() => void) | null;
          onerror: (() => void) | null;
          onblocked: (() => void) | null;
        } | null;
        if (!r || typeof r !== 'object') return res();
        r.onsuccess = () => res();
        r.onerror = () => res();
        r.onblocked = () => res(); // still open in this page: deleted as soon as it closes (the reload)
      } catch {
        res();
      }
    }),
    settleIn(env.waitMs ?? 1500),
  ]);
}

/** Firestore's own databases are named `firestore/<app>/<project>/main`. */
async function firestoreDbNames(env: WipeEnv): Promise<string[]> {
  try {
    const list = (await env.idb?.databases?.()) ?? [];
    return list.map((d) => d.name ?? '').filter((n) => n.startsWith('firestore/'));
  } catch {
    return [];
  }
}

export async function deleteFirestoreDatabases(env: WipeEnv = browserEnv()): Promise<void> {
  for (const n of await firestoreDbNames(env)) await deleteDb(env, n);
}

/** Boot, before the SDK opens its database: honour a pending Firestore wipe. */
export async function runPendingWipe(env: WipeEnv = browserEnv()): Promise<boolean> {
  let pending = false;
  try {
    pending = env.storage?.getItem(FS_WIPE_FLAG) === '1';
  } catch {
    /* no storage */
  }
  if (!pending) return false;
  await deleteFirestoreDatabases(env);
  try {
    env.storage?.removeItem(FS_WIPE_FLAG);
  } catch {
    /* ignore */
  }
  return true;
}

/**
 * Local read caches that name clients: the legacy plaintext callable cache and the last coach route. (The current offline
 * snapshots are sealed, in the coach IndexedDB store: `wipeOfflineEntries` / the sign-out database delete remove them.)
 */
export function wipeCoachCaches(env: WipeEnv = browserEnv()): void {
  removeKeys(
    env,
    (k) =>
      k.startsWith(CACHE_PREFIX) ||
      LEGACY_PLAINTEXT_KEYS.includes(k) ||
      COACH_LOCAL_KEYS.includes(k),
  );
}

/** First run after the offline layer became sealed: readable personal data left by older versions must not linger. */
export function purgeLegacyPlaintext(env: WipeEnv = browserEnv()): void {
  removeKeys(env, (k) => k.startsWith(CACHE_PREFIX) || LEGACY_PLAINTEXT_KEYS.includes(k));
}

const flagFirestoreWipe = (env: WipeEnv) => {
  try {
    env.storage?.setItem(FS_WIPE_FLAG, '1');
  } catch {
    /* ignore */
  }
};

/**
 * A relationship ended: caches now, Firestore's offline cache at the next start. Returns whether the Firestore wipe was
 * scheduled (false: local writes are still pending, nothing is discarded; the next sign-out wipes it).
 */
export async function wipeAfterRelationshipEnd(env: WipeEnv = browserEnv()): Promise<boolean> {
  wipeCoachCaches(env);
  if (!env.pendingWritesDone) return false;
  const done = await Promise.race([
    env.pendingWritesDone().then(
      () => true,
      () => false,
    ),
    settleIn(env.waitMs ?? 5000).then(() => false),
  ]);
  if (done) flagFirestoreWipe(env);
  return done;
}

/** Sign-out: the account's data leaves this device. The caller reloads (env.reload) so the SDK restarts clean. */
export async function wipeAfterSignOut(env: WipeEnv = browserEnv()): Promise<void> {
  wipeCoachCaches(env);
  flagFirestoreWipe(env); // survives a failure below and a closed tab: honoured at the next start
  for (const n of COACH_IDB_NAMES) await deleteDb(env, n);
  await deleteFirestoreDatabases(env);
  env.reload?.();
}

/** The app's env with the live Firestore handle (lazy: the Gym entry never loads firebase/firestore for this). */
export async function liveEnv(): Promise<WipeEnv> {
  const env = browserEnv();
  try {
    const [{ db }, { waitForPendingWrites }] = await Promise.all([
      import('./firebase'),
      import('firebase/firestore'),
    ]);
    env.pendingWritesDone = () => waitForPendingWrites(db);
  } catch {
    /* no Firestore (tests, storybook) */
  }
  return env;
}
