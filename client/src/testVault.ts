/** Test helpers: real automatic vaults backed by in-memory ports (no Firebase, no IndexedDB). */
import { createAutoVault, type KeyCache, type Vault } from './autoVault';
import { b64, decryptJson, isEnvelope } from './vaultCrypto';

export const memCache = (): KeyCache => {
  let c: { key: CryptoKey; salt: string } | null = null;
  return {
    get: async () => c,
    set: async (x) => void (c = x),
    clear: async () => void (c = null),
  };
};

/** A fresh random server key, as `vaultKey` would hand out. */
export const randomServerKey = () => ({
  key: b64(globalThis.crypto.getRandomValues(new Uint8Array(32))),
  salt: b64(globalThis.crypto.getRandomValues(new Uint8Array(16))),
});

/** A vault that already holds its own (random) key. */
export async function readyVault(server = randomServerKey()): Promise<Vault> {
  const v = createAutoVault({ fetchKey: async () => server, cache: memCache() });
  await v.init();
  return v;
}

/** A vault that could not obtain a key (offline first visit): status `unset`, no material. */
export async function unsetVault(): Promise<Vault> {
  const v = createAutoVault({
    fetchKey: async () => {
      throw new Error('offline');
    },
    cache: memCache(),
  });
  await v.init();
  return v;
}

/**
 * The value the store keeps sealed on the device under `<key>.enc` (SPO-216), opened with `v`'s key.
 * `undefined` = nothing sealed there. Tests use it instead of reading the old plaintext `localStorage` key.
 */
export async function openSealedLocal<T>(
  v: Vault,
  key: string,
  storage: Pick<Storage, 'getItem'> = localStorage,
): Promise<T | undefined> {
  const raw = storage.getItem(`${key}.enc`);
  if (!raw) return undefined;
  const env: unknown = JSON.parse(raw);
  if (!isEnvelope(env)) return undefined;
  return (await decryptJson<{ d: T }>(v.material().key, env)).d;
}
