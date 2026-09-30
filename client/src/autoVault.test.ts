// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createAutoVault } from './autoVault';
import { sealDoc, unsealDoc } from './encryptedDoc';
import { b64 } from './vaultCrypto';

const rawKey = b64(new Uint8Array(32).map((_, i) => i + 1));
const mem = () => {
  let c: { key: CryptoKey; salt: string } | null = null;
  return {
    get: async () => c,
    set: async (x: { key: CryptoKey; salt: string }) => void (c = x),
    clear: async () => void (c = null),
  };
};

describe('automatic vault', () => {
  it('becomes ready from the server key with no user action and seals documents', async () => {
    const v = createAutoVault({
      fetchKey: async () => ({ key: rawKey, salt: 'c2FsdA==' }),
      cache: mem(),
    });
    expect(await v.init()).toBe('ready');
    const { key, salt } = v.material();
    const sealed = await sealDoc('gyms', { id: 'g', updatedAt: 1, name: 'Home' }, key, salt);
    expect(JSON.stringify(sealed)).not.toContain('Home');
    expect((await unsealDoc(sealed, key)).name).toBe('Home');
  });

  it('works offline from the cached (non-extractable) key', async () => {
    const cache = mem();
    const online = createAutoVault({
      fetchKey: async () => ({ key: rawKey, salt: 'c2FsdA==' }),
      cache,
    });
    await online.init();
    const offline = createAutoVault({
      fetchKey: async () => {
        throw new Error('offline');
      },
      cache,
    });
    expect(await offline.init()).toBe('ready');
    await expect(crypto.subtle.exportKey('raw', offline.material().key)).rejects.toThrow();
  });

  it('stays unset (plaintext as before) when no key can be obtained at all', async () => {
    const v = createAutoVault({
      fetchKey: async () => {
        throw new Error('not deployed');
      },
      cache: mem(),
    });
    expect(await v.init()).toBe('unset');
    expect(v.materialOrNull()).toBeNull();
  });

  it('the in-memory key is exportable so the owner can grant it to a coach', async () => {
    const v = createAutoVault({
      fetchKey: async () => ({ key: rawKey, salt: 'c2FsdA==' }),
      cache: mem(),
    });
    await v.init();
    expect((await crypto.subtle.exportKey('raw', v.material().key)).byteLength).toBe(32);
  });

  it('lock forgets the key everywhere', async () => {
    const cache = mem();
    const v = createAutoVault({ fetchKey: async () => ({ key: rawKey, salt: 'c2FsdA==' }), cache });
    await v.init();
    await v.lock();
    expect(v.materialOrNull()).toBeNull();
    expect(await cache.get()).toBeNull();
  });

  it('data sealed on one device opens on another (same server key), even via the cached copy', async () => {
    const a = createAutoVault({
      fetchKey: async () => ({ key: rawKey, salt: 'c2FsdA==' }),
      cache: mem(),
    });
    await a.init();
    const { key, salt } = a.material();
    const doc = { id: 'i1', updatedAt: 5, name: 'Knee', note: 'x' };
    const sealed = await sealDoc('injuries', doc, key, salt);
    const cache = mem();
    const b = createAutoVault({
      fetchKey: async () => ({ key: rawKey, salt: 'c2FsdA==' }),
      cache,
    });
    await b.init();
    expect(await unsealDoc(sealed, b.material().key)).toEqual(doc);
    const offline = createAutoVault({
      fetchKey: async () => {
        throw new Error('offline');
      },
      cache,
    });
    await offline.init();
    expect(await unsealDoc(sealed, offline.material().key)).toEqual(doc);
  });
});
