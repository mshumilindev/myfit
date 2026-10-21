import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryFs } from './memoryFs';
import {
  createDeviceSigner,
  idbSignerStorage,
  memorySignerStorage,
  type SignerRecord,
} from './signerStore';
import type { SigningKey } from '../../chat/chatSignature';

const key = (kid: string): SigningKey =>
  ({
    kid,
    privateKey: { tag: `priv-${kid}` } as unknown as CryptoKey,
    publicRaw: `pub-${kid}`,
  }) as SigningKey;
const rec = (kid = 'k1', published = false): SignerRecord => ({
  kid,
  privateKey: { tag: `priv-${kid}` } as unknown as CryptoKey,
  publicRaw: `pub-${kid}`,
  published,
});

/** A minimal IndexedDB: one database, one object store 'k'; enough for the adapter's open/get/put/delete. */
function fakeIdb(opts: { failOpen?: boolean; failRequest?: boolean } = {}) {
  const data = new Map<string, unknown>();
  const open = vi.fn(() => {
    const req: Record<string, unknown> & { result?: unknown } = {};
    const db = {
      createObjectStore: vi.fn(),
      transaction: () => ({
        objectStore: () => ({
          get: (k: string) => mkReq(() => data.get(k)),
          put: (v: unknown, k: string) => mkReq(() => void data.set(k, v)),
          delete: (k: string) => mkReq(() => void data.delete(k)),
        }),
      }),
    };
    const mkReq = (f: () => unknown) => {
      const r: Record<string, unknown> = {};
      queueMicrotask(() => {
        if (opts.failRequest) {
          r.error = new Error('req-fail');
          (r.onerror as () => void)?.();
        } else {
          r.result = f();
          (r.onsuccess as () => void)?.();
        }
      });
      return r;
    };
    queueMicrotask(() => {
      if (opts.failOpen) {
        req.error = new Error('open-fail');
        (req.onerror as () => void)();
        return;
      }
      req.result = db;
      (req.onupgradeneeded as () => void)();
      (req.onsuccess as () => void)();
    });
    return req;
  });
  return { open, data };
}

afterEach(() => vi.unstubAllGlobals());

describe('memorySignerStorage', () => {
  it('stores per uid and forgets on delete', async () => {
    const s = memorySignerStorage();
    expect(await s.get('u1')).toBeNull();
    await s.put('u1', rec('a'));
    await s.put('u2', rec('b'));
    expect((await s.get('u1'))?.kid).toBe('a');
    await s.del('u1');
    expect(await s.get('u1')).toBeNull();
    expect((await s.get('u2'))?.kid).toBe('b');
  });
});

describe('idbSignerStorage', () => {
  it('round-trips a record through IndexedDB under the uid and creates the object store', async () => {
    const idb = fakeIdb();
    vi.stubGlobal('indexedDB', idb);
    const s = idbSignerStorage('t-db');
    expect(await s.get('u1')).toBeNull();
    await s.put('u1', rec('a'));
    expect(idb.open).toHaveBeenCalledWith('t-db', 1);
    expect(idb.data.get('u1')).toMatchObject({ kid: 'a', published: false });
    expect((await s.get('u1'))?.kid).toBe('a');
    await s.del('u1');
    expect(idb.data.has('u1')).toBe(false);
    expect(await s.get('u1')).toBeNull();
  });

  it('keeps working from memory when IndexedDB cannot be opened (private window)', async () => {
    vi.stubGlobal('indexedDB', fakeIdb({ failOpen: true }));
    const s = idbSignerStorage();
    expect(await s.get('u1')).toBeNull();
    await s.put('u1', rec('a'));
    expect((await s.get('u1'))?.kid).toBe('a');
    await s.del('u1');
    expect(await s.get('u1')).toBeNull();
  });

  it('falls back to memory when a request fails', async () => {
    vi.stubGlobal('indexedDB', fakeIdb({ failRequest: true }));
    const s = idbSignerStorage();
    await s.put('u1', rec('a'));
    expect((await s.get('u1'))?.kid).toBe('a');
  });
});

describe('createDeviceSigner', () => {
  it('generates a key once, publishes only the public half, then returns kid + private key', async () => {
    const fs = createMemoryFs();
    fs.onCall('coachPublishSignKey', () => ({ ok: true }));
    const storage = memorySignerStorage();
    const generate = vi.fn(async () => key('k1'));
    const sign = createDeviceSigner({ fs, uid: 'u1', storage, generate });
    const out = await sign();
    expect(out?.kid).toBe('k1');
    expect(fs.calls).toEqual([
      { name: 'coachPublishSignKey', data: { kid: 'k1', publicRaw: 'pub-k1' } },
    ]);
    expect(JSON.stringify(fs.calls)).not.toContain('priv-');
    expect((await storage.get('u1'))?.published).toBe(true);
    // second use: no new key, no new publish
    expect((await sign())?.kid).toBe('k1');
    expect(generate).toHaveBeenCalledTimes(1);
    expect(fs.calls).toHaveLength(1);
  });

  it('offline at first use: null (the send fails closed), key kept, publish retried next time', async () => {
    const fs = createMemoryFs();
    let online = false;
    fs.onCall('coachPublishSignKey', () => {
      if (!online) throw new Error('offline');
      return {};
    });
    const storage = memorySignerStorage();
    const generate = vi.fn(async () => key('k1'));
    const sign = createDeviceSigner({ fs, uid: 'u1', storage, generate });
    expect(await sign()).toBeNull();
    expect((await storage.get('u1'))?.published).toBe(false);
    online = true;
    expect((await sign())?.kid).toBe('k1');
    expect(generate).toHaveBeenCalledTimes(1); // the same key, not a second identity
  });

  it('concurrent callers share one load; an existing published record is used as is', async () => {
    const fs = createMemoryFs();
    const storage = memorySignerStorage();
    await storage.put('u1', rec('old', true));
    const generate = vi.fn(async () => key('new'));
    const sign = createDeviceSigner({ fs, uid: 'u1', storage, generate });
    const [a, b] = await Promise.all([sign(), sign()]);
    expect(a?.kid).toBe('old');
    expect(b?.kid).toBe('old');
    expect(generate).not.toHaveBeenCalled();
    expect(fs.calls).toHaveLength(0);
  });

  it('keys are per user: another uid gets its own key', async () => {
    const fs = createMemoryFs();
    fs.onCall('coachPublishSignKey', () => ({}));
    const storage = memorySignerStorage();
    let n = 0;
    const generate = async () => key(`k${++n}`);
    const a = await createDeviceSigner({ fs, uid: 'a', storage, generate })();
    const b = await createDeviceSigner({ fs, uid: 'b', storage, generate })();
    expect([a?.kid, b?.kid]).toEqual(['k1', 'k2']);
  });
});
