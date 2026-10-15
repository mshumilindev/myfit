import { describe, expect, it, vi } from 'vitest';
import { readyVault, unsetVault } from '../testVault';
import { purgeLegacyPlaintext, wipeCoachCaches, type WipeEnv } from '../deviceWipe';
import { createSealedLocal, memoryBackend } from './sealedLocal';
import {
  OFFLINE_KEY_PREFIX,
  OFFLINE_MAX_AGE_MS,
  OFFLINE_SCHEMA,
  createOfflineCache,
} from './offlineCache';

vi.mock('../api', () => ({ currentUid: () => 'u1' }));

const NAME = 'Olena Koval';
const clients = () => [{ id: 'c1', name: NAME }];

async function setup(o: { uid?: () => string | null; now?: () => number } = {}) {
  const backend = memoryBackend();
  const local = createSealedLocal({ vault: await readyVault(), backend });
  const cache = createOfflineCache({
    local: () => Promise.resolve(local),
    uid: o.uid ?? (() => 'u1'),
    now: o.now,
    waitMs: 20,
  });
  return { backend, local, cache };
}

/** A fresh cache over the same disk: what a restart sees (no memory). */
const restart = (local: Awaited<ReturnType<typeof setup>>['local'], uid = 'u1') =>
  createOfflineCache({ local: () => Promise.resolve(local), uid: () => uid, waitMs: 20 });

describe('offline snapshot: on disk', () => {
  it('is sealed (nothing readable in the store) and comes back whole after a restart', async () => {
    const { backend, local, cache } = await setup();
    await cache.set('trainerClients', clients());
    const keys = await backend.keys();
    expect(keys).toEqual([`${OFFLINE_KEY_PREFIX}u1:trainerClients`]);
    expect(JSON.stringify(await backend.get(keys[0]))).not.toContain(NAME);

    const back = await restart(local).peek<ReturnType<typeof clients>>('trainerClients');
    expect(back?.data).toEqual(clients());
    expect(typeof back?.at).toBe('number');
  });

  it('stores nothing while the vault is locked, and reads empty', async () => {
    const backend = memoryBackend();
    const locked = createSealedLocal({ vault: await unsetVault(), backend });
    const cache = createOfflineCache({
      local: () => Promise.resolve(locked),
      uid: () => 'u1',
      waitMs: 5,
    });
    await cache.set('k', clients());
    expect(await backend.keys()).toEqual([]);
    expect(await restart(locked).peek('k')).toBeNull();
  });

  it('keeps nothing for a signed-out user', async () => {
    const { backend, cache } = await setup({ uid: () => null });
    await cache.set('k', clients());
    expect(await backend.keys()).toEqual([]);
    expect(await cache.peek('k')).toBeNull();
    expect(cache.peekNow('k')).toBeNull();
  });

  it('drops a snapshot of another account, another schema, a wrong shape or one that is too old', async () => {
    const T = 1_000_000_000_000;
    const { backend, local, cache } = await setup({ now: () => T });
    const key = `${OFFLINE_KEY_PREFIX}u1:k`;
    const ok = { v: OFFLINE_SCHEMA, uid: 'u1', savedAt: T, value: clients() };
    for (const bad of [
      { ...ok, uid: 'u2' },
      { ...ok, v: OFFLINE_SCHEMA + 1 },
      { ...ok, savedAt: T - OFFLINE_MAX_AGE_MS - 1 },
      { ...ok, value: { nope: true } },
    ]) {
      await local.set(key, bad);
      expect(await cache.peek('k', { accept: Array.isArray })).toBeNull();
      expect(await backend.keys()).toEqual([]); // dropped, not just ignored
    }
    await local.set(key, ok);
    expect((await cache.peek('k', { accept: Array.isArray }))?.data).toEqual(clients());
  });

  it("does not read another account's entry on the same device", async () => {
    const { local, cache } = await setup();
    await cache.set('k', clients());
    expect(await restart(local, 'u2').peek('k')).toBeNull();
  });

  it('a hung disk read is a miss after a bounded wait, never a hang or a throw', async () => {
    const cache = createOfflineCache({
      local: () => new Promise(() => undefined),
      uid: () => 'u1',
      waitMs: 10,
    });
    expect(await cache.peek('k', { waitMs: 10 })).toBeNull();
    const failing = createOfflineCache({
      local: () => Promise.reject(new Error('no idb')),
      uid: () => 'u1',
      waitMs: 10,
    });
    expect(await failing.peek('k')).toBeNull();
    await expect(failing.set('k', 1)).resolves.toBeUndefined();
  });

  it('wipeEntries drops every sealed entry written here and the memory copies', async () => {
    const { backend, local, cache } = await setup();
    await cache.set('a', clients());
    await cache.set('b', clients());
    await local.set('world:t1', { keep: true });
    await cache.wipeEntries();
    expect(await backend.keys()).toEqual(['world:t1']);
    expect(cache.peekNow('a')).toBeNull();
  });
});

