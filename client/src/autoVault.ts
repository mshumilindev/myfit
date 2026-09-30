/**
 * The vault with no user action: the data key comes from the server for the signed-in
 * account (see functions/src/vault.ts) and nothing has to be saved, typed or passed around.
 *
 *  - The fresh key is held in memory as an extractable CryptoKey, so the owner can grant it
 *    to a coach (vaultGrants).
 *  - A non-extractable copy is cached in IndexedDB so the app opens offline. Scripts on the
 *    page can use it but cannot read the key bytes out of storage.
 *  - Status: `ready` once a key is present; `unset` while none could be obtained (offline on
 *    a first visit, function not deployed): writes stay as before and are sealed the moment
 *    a key arrives. Nothing is ever written with a key that is not the account's own.
 */
import { importRawKey } from './vaultCrypto';

export type VaultStatus = 'unknown' | 'unset' | 'ready';

/** Where the non-extractable key copy lives on this device. */
export interface KeyCache {
  get(): Promise<{ key: CryptoKey; salt: string } | null>;
  set(v: { key: CryptoKey; salt: string }): Promise<void>;
  clear(): Promise<void>;
}

export interface Vault {
  status(): VaultStatus;
  /** Reads the header and the device cache; call once after sign-in. */
  init(): Promise<VaultStatus>;
  /** Forget the key on this device (sign-out, reset). */
  lock(): Promise<void>;
  /** Current key + salt for sealing/unsealing. Throws while locked. */
  material(): { key: CryptoKey; salt: string };
  /** Non-throwing variant for readers that tolerate legacy data. */
  materialOrNull(): { key: CryptoKey; salt: string } | null;
  subscribe(fn: () => void): () => void;
}

export interface AutoVaultPorts {
  fetchKey(): Promise<{ key: string; salt: string }>;
  cache: KeyCache;
}

export function createAutoVault(ports: AutoVaultPorts): Vault {
  let status: VaultStatus = 'unknown';
  let mat: { key: CryptoKey; salt: string } | null = null;
  const subs = new Set<() => void>();
  const set = (s: VaultStatus) => {
    const changed = s !== status;
    status = s;
    if (changed) subs.forEach((f) => f());
  };

  return {
    status: () => status,
    async init() {
      if (!mat) {
        const cached = await ports.cache.get().catch(() => null);
        if (cached) {
          mat = cached;
          set('ready');
        }
      }
      try {
        const { key, salt } = await ports.fetchKey();
        const live = await importRawKey(key, true);
        mat = { key: live, salt };
        // Cache a copy nobody can export; the extractable one stays in memory only.
        await ports.cache.set({ key: await importRawKey(key, false), salt }).catch(() => undefined);
        set('ready');
        subs.forEach((f) => f()); // key material changed: listeners re-read
      } catch {
        if (!mat) set('unset');
      }
      return status;
    },
    async lock() {
      mat = null;
      await ports.cache.clear().catch(() => undefined);
      set('unknown');
    },
    material() {
      if (!mat) throw new Error('vault-locked');
      return mat;
    },
    materialOrNull: () => mat,
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

/** IndexedDB cache for the non-extractable key. Falls back to memory when IDB is unavailable. */
export function idbKeyCache(dbName = 'spotter.vault', uid = 'me'): KeyCache {
  let memory: { key: CryptoKey; salt: string } | null = null;
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
    async get() {
      try {
        return ((await run('readonly', (s) => s.get(uid))) as typeof memory) ?? null;
      } catch {
        return memory;
      }
    },
    async set(v) {
      memory = v;
      try {
        await run('readwrite', (s) => s.put(v, uid));
      } catch {
        /* memory fallback */
      }
    },
    async clear() {
      memory = null;
      try {
        await run('readwrite', (s) => s.delete(uid));
      } catch {
        /* nothing to clear */
      }
    },
  };
}
