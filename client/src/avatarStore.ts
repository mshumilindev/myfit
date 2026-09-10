/**
 * Persistent avatar cache (IndexedDB). The in-memory object-URL cache in
 * Avatar.tsx only survives the current page, so every reload re-downloaded each
 * photo from Cloud Storage. This layer keeps the raw blob on disk keyed by uid
 * together with a server revision, so avatars — clients' and your own — paint
 * instantly after a reload and the network is only touched when the revision
 * actually changed (delta check). Best-effort: any failure degrades to the
 * previous getBlob path, never throws into render.
 */

const DB_NAME = 'spotter-avatars';
const STORE = 'blobs';
const DB_VERSION = 1;

interface AvatarRecord {
  uid: string;
  rev: number;
  blob: Blob;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const idb = req.result;
        if (!idb.objectStoreNames.contains(STORE)) {
          idb.createObjectStore(STORE, { keyPath: 'uid' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

/**
 * Read the cached blob for a user. When `wantRev` is a real revision (> 0) the
 * stored copy is only returned if its revision matches — a mismatch means the
 * photo changed server-side and the caller must refetch. When `wantRev` is 0 or
 * omitted (revision unknown to the caller) the stored copy is returned as-is.
 */
export function readAvatarBlob(uid: string, wantRev = 0): Promise<Blob | null> {
  return openDb().then(
    (idb) =>
      new Promise<Blob | null>((resolve) => {
        if (!idb) {
          resolve(null);
          return;
        }
        try {
          const tx = idb.transaction(STORE, 'readonly');
          const req = tx.objectStore(STORE).get(uid);
          req.onsuccess = () => {
            const rec = req.result as AvatarRecord | undefined;
            if (!rec) {
              resolve(null);
              return;
            }
            if (wantRev > 0 && rec.rev !== wantRev) {
              resolve(null);
              return;
            }
            resolve(rec.blob);
          };
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

/** Persist a blob for a user at a given revision (best-effort). */
export function writeAvatarBlob(uid: string, rev: number, blob: Blob): void {
  void openDb().then((idb) => {
    if (!idb) return;
    try {
      const tx = idb.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ uid, rev, blob } satisfies AvatarRecord);
    } catch {
      /* best-effort */
    }
  });
}

/** Drop a user's cached blob (photo removed or replaced). */
export function deleteAvatarBlob(uid: string): void {
  void openDb().then((idb) => {
    if (!idb) return;
    try {
      const tx = idb.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(uid);
    } catch {
      /* best-effort */
    }
  });
}