describe('offline snapshot: stale-while-revalidate', () => {
  it('a late-arriving snapshot never overrides live data that arrived first', async () => {
    const { local, cache } = await setup();
    await cache.set('k', ['old']);
    const fresh = restart(local);
    const seen: string[][] = [];
    // the network answer lands (and is stored) while the disk is still being read
    const pending = fresh.hydrate<string[]>('k', (d) => seen.push(d));
    await fresh.set('k', ['live']);
    expect(await pending).toBe(false);
    expect(seen).toEqual([]);
    expect(fresh.peekNow<string[]>('k')?.data).toEqual(['live']);
  });

  it('a snapshot is not applied when the screen already has live data (isLive)', async () => {
    const { local, cache } = await setup();
    await cache.set('k', ['old']);
    const seen: string[][] = [];
    expect(
      await restart(local).hydrate<string[]>('k', (d) => seen.push(d), { isLive: () => true }),
    ).toBe(false);
    expect(seen).toEqual([]);
    expect(await restart(local).hydrate<string[]>('k', (d) => seen.push(d))).toBe(true);
    expect(seen).toEqual([['old']]);
  });

  it('revalidate: snapshot first, then the network answer, which replaces the snapshot', async () => {
    const { local, cache } = await setup();
    await cache.set('k', ['old']);
    const fresh = restart(local);
    const calls: Array<[string[], string]> = [];
    let release: (v: string[]) => void = () => undefined;
    const net = new Promise<string[]>((r) => (release = r));
    const done = new Promise<void>((res) => {
      fresh.revalidate<string[]>({
        key: 'k',
        fetch: () => net,
        apply: (d, src) => {
          calls.push([d, src]);
          if (src === 'network') res();
        },
      });
    });
    await vi.waitFor(() => expect(calls).toEqual([[['old'], 'cache']])); // painted before the network answered
    release(['new']);
    await done;
    expect(calls).toEqual([
      [['old'], 'cache'],
      [['new'], 'network'],
    ]);
    await vi.waitFor(async () =>
      expect((await restart(local).peek<string[]>('k'))?.data).toEqual(['new']),
    );
  });

  it('a snapshot younger than ttlMs skips the network; an older one does not', async () => {
    let t = 1_000_000;
    const { local, cache } = await setup({ now: () => t });
    await cache.set('k', ['old']);
    const net = vi.fn(async () => ['new']);
    const run = (c: ReturnType<typeof restart>) =>
      new Promise<void>((res) => {
        c.revalidate<string[]>({
          key: 'k',
          ttlMs: 1000,
          fetch: net,
          apply: (_d, src) => src === 'network' && res(),
        });
        setTimeout(res, 100);
      });
    const mk = () =>
      createOfflineCache({
        local: () => Promise.resolve(local),
        uid: () => 'u1',
        now: () => t,
        waitMs: 20,
      });
    t += 500;
    await run(mk());
    expect(net).not.toHaveBeenCalled();
    t += 1000;
    await run(mk());
    expect(net).toHaveBeenCalledTimes(1);
  });

  it('a failed refresh keeps the snapshot on screen and reports the error', async () => {
    const { local, cache } = await setup();
    await cache.set('k', ['old']);
    const fresh = restart(local);
    const applied: string[] = [];
    const err = await new Promise<unknown>((res) => {
      fresh.revalidate<string[]>({
        key: 'k',
        fetch: () => Promise.reject(new Error('offline')),
        apply: (_d, src) => applied.push(src),
        onError: res,
      });
    });
    expect((err as Error).message).toBe('offline');
    expect(applied).toEqual(['cache']);
  });

  it('cancel stops all callbacks', async () => {
    const { local, cache } = await setup();
    await cache.set('k', ['old']);
    const apply = vi.fn();
    const cancel = restart(local).revalidate<string[]>({
      key: 'k',
      fetch: async () => ['new'],
      apply,
    });
    cancel();
    await new Promise((r) => setTimeout(r, 50));
    expect(apply).not.toHaveBeenCalled();
  });
});

