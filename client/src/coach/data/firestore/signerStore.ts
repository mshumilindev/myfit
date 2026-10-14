/**
 * The device signing key of chat messages (plan-security C.2 no. 7). One ECDSA P-256 key pair per user and device:
 * the private half is NON-extractable and lives only in this device's IndexedDB (a CryptoKey is structured-cloneable),
 * the public half is published through the `coachPublishSignKey` callable, which signs "this uid owns this key".
 * Receivers trust a key only with that server signature (`trust.ts`).
 *
 * `signer()` returns the key only after the public half is published: a message signed with an unpublished key could
 * not be verified by the other side. Offline at first use -> null -> the send fails closed (`signing-key-missing`) and
 * stays queued; nothing is ever sent unsigned once a directory is configured.
 */
import { generateSigningKey, type SigningKey } from '../../chat/chatSignature';
import type { FsApi } from './fsApi';

export interface SignerRecord {
  kid: string;
  privateKey: CryptoKey;
  publicRaw: string;
  published: boolean;
}
export interface SignerStorage {
  get(uid: string): Promise<SignerRecord | null>;
  put(uid: string, rec: SignerRecord): Promise<void>;
  del(uid: string): Promise<void>;
}

export function memorySignerStorage(): SignerStorage {
  const m = new Map<string, SignerRecord>();
  return {
    get: async (u) => m.get(u) ?? null,
    put: async (u, r) => void m.set(u, r),
    del: async (u) => void m.delete(u),
  };
}

/** IndexedDB, falling back to memory (private windows) so the session still works. */
export function idbSignerStorage(dbName = 'spotter.coach.sign'): SignerStorage {
  const mem = memorySignerStorage();
  const open = () =>
    new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open(dbName, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('k');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  const run = async <T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>) => {
    const db = await open();
    return new Promise<T>((res, rej) => {
      const req = f(db.transaction('k', mode).objectStore('k'));
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  };
  return {
    async get(uid) {
      try {
        return ((await run('readonly', (s) => s.get(uid))) as SignerRecord | undefined) ?? null;
      } catch {
        return mem.get(uid);
      }
    },
    async put(uid, rec) {
      await mem.put(uid, rec);
      try {
        await run('readwrite', (s) => s.put(rec, uid));
      } catch {
        /* memory fallback */
      }
    },
    async del(uid) {
      await mem.del(uid);
      try {
        await run('readwrite', (s) => s.delete(uid));
      } catch {
        /* nothing stored */
      }
    },
  };
}

export function createDeviceSigner(d: {
  fs: FsApi;
  uid: string;
  storage?: SignerStorage;
  generate?: () => Promise<SigningKey>;
}): () => Promise<Pick<SigningKey, 'kid' | 'privateKey'> | null> {
  const storage = d.storage ?? idbSignerStorage();
  const generate = d.generate ?? generateSigningKey;
  let inflight: Promise<Pick<SigningKey, 'kid' | 'privateKey'> | null> | null = null;

  async function load(): Promise<Pick<SigningKey, 'kid' | 'privateKey'> | null> {
    let rec = await storage.get(d.uid);
    if (!rec) {
      const k = await generate();
      rec = { kid: k.kid, privateKey: k.privateKey, publicRaw: k.publicRaw, published: false };
      await storage.put(d.uid, rec);
    }
    if (!rec.published) {
      try {
        await d.fs.call('coachPublishSignKey', { kid: rec.kid, publicRaw: rec.publicRaw });
      } catch {
        return null; // offline / not deployed: retry on the next send
      }
      rec = { ...rec, published: true };
      await storage.put(d.uid, rec);
    }
    return { kid: rec.kid, privateKey: rec.privateKey };
  }

  return () => {
    inflight ??= load().finally(() => {
      inflight = null;
    });
    return inflight;
  };
}
