/**
 * Sealed on-device storage for chat (plan Part C.2 no. 9): the offline outbox, the decrypted message cache and the
 * composer drafts. Every value is sealed with the user's vault DEK before it touches IndexedDB; nothing is ever
 * written in the clear, so a locked vault means "not stored" (memory only), never a plaintext fallback.
 *
 *  - wiped on sign-out / vault lock, on relationship end (`wipeCid`) and after 30 days idle (`sweep`);
 *  - the only plaintext is the key name (an opaque cid and a purpose) and the last-use time needed for the sweep;
 *  - no console output, no localStorage, no service-worker cache.
 */
import type { Vault } from '../../autoVault';
import { decryptJson, encryptJson, isEnvelope, type VaultEnvelope } from '../../vaultCrypto';

export const IDLE_WIPE_MS = 30 * 24 * 60 * 60 * 1000;

interface Row {
  /** last time this entry was read or written (ms) */
  t: number;
  env: VaultEnvelope;
}

/** Dumb string-keyed storage. */
export interface KvBackend {
  get(k: string): Promise<Row | null>;
  put(k: string, v: Row): Promise<void>;
  del(k: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}

export function memoryBackend(): KvBackend {
  const m = new Map<string, Row>();
  return {
    get: async (k) => m.get(k) ?? null,
    put: async (k, v) => void m.set(k, v),
    del: async (k) => void m.delete(k),
    keys: async () => [...m.keys()],
    clear: async () => m.clear(),
  };
}

/** IndexedDB backend (own database, one object store). Falls back to memory when IndexedDB is not available. */
export function idbBackend(dbName = 'spotter.coach.chat'): KvBackend {
  const fallback = memoryBackend();
  let dbp: Promise<IDBDatabase> | null = null;
  const open = (): Promise<IDBDatabase> =>
    (dbp ??= new Promise<IDBDatabase>((res, rej) => {
      if (typeof indexedDB === 'undefined') return rej(new Error('no-idb'));
      const r = indexedDB.open(dbName, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
  const run = async <T>(
    mode: IDBTransactionMode,
    f: (s: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> => {
    const db = await open();
    return new Promise<T>((res, rej) => {
      const req = f(db.transaction('kv', mode).objectStore('kv'));
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  };
  return {
    async get(k) {
      try {
        return ((await run('readonly', (s) => s.get(k))) as Row | undefined) ?? null;
      } catch {
        return fallback.get(k);
      }
    },
    async put(k, v) {
      try {
        await run('readwrite', (s) => s.put(v, k));
      } catch {
        await fallback.put(k, v);
      }
    },
    async del(k) {
      await fallback.del(k);
      try {
        await run('readwrite', (s) => s.delete(k));
      } catch {
        /* nothing stored */
      }
    },
    async keys() {
      try {
        return (await run('readonly', (s) => s.getAllKeys())).map(String);
      } catch {
        return fallback.keys();
      }
    },
    async clear() {
      await fallback.clear();
      try {
        await run('readwrite', (s) => s.clear());
      } catch {
        /* nothing stored */
      }
    },
  };
}

export interface SealedLocal {
  /** True while the vault holds a key (reads and writes work). */
  ready(): boolean;
  /** Called when `ready()` may have changed. */
  subscribe(f: () => void): () => void;
  get<T>(key: string): Promise<T | null>;
  /** Resolves false (and stores nothing) while the vault is locked or the write fails. */
  set(key: string, value: unknown): Promise<boolean>;
  remove(key: string): Promise<void>;
  /** Keys starting with `prefix`. */
  keys(prefix?: string): Promise<string[]>;
  /** Drop every entry untouched for 30 days. Returns how many were dropped. */
  sweep(): Promise<number>;
  /** Drop every entry of one conversation (relationship end). */
  wipeCid(cid: string): Promise<void>;
  /** Drop everything (sign-out). */
  wipe(): Promise<void>;
}

export function createSealedLocal(deps: {
  vault: Pick<Vault, 'materialOrNull' | 'subscribe' | 'status'>;
  backend?: KvBackend;
  now?: () => number;
  idleMs?: number;
}): SealedLocal {
  const be = deps.backend ?? idbBackend();
  const now = deps.now ?? (() => Date.now());
  const idleMs = deps.idleMs ?? IDLE_WIPE_MS;
  const mat = () => deps.vault.materialOrNull();
  return {
    ready: () => mat() !== null,
    subscribe: (f) => deps.vault.subscribe(f),
    async get<T>(key: string) {
      const m = mat();
      if (!m) return null;
      const row = await be.get(key);
      if (!row || !isEnvelope(row.env)) return null;
      try {
        const v = await decryptJson<T>(m.key, row.env);
        await be.put(key, { t: now(), env: row.env }).catch(() => undefined);
        return v;
      } catch {
        // sealed under another key (another account on this device): useless, drop it
        await be.del(key).catch(() => undefined);
        return null;
      }
    },
    async set(key, value) {
      const m = mat();
      if (!m) return false;
      try {
        await be.put(key, { t: now(), env: await encryptJson(m.key, m.salt, value) });
        return true;
      } catch {
        return false;
      }
    },
    remove: (key) => be.del(key).catch(() => undefined),
    async keys(prefix = '') {
      return (await be.keys().catch(() => [])).filter((k) => k.startsWith(prefix));
    },
    async sweep() {
      const cutoff = now() - idleMs;
      let n = 0;
      for (const k of await be.keys().catch(() => [])) {
        const row = await be.get(k).catch(() => null);
        if (!row || row.t < cutoff) {
          await be.del(k).catch(() => undefined);
          n++;
        }
      }
      return n;
    },
    async wipeCid(cid) {
      for (const k of await be.keys().catch(() => [])) {
        if (k.split(':').includes(cid)) await be.del(k).catch(() => undefined);
      }
    },
    wipe: () => be.clear().catch(() => undefined),
  };
}

/** Wipe the sealed store when the vault is locked (sign-out): `ready -> not ready` after having been ready. */
export function wipeOnLock(
  vault: Pick<Vault, 'status' | 'subscribe'>,
  local: SealedLocal,
): () => void {
  let was = vault.status() === 'ready';
  return vault.subscribe(() => {
    const st = vault.status();
    if (was && st === 'unknown') void local.wipe();
    was = st === 'ready';
  });
}

// --- the app-wide instance ----------------------------------------------------------------------------------

let shared: SealedLocal | null = null;

export const isLocalConfigured = (): boolean => shared !== null;

/** Test / story seam. Pass null to reset to the default. */
export function configureSealedLocal(s: SealedLocal | null): void {
  shared = s;
}

/**
 * The app instance, over the real vault + IndexedDB. Created lazily (the vault module pulls in Firebase), so until
 * it resolves the chat runs memory-only. The Firestore adapters call `wipeCid(cid)` when a relationship ends
 * (`install.ts` `defaultWipe`, which also clears the read caches and schedules the Firestore offline cache for removal,
 * see `deviceWipe.ts`); sign-out wipes everything.
 */
export async function getSealedLocal(): Promise<SealedLocal> {
  if (shared) return shared;
  const { vault } = await import('../../vaultIO');
  const s = createSealedLocal({ vault });
  wipeOnLock(vault, s);
  void s.sweep();
  return (shared ??= s);
}
