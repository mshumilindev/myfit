import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  IDLE_WIPE_MS,
  configureSealedLocal,
  createSealedLocal,
  getSealedLocal,
  idbBackend,
  isLocalConfigured,
  memoryBackend,
  wipeOnLock,
  type KvBackend,
} from './sealedLocal';
import { readyVault, unsetVault } from '../testVault';

afterEach(() => {
  configureSealedLocal(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Minimal IndexedDB double: one database, one store, requests resolve on a microtask. */
function fakeIndexedDB(opts: { failOpen?: boolean; failOps?: boolean } = {}) {
  const store = new Map<string, unknown>();
  const req = <T>(f: () => T) => {
    const r: {
      result?: T;
      error?: unknown;
      onsuccess?: () => void;
      onerror?: () => void;
    } = {};
    queueMicrotask(() => {
      if (opts.failOps) {
        r.error = new Error('op-failed');
        r.onerror?.();
      } else {
        r.result = f();
        r.onsuccess?.();
      }
    });
    return r;
  };
  const objectStore = {
    get: (k: string) => req(() => store.get(k)),
    put: (v: unknown, k: string) => req(() => void store.set(k, v)),
    delete: (k: string) => req(() => void store.delete(k)),
    getAllKeys: () => req(() => [...store.keys()]),
    clear: () => req(() => void store.clear()),
  };
  const db = { transaction: () => ({ objectStore: () => objectStore }) };
  return {
    store,
    indexedDB: {
      open: () => {
        const r: {
          result: unknown;
          error?: unknown;
          onupgradeneeded?: () => void;
          onsuccess?: () => void;
          onerror?: () => void;
        } = { result: { ...db, createObjectStore: () => undefined } };
        queueMicrotask(() => {
          if (opts.failOpen) {
            r.error = new Error('open-failed');
            r.onerror?.();
            return;
          }
          r.onupgradeneeded?.();
          r.result = db;
          r.onsuccess?.();
        });
        return r;
      },
    },
  };
}

describe('createSealedLocal: sealing', () => {
  it('stores only an envelope (never the plaintext) and round-trips the value', async () => {
    const be = memoryBackend();
    const loc = createSealedLocal({ vault: await readyVault(), backend: be, now: () => 1000 });
    const value = { text: 'my-private-message', n: [1, 2, 3] };
    expect(await loc.set('chat:c1:outbox', value)).toBe(true);

    const row = await be.get('chat:c1:outbox');
    expect(row?.t).toBe(1000);
    expect(JSON.stringify(row)).not.toContain('my-private-message');
    expect(await loc.get('chat:c1:outbox')).toEqual(value);
  });

  it('a locked vault stores nothing and reads nothing (no plaintext fallback)', async () => {
    const be = memoryBackend();
    const ready = createSealedLocal({ vault: await readyVault(), backend: be });
    await ready.set('k', 'secret');

    const locked = createSealedLocal({ vault: await unsetVault(), backend: be });
    expect(locked.ready()).toBe(false);
    expect(await locked.set('k2', 'x')).toBe(false);
    expect(await be.keys()).toEqual(['k']);
    expect(await locked.get('k')).toBeNull();
    expect(ready.ready()).toBe(true);
  });

  it('get returns null for missing keys and for rows that are not envelopes', async () => {
    const be = memoryBackend();
    const loc = createSealedLocal({ vault: await readyVault(), backend: be });
    expect(await loc.get('nope')).toBeNull();
    await be.put('bad', { t: 1, env: { junk: true } as never });
    expect(await loc.get('bad')).toBeNull();
    expect(await be.get('bad')).not.toBeNull(); // untouched, not deleted
  });

  it('an entry sealed under another account key is dropped on read', async () => {
    const be = memoryBackend();
    const other = createSealedLocal({ vault: await readyVault(), backend: be });
    await other.set('shared-key', 'theirs');
    const mine = createSealedLocal({ vault: await readyVault(), backend: be });
    expect(await mine.get('shared-key')).toBeNull();
    expect(await be.get('shared-key')).toBeNull();
  });

  it('reading refreshes the last-use time but never reverts a newer write that landed meanwhile', async () => {
    let t = 100;
    const be = memoryBackend();
    const loc = createSealedLocal({ vault: await readyVault(), backend: be, now: () => t });
    await loc.set('k', 'v1');
    t = 500;
    expect(await loc.get('k')).toBe('v1');
    expect((await be.get('k'))?.t).toBe(500);

    // a write lands between our first read and the touch
    const realGet = be.get.bind(be);
    let calls = 0;
    be.get = async (k) => {
      const r = await realGet(k);
      if (++calls === 1) {
        t = 700;
        await loc.set(k, 'v2'); // concurrent writer
        t = 950;
      }
      return r;
    };
    t = 900;
    expect(await loc.get('k')).toBe('v1');
    be.get = realGet;
    expect((await be.get('k'))?.t).toBe(700); // the stale read did not touch the newer entry
    expect(await loc.get('k')).toBe('v2'); // newer envelope survived
  });

  it('set resolves false when the backend write throws; remove/keys/wipe tolerate backend failures', async () => {
    const boom = async () => {
      throw new Error('disk');
    };
    const bad: KvBackend = {
      get: boom,
      put: boom,
      del: boom,
      keys: boom,
      clear: boom,
    };
    const loc = createSealedLocal({ vault: await readyVault(), backend: bad });
    expect(await loc.set('k', 1)).toBe(false);
    await expect(loc.remove('k')).resolves.toBeUndefined();
    expect(await loc.keys()).toEqual([]);
    expect(await loc.sweep()).toBe(0);
    await expect(loc.wipeCid('c')).resolves.toBeUndefined();
    await expect(loc.wipe()).resolves.toBeUndefined();
  });

  it('get tolerates a failing re-read/touch after decrypting', async () => {
    const be = memoryBackend();
    const loc = createSealedLocal({ vault: await readyVault(), backend: be });
    await loc.set('k', 'v');
    const realGet = be.get.bind(be);
    let n = 0;
    be.get = async (k) => {
      if (++n === 2) throw new Error('flaky');
      return realGet(k);
    };
    expect(await loc.get('k')).toBe('v');
  });

  it('get tolerates a failing put during the touch, and a failing delete of an undecryptable row', async () => {
    const be = memoryBackend();
    const loc = createSealedLocal({ vault: await readyVault(), backend: be });
    await loc.set('k', 'v');
    be.put = async () => {
      throw new Error('quota');
    };
    expect(await loc.get('k')).toBe('v');

    const other = createSealedLocal({ vault: await readyVault(), backend: be });
    be.del = async () => {
      throw new Error('ro');
    };
    expect(await other.get('k')).toBeNull();
  });
});

describe('keys / remove / wipeCid / wipe / sweep', () => {
  const setup = async () => {
    let t = 0;
    const be = memoryBackend();
    const loc = createSealedLocal({
      vault: await readyVault(),
      backend: be,
      now: () => t,
    });
    return { be, loc, setT: (n: number) => (t = n) };
  };

  it('keys filters by prefix', async () => {
    const { loc } = await setup();
    await loc.set('outbox:c1:a', 1);
    await loc.set('outbox:c2:b', 1);
    await loc.set('draft:c1', 1);
    expect((await loc.keys('outbox:')).sort()).toEqual(['outbox:c1:a', 'outbox:c2:b']);
    expect((await loc.keys()).length).toBe(3);
  });

  it('remove deletes one entry', async () => {
    const { loc } = await setup();
    await loc.set('a', 1);
    await loc.remove('a');
    expect(await loc.get('a')).toBeNull();
  });

  it('wipeCid removes only entries whose colon-separated key contains that exact cid', async () => {
    const { loc } = await setup();
    await loc.set('outbox:c1:m1', 1);
    await loc.set('draft:c1', 1);
    await loc.set('draft:c10', 1);
    await loc.set('outbox:c2:m1', 1);
    await loc.wipeCid('c1');
    expect((await loc.keys()).sort()).toEqual(['draft:c10', 'outbox:c2:m1']);
  });

  it('wipe clears everything', async () => {
    const { loc } = await setup();
    await loc.set('a', 1);
    await loc.set('b', 1);
    await loc.wipe();
    expect(await loc.keys()).toEqual([]);
  });

  it('sweep drops entries idle for more than the limit (strictly older), keeps the rest, and removes rows that vanished', async () => {
    const { be, loc, setT } = await setup();
    setT(1000);
    await loc.set('old', 1);
    setT(1000 + 10);
    await loc.set('edge', 1);
    setT(1000 + 20);
    await loc.set('fresh', 1);
    setT(1000 + IDLE_WIPE_MS + 10);
    // cutoff = 1010: old (1000) goes, edge (1010) stays (not < cutoff), fresh stays
    expect(await loc.sweep()).toBe(1);
    expect((await loc.keys()).sort()).toEqual(['edge', 'fresh']);

    const realGet = be.get.bind(be);
    be.get = async (k) => (k === 'fresh' ? null : realGet(k));
    expect(await loc.sweep()).toBe(1);
  });

  it('honours a custom idle window', async () => {
    let t = 0;
    const be = memoryBackend();
    const loc = createSealedLocal({
      vault: await readyVault(),
      backend: be,
      now: () => t,
      idleMs: 50,
    });
    await loc.set('a', 1);
    t = 51;
    expect(await loc.sweep()).toBe(1);
  });
});

describe('wipeOnLock', () => {
  it('wipes when the vault goes from ready to locked, not on other transitions', async () => {
    const v = await readyVault();
    const wipe = vi.fn(async () => undefined);
    const local = { wipe } as never;
    const off = wipeOnLock(v, local);
    v.subscribe(() => undefined);
    await v.lock();
    expect(wipe).toHaveBeenCalledTimes(1);
    await v.lock(); // already locked: no change event
    expect(wipe).toHaveBeenCalledTimes(1);
    off();
  });

  it('never wipes when the vault was not ready to begin with', async () => {
    const v = await unsetVault();
    const wipe = vi.fn(async () => undefined);
    wipeOnLock(v, { wipe } as never);
    await v.init(); // unset -> unset
    await v.lock(); // unset -> unknown, but was not ready
    expect(wipe).not.toHaveBeenCalled();
  });
});

describe('idbBackend', () => {
  const row = (t: number) => ({ t, env: { iv: 'i', ct: 'c' } as never });

  it('falls back to memory when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const be = idbBackend('db-none');
    await be.put('a', row(1));
    expect(await be.get('a')).toEqual(row(1));
    expect(await be.keys()).toEqual(['a']);
    await be.del('a');
    expect(await be.get('a')).toBeNull();
    await be.put('b', row(2));
    await be.clear();
    expect(await be.keys()).toEqual([]);
  });

  it('persists through IndexedDB when available', async () => {
    const fake = fakeIndexedDB();
    vi.stubGlobal('indexedDB', fake.indexedDB);
    const be = idbBackend('db-ok');
    await be.put('a', row(1));
    await be.put('b', row(2));
    expect(fake.store.has('a')).toBe(true);
    expect(await be.get('a')).toEqual(row(1));
    expect(await be.get('missing')).toBeNull();
    expect((await be.keys()).sort()).toEqual(['a', 'b']);
    await be.del('a');
    expect(fake.store.has('a')).toBe(false);
    await be.clear();
    expect(fake.store.size).toBe(0);
  });

  it('survives open and operation failures by using the in-memory fallback', async () => {
    vi.stubGlobal('indexedDB', fakeIndexedDB({ failOpen: true }).indexedDB);
    const a = idbBackend('db-fail-open');
    await a.put('x', row(1));
    expect(await a.get('x')).toEqual(row(1));

    vi.stubGlobal('indexedDB', fakeIndexedDB({ failOps: true }).indexedDB);
    const b = idbBackend('db-fail-ops');
    await b.put('y', row(2));
    expect(await b.get('y')).toEqual(row(2));
    expect(await b.keys()).toEqual(['y']);
    await b.del('y');
    expect(await b.get('y')).toBeNull();
    await b.clear();
  });

  it('a sealed value written through IndexedDB holds no plaintext', async () => {
    const fake = fakeIndexedDB();
    vi.stubGlobal('indexedDB', fake.indexedDB);
    const loc = createSealedLocal({ vault: await readyVault(), backend: idbBackend('db-seal') });
    await loc.set('draft:c1', 'dear-trainer-secret');
    expect(JSON.stringify([...fake.store.values()])).not.toContain('dear-trainer-secret');
    expect(await loc.get('draft:c1')).toBe('dear-trainer-secret');
  });
});

describe('app-wide instance', () => {
  it('configureSealedLocal swaps the instance and null resets it', async () => {
    expect(isLocalConfigured()).toBe(false);
    const loc = createSealedLocal({ vault: await readyVault(), backend: memoryBackend() });
    configureSealedLocal(loc);
    expect(isLocalConfigured()).toBe(true);
    expect(await getSealedLocal()).toBe(loc);
    configureSealedLocal(null);
    expect(isLocalConfigured()).toBe(false);
  });

  it('getSealedLocal builds one lazily over the shared vault, sweeps, wipes on lock, and reuses it', async () => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', undefined);
    const v = await readyVault();
    vi.doMock('../vaultIO', () => ({ vault: v }));
    const mod = await import('./sealedLocal');
    const a = await mod.getSealedLocal();
    expect(await mod.getSealedLocal()).toBe(a);
    expect(mod.isLocalConfigured()).toBe(true);
    await a.set('k', 'v');
    expect(await a.get('k')).toBe('v');
    await v.lock();
    await vi.waitFor(async () => expect(await a.keys()).toEqual([]));
    vi.doUnmock('../vaultIO');
  });
});