describe('offline snapshot: identical network reads are de-duplicated', () => {
  it('concurrent loads of one key share one request and one answer', async () => {
    const { cache } = await setup();
    let n = 0;
    const fetch = async () => {
      n++;
      await new Promise((r) => setTimeout(r, 10));
      return clients();
    };
    const [a, b, c] = await Promise.all([
      cache.load('trainerClients', fetch),
      cache.load('trainerClients', fetch),
      cache.dedupe('trainerClients', fetch),
    ]);
    expect(n).toBe(1);
    expect(a).toBe(b);
    expect(c).toBe(a);
    await cache.load('trainerClients', fetch); // not in flight any more: a new request
    expect(n).toBe(2);
  });

  it('force starts a new request (after a change), and keys / accounts do not share', async () => {
    const { cache } = await setup();
    let n = 0;
    const fetch = async () => {
      n++;
      await new Promise((r) => setTimeout(r, 10));
      return n;
    };
    await Promise.all([
      cache.load('a', fetch),
      cache.load('a', fetch, { force: true }),
      cache.load('b', fetch),
    ]);
    expect(n).toBe(3);
  });

  it('a rejected request is shared too, then cleared so the next call retries', async () => {
    const { cache } = await setup();
    let n = 0;
    const fetch = async () => {
      n++;
      throw new Error('x');
    };
    await Promise.allSettled([cache.load('a', fetch), cache.load('a', fetch)]);
    expect(n).toBe(1);
    await Promise.allSettled([cache.load('a', fetch)]);
    expect(n).toBe(2);
  });
});

describe('legacy plaintext cleanup', () => {
  function env(initial: Record<string, string>) {
    const m = new Map(Object.entries(initial));
    const storage: NonNullable<WipeEnv['storage']> = {
      get length() {
        return m.size;
      },
      key: (i) => [...m.keys()][i] ?? null,
      getItem: (k) => m.get(k) ?? null,
      setItem: (k, v) => void m.set(k, v),
      removeItem: (k) => void m.delete(k),
    };
    return { m, env: { storage, idb: null } satisfies WipeEnv };
  }

  it('removes the old readable caches on first run and leaves everything else', () => {
    const s = env({
      'spotter.cache.trainerClients': JSON.stringify({ at: 1, data: [{ name: NAME }] }),
      'spotter.cache.profile.u9': '{}',
      'spotter.programMine': '{"program":{}}',
      'spotter.role': 'member',
      other: 'x',
    });
    purgeLegacyPlaintext(s.env);
    expect([...s.m.keys()].sort()).toEqual(['other', 'spotter.role']);
    purgeLegacyPlaintext(s.env); // idempotent
    expect(s.m.size).toBe(2);
  });

  it('relationship end / sign-out also remove the legacy keys', () => {
    const s = env({ 'spotter.cache.x': '1', 'spotter.programMine': '{}', keep: 'y' });
    wipeCoachCaches(s.env);
    expect([...s.m.keys()]).toEqual(['keep']);
  });

  it('never throws without storage', () => {
    expect(() => purgeLegacyPlaintext({ storage: null, idb: null })).not.toThrow();
  });
});
