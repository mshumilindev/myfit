/**
 * The account's vault: owns the data key on this device.
 *
 * Ports keep it testable and free of Firebase/IndexedDB imports:
 *  - `remote` holds the vault header (salt + a small check envelope) at a fixed place
 *    in Firestore (users/{uid}/meta/vault). The header reveals nothing without the RK.
 *  - `cache` keeps the non-extractable CryptoKey on this device so the app opens
 *    without asking for the recovery key every time.
 */
import {
  decryptJson,
  deriveVaultKey,
  encryptJson,
  formatRecoveryKey,
  generateRecoveryKey,
  isEnvelope,
  newSalt,
  parseRecoveryKey,
  type VaultEnvelope,
} from './vaultCrypto';

export interface VaultHeader {
  salt: string;
  /** Encrypts a known string: proves a typed recovery key is the right one. */
  check: VaultEnvelope;
}

export interface VaultPorts {
  remote: {
    load(): Promise<VaultHeader | null>;
    save(h: VaultHeader): Promise<void>;
  };
  cache: {
    get(): Promise<{ key: CryptoKey; salt: string } | null>;
    set(v: { key: CryptoKey; salt: string }): Promise<void>;
    clear(): Promise<void>;
  };
}

export type VaultStatus = 'unknown' | 'unset' | 'locked' | 'ready';

const CHECK = 'spotter-vault-ok';

export interface Vault {
  status(): VaultStatus;
  /** Reads the header and the device cache; call once after sign-in. */
  init(): Promise<VaultStatus>;
  /** First-time setup. Returns the recovery key for the user to store (shown once). */
  create(): Promise<string>;
  /** Unlock on a new device. False when the key is malformed or wrong. */
  unlock(recoveryKey: string): Promise<boolean>;
  /** Forget the key on this device (sign-out, reset). */
  lock(): Promise<void>;
  /** Current key + salt for sealing/unsealing. Throws while locked. */
  material(): { key: CryptoKey; salt: string };
  /** Non-throwing variant for readers that tolerate legacy data. */
  materialOrNull(): { key: CryptoKey; salt: string } | null;
  subscribe(fn: () => void): () => void;
}

export function createVault(ports: VaultPorts): Vault {
  let status: VaultStatus = 'unknown';
  let mat: { key: CryptoKey; salt: string } | null = null;
  const subs = new Set<() => void>();
  const set = (s: VaultStatus) => {
    status = s;
    subs.forEach((f) => f());
  };

  return {
    status: () => status,
    async init() {
      const header = await ports.remote.load();
      if (!header) {
        mat = null;
        set('unset');
        return status;
      }
      const cached = await ports.cache.get();
      if (cached && cached.salt === header.salt) {
        try {
          await decryptJson(cached.key, header.check);
          mat = cached;
          set('ready');
          return status;
        } catch {
          await ports.cache.clear(); // stale key from a previous vault
        }
      }
      mat = null;
      set('locked');
      return status;
    },
    async create() {
      const rk = generateRecoveryKey();
      const salt = newSalt();
      const key = await deriveVaultKey(rk, salt);
      await ports.remote.save({ salt, check: await encryptJson(key, salt, CHECK) });
      await ports.cache.set({ key, salt });
      mat = { key, salt };
      set('ready');
      return formatRecoveryKey(rk);
    },
    async unlock(input) {
      const rk = parseRecoveryKey(input);
      const header = await ports.remote.load();
      if (!rk || !header || !isEnvelope(header.check)) return false;
      const key = await deriveVaultKey(rk, header.salt);
      try {
        if ((await decryptJson<string>(key, header.check)) !== CHECK) return false;
      } catch {
        return false;
      }
      mat = { key, salt: header.salt };
      await ports.cache.set(mat);
      set('ready');
      return true;
    },
    async lock() {
      mat = null;
      await ports.cache.clear();
      set('locked');
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
export function idbKeyCache(dbName = 'spotter.vault', uid = 'me'): VaultPorts['cache'] {
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
