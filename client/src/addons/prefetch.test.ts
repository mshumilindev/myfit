import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addonCacheName, prefetchChunks, pruneAddonCaches, PrefetchError } from './prefetch';

function fakeCaches() {
  const store = new Map<string, Map<string, boolean>>();
  const api = {
    open: vi.fn(async (name: string) => {
      const m = store.get(name) ?? new Map<string, boolean>();
      store.set(name, m);
      return {
        match: async (u: string) => (m.has(u) ? {} : undefined),
        add: async (u: string) => {
          if (u.includes('bad')) throw new Error('net');
          m.set(u, true);
        },
      };
    }),
    keys: async () => [...store.keys()],
    delete: async (n: string) => store.delete(n),
  };
  return { api, store };
}

describe('prefetchChunks', () => {
  let fc: ReturnType<typeof fakeCaches>;
  beforeEach(() => {
    fc = fakeCaches();
    vi.stubGlobal('caches', fc.api);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('with no chunks it reports 100 at once', async () => {
    const p: number[] = [];
    await prefetchChunks('learn', 'b1', [], (x) => p.push(x));
    expect(p).toEqual([100]);
    expect(fc.api.open).not.toHaveBeenCalled();
  });

  it('caches each chunk with progress and is idempotent on retry', async () => {
    const p: number[] = [];
    await prefetchChunks('learn', 'b1', ['/a.js', '/b.js'], (x) => p.push(x));
    expect(p).toEqual([50, 100]);
    expect([...fc.store.get(addonCacheName('learn', 'b1'))!.keys()]).toEqual(['/a.js', '/b.js']);
    const add = vi.spyOn(await fc.api.open(addonCacheName('learn', 'b1')), 'add');
    await prefetchChunks('learn', 'b1', ['/a.js', '/b.js'], () => undefined);
    expect(add).not.toHaveBeenCalled();
  });

  it('fails with fetch when a chunk cannot be loaded, keeping what was cached', async () => {
    await expect(
      prefetchChunks('learn', 'b1', ['/a.js', '/bad.js'], () => undefined),
    ).rejects.toMatchObject({
      reason: 'fetch',
    });
    expect(fc.store.get(addonCacheName('learn', 'b1'))!.has('/a.js')).toBe(true);
  });

  it('fails with quota when the size hint exceeds free space', async () => {
    vi.stubGlobal('navigator', {
      onLine: true,
      storage: { estimate: async () => ({ quota: 100, usage: 90 }) },
    });
    await expect(
      prefetchChunks('learn', 'b1', ['/a.js'], () => undefined, 50),
    ).rejects.toBeInstanceOf(PrefetchError);
  });

  it('fails with offline when the network is off', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    await expect(prefetchChunks('learn', 'b1', ['/a.js'], () => undefined)).rejects.toMatchObject({
      reason: 'offline',
    });
  });

  it('prune removes other builds and removed add-ons, keeps the rest and foreign caches', async () => {
    for (const n of [
      'spotter-addon-learn-b1',
      'spotter-addon-learn-b0',
      'spotter-addon-sleep-b1',
      'spotter-assets',
    ])
      await fc.api.open(n);
    const removed = await pruneAddonCaches('b1', new Set(['learn']));
    expect(removed.sort()).toEqual(['spotter-addon-learn-b0', 'spotter-addon-sleep-b1']);
    expect([...fc.store.keys()].sort()).toEqual(['spotter-addon-learn-b1', 'spotter-assets']);
  });
});
