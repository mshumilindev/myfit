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
import type { Vault, VaultPorts, VaultStatus } from './vault';

export interface AutoVaultPorts {
  fetchKey(): Promise<{ key: string; salt: string }>;
  cache: VaultPorts['cache'];
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
    async create() {
      throw new Error('automatic vault: nothing to create');
    },
    async unlock() {
      return false;
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
