import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  writes: [] as { path: string; data: Record<string, unknown> }[],
  deletes: [] as string[],
  failReads: false,
  failWrites: false,
  failedWrites: 0,
  keyCalls: 0,
  keyFails: false,
}));

vi.mock('./firebase', () => ({ db: {} }));
vi.mock('./api', () => ({
  callFn: vi.fn(async () => {
    fs.keyCalls++;
    if (fs.keyFails) throw new Error('offline');
    return {
      key: btoa(String.fromCharCode(...new Uint8Array(32).fill(7))),
      salt: btoa(String.fromCharCode(...new Uint8Array(16).fill(3))),
    };
  }),
}));
vi.mock('firebase/firestore', () => {
  const ref = (_db: unknown, ...p: string[]) => ({ path: p.join('/'), id: p[p.length - 1] });
  return {
    doc: ref,
    collection: ref,
    getDoc: vi.fn(async (r: { path: string }) => {
      if (fs.failReads) throw new Error('read-failed');
      const d = fs.docs.get(r.path);
      return { exists: () => d !== undefined, data: () => d };
    }),
    getDocs: vi.fn(async (r: { path: string }) => {
      if (fs.failReads) throw new Error('read-failed');
      const pre = r.path + '/';
      return {
        docs: [...fs.docs.entries()]
          .filter(([p]) => p.startsWith(pre) && !p.slice(pre.length).includes('/'))
          .map(([p, d]) => ({ id: p.slice(pre.length), data: () => d })),
      };
    }),
    setDoc: vi.fn(async (r: { path: string }, data: Record<string, unknown>) => {
      if (fs.failWrites) {
        fs.failedWrites++;
        throw new Error('write-failed');
      }
      fs.docs.set(r.path, data);
      fs.writes.push({ path: r.path, data });
    }),
    deleteDoc: vi.fn(async (r: { path: string }) => {
      fs.docs.delete(r.path);
      fs.deletes.push(r.path);
    }),
  };
});

type Mod = typeof import('./vaultIO');
const load = async (): Promise<Mod> => {
  vi.resetModules();
  return import('./vaultIO');
};

// Every fresh module instance registers global listeners; remove them so instances do not leak into each other.
const added: [EventTarget, string, EventListener][] = [];
beforeEach(() => {
  for (const t of [window, document]) {
    const orig = t.addEventListener.bind(t);
    vi.spyOn(t, 'addEventListener').mockImplementation((type: string, l: unknown, o?: unknown) => {
      added.push([t, type, l as EventListener]);
      orig(type, l as EventListener, o as boolean);
    });
  }
  fs.docs.clear();
  fs.writes.length = 0;
  fs.deletes.length = 0;
  fs.failReads = false;
  fs.failWrites = false;
  fs.failedWrites = 0;
  fs.keyCalls = 0;
  fs.keyFails = false;
  localStorage.clear();
});
afterEach(() => {
  for (const [t, type, l] of added.splice(0)) t.removeEventListener(type, l);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('initVault / prepareWrite with the app-wide vault', () => {
  it('holds writes (never plaintext) until a key arrives, then seals; sign-out locks again', async () => {
    const io = await load();
    const data = { id: 'g1', updatedAt: 5, name: 'Secret Gym' };
    let early: Record<string, unknown> | null = null;
    void io.prepareWrite('gyms', data).then((r) => (early = r));

    await io.initVault('u1');
    await vi.waitFor(() => expect(early).not.toBeNull());
    expect(JSON.stringify(early)).not.toContain('Secret Gym');
    expect(io.vault.status()).toBe('ready');
    expect(fs.keyCalls).toBe(1);
    const sealed = await io.prepareWrite('gyms', data);
    expect(JSON.stringify(sealed)).not.toContain('Secret Gym');
    expect(sealed.id).toBe('g1');

    await io.initVault(null);
    expect(io.vault.status()).toBe('unknown');
    expect(io.vault.materialOrNull()).toBeNull();
  });

  it('a failed key fetch leaves the vault unset: the write stays parked (no plaintext) and is sealed once the key comes', async () => {
    const io = await load();
    fs.keyFails = true;
    await io.initVault('u1');
    expect(io.vault.status()).toBe('unset');
    let out: Record<string, unknown> | null = null;
    void io.prepareWrite('gyms', { id: 'a', name: 'x' }).then((r) => (out = r));
    await new Promise((r) => setTimeout(r, 20));
    expect(out).toBeNull();
    fs.keyFails = false;
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(out).not.toBeNull());
    expect(JSON.stringify(out)).not.toContain('"x"');
  });

  it('a parked write is dropped on sign-out and is never sealed with the next account key', async () => {
    const io = await load();
    fs.keyFails = true;
    await io.initVault('u1');
    let out: Record<string, unknown> | null = null;
    void io.prepareWrite('gyms', { id: 'a', name: 'old-account' }).then((r) => (out = r));
    await io.initVault(null);
    fs.keyFails = false;
    await io.initVault('u2');
    expect(io.vault.status()).toBe('ready');
    await new Promise((r) => setTimeout(r, 20));
    expect(out).toBeNull();
  });

  it('switching account without a sign-out call forgets the previous key first', async () => {
    const io = await load();
    await io.initVault('u1');
    expect(io.vault.status()).toBe('ready');
    fs.keyFails = true;
    await io.initVault('u2');
    expect(io.vault.status()).toBe('unset');
    expect(io.vault.materialOrNull()).toBeNull();
  });

  it('retries the key on `online` and on becoming visible, only while signed in and not ready', async () => {
    const io = await load();
    fs.keyFails = true;
    await io.initVault('u1');
    expect(fs.keyCalls).toBe(1);

    fs.keyFails = false;
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(io.vault.status()).toBe('ready'));
    expect(fs.keyCalls).toBe(2);

    // already ready: no further fetch
    window.dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    expect(fs.keyCalls).toBe(2);
  });

  it('does not retry when signed out', async () => {
    const io = await load();
    await io.initVault(null);
    window.dispatchEvent(new Event('online'));
    await Promise.resolve();
    expect(fs.keyCalls).toBe(0);
    expect(io.vault.status()).toBe('unknown');
  });

  it('visibility retry fires only when the page is visible', async () => {
    const io = await load();
    fs.keyFails = true;
    await io.initVault('u1');
    fs.keyFails = false;
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    expect(fs.keyCalls).toBe(1);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(io.vault.status()).toBe('ready'));
  });
});

describe('auto-migration of plaintext documents', () => {
  const seed = () => {
    fs.docs.set('users/u1/workouts/w1', { id: 'w1', updatedAt: 1, notes: 'PRIVATE-NOTE' });
    fs.docs.set('users/u1/gyms/g1', { id: 'g1', updatedAt: 2, name: 'PRIVATE-GYM' });
    fs.docs.set('users/u1/meta/body', { id: 'body', updatedAt: 3, weight: 81.5 });
  };

  it('seals every plaintext doc in place (never plaintext in the write), enriches workouts, sets the flag once', async () => {
    seed();
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const io = await load();
    io.setMigrationEnricher((d) => ({ ...d, stats: { sets: 4 } }));
    await io.initVault('u1');
    await vi.advanceTimersByTimeAsync(8000);
    await vi.waitFor(() => expect(localStorage.getItem('spotter.vault.migrated.v2.u1')).toBe('1'));

    const paths = fs.writes.map((w) => w.path).sort();
    expect(paths).toEqual(['users/u1/gyms/g1', 'users/u1/meta/body', 'users/u1/workouts/w1']);
    for (const w of fs.writes) {
      const text = JSON.stringify(w.data);
      expect(text).not.toContain('PRIVATE-NOTE');
      expect(text).not.toContain('PRIVATE-GYM');
      expect(text).not.toContain('81.5');
    }
    // The readable stats the enricher added stay open for queries.
    const wk = fs.writes.find((w) => w.path === 'users/u1/workouts/w1')!.data;
    expect(wk.stats).toEqual({ sets: 4 });
    // Written docs round-trip back to the original.
    const back = await io.readDocs<Record<string, unknown>>(
      [fs.docs.get('users/u1/gyms/g1')!],
      io.vault,
    );
    expect(back.items[0].name).toBe('PRIVATE-GYM');

    // second start: flag present => nothing is rewritten
    const before = fs.writes.length;
    await vi.advanceTimersByTimeAsync(8000);
    await io.initVault('u1');
    await vi.advanceTimersByTimeAsync(8000);
    await Promise.resolve();
    expect(fs.writes.length).toBe(before);
  });

  it('a failing collection leaves the flag unset so the next start retries; already sealed docs are not rewritten', async () => {
    seed();
    fs.failReads = true;
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const io = await load();
    await io.initVault('u1');
    await vi.advanceTimersByTimeAsync(8000);
    await Promise.resolve();
    expect(localStorage.getItem('spotter.vault.migrated.v2.u1')).toBeNull();
    expect(fs.writes).toEqual([]);

    fs.failReads = false;
    fs.failWrites = true; // per-doc failure => ok:false, no flag
    await io.initVault('u1');
    await vi.advanceTimersByTimeAsync(8000);
    await vi.waitFor(() => expect(fs.failedWrites).toBeGreaterThan(0));
    await vi.advanceTimersByTimeAsync(0);
    expect(localStorage.getItem('spotter.vault.migrated.v2.u1')).toBeNull();
  });

  it('does nothing when the vault is not ready or localStorage is unavailable still migrates', async () => {
    seed();
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const io = await load();
    fs.keyFails = true;
    await io.initVault('u1');
    await vi.advanceTimersByTimeAsync(8000);
    expect(fs.writes).toEqual([]);

    // storage throws: migrate anyway, flag silently not stored
    fs.keyFails = false;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    await io.initVault('u1');
    await vi.advanceTimersByTimeAsync(8000);
    await vi.waitFor(() => expect(fs.writes.length).toBe(3));
  });
});

describe('migratePorts', () => {
  it('reads/writes meta singletons and per-user subcollections at the right paths', async () => {
    const io = await load();
    await io.initVault('u9');
    fs.docs.set('users/u9/meta/nicotine', { a: 1 });
    fs.docs.set('users/u9/sleeps/s1', { b: 2 });
    const ports = io.migratePorts((d) => ({ ...d, enriched: true }));

    expect(await ports.list('nicotine' as never)).toEqual([{ id: 'nicotine', data: { a: 1 } }]);
    expect(await ports.list('cycle' as never)).toEqual([]);
    expect(await ports.list('sleeps')).toEqual([{ id: 's1', data: { b: 2 } }]);

    await ports.write('supplements' as never, 'ignored', { z: 1 });
    await ports.write('workouts', 'w7', { y: 1 });
    expect(fs.writes.map((w) => w.path)).toEqual([
      'users/u9/meta/supplements',
      'users/u9/workouts/w7',
    ]);

    expect(ports.enrich!('workouts', { q: 1 })).toEqual({ q: 1, enriched: true });
    expect(ports.enrich!('gyms', { q: 1 })).toEqual({ q: 1 });
  });

  it('gives the sealed account documents the integer stamp the rules demand (legacy copies may lack one)', async () => {
    const io = await load();
    await io.initVault('u9');
    const ports = io.migratePorts((d) => d);
    await ports.write('coach' as never, 'coach', { enc: 'x' });
    await ports.write('goals' as never, 'goals', { enc: 'x', updatedAt: 12.7 });
    await ports.write('home' as never, 'home', { enc: 'x', updatedAt: 5 });
    await ports.write('nicotine' as never, 'nicotine', { enc: 'x' });
    const at = (p: string) => fs.writes.find((w) => w.path === p)!.data as Record<string, unknown>;
    expect(Number.isInteger(at('users/u9/meta/coach').updatedAt)).toBe(true);
    expect(at('users/u9/meta/goals').updatedAt).toBe(12);
    expect(at('users/u9/meta/home').updatedAt).toBe(5);
    expect(at('users/u9/meta/nicotine').updatedAt).toBeUndefined();
  });

  it('throws when nobody is signed in', async () => {
    const io = await load();
    const ports = io.migratePorts((d) => d);
    await expect(ports.list('gyms')).rejects.toThrow('not signed in');
    await expect(ports.write('gyms', 'g', {})).rejects.toThrow('not signed in');
  });
});

describe('runKeyExchange', () => {
  it('does nothing without a signed-in user or a ready vault', async () => {
    const io = await load();
    await io.runKeyExchange('c1', true);
    expect(fs.writes).toEqual([]);
    fs.keyFails = true;
    await io.initVault('u1');
    await io.runKeyExchange('c1', true);
    expect(fs.writes).toEqual([]);
  });

  it('a coach publishes its public key once, keeping the private half encrypted; republishing is skipped when unchanged', async () => {
    const io = await load();
    await io.initVault('coach1');
    await io.runKeyExchange(null, true);
    const own = fs.docs.get('users/coach1/meta/coachKey')!;
    const pub = fs.docs.get('coachKeys/coach1')!.pub as JsonWebKey;
    expect(own.pub).toEqual(pub);
    // the private JWK never appears in clear
    expect(JSON.stringify(own.priv)).not.toContain('"d"');
    expect(JSON.stringify(own)).not.toMatch(/"d":/);

    const nWrites = fs.writes.length;
    await io.runKeyExchange(null, true);
    expect(fs.writes.length).toBe(nWrites); // present + same pub: no rewrite
  });

  it('heals a missing public doc and rewrites it when the stored key differs', async () => {
    const io = await load();
    await io.initVault('coach1');
    await io.runKeyExchange(null, true);
    const pub = fs.docs.get('coachKeys/coach1')!.pub as JsonWebKey;
    fs.docs.delete('coachKeys/coach1');
    await io.runKeyExchange(null, true);
    expect((fs.docs.get('coachKeys/coach1')!.pub as JsonWebKey).x).toBe(pub.x);

    fs.docs.set('coachKeys/coach1', { pub: { ...pub, x: 'stale' }, updatedAt: 1 });
    await io.runKeyExchange(null, true);
    expect((fs.docs.get('coachKeys/coach1')!.pub as JsonWebKey).x).toBe(pub.x);
  });

  it('an athlete grants its key to the current coach, drops stale grants, and is idempotent', async () => {
    // coach side published a pub key
    const coachVault = await load();
    await coachVault.initVault('coachA');
    await coachVault.runKeyExchange(null, true);

    const athlete = await load();
    await athlete.initVault('ath');
    fs.docs.set('users/ath/grants/oldCoach', { v: 1 });
    await athlete.runKeyExchange('coachA', false);
    expect(fs.deletes).toContain('users/ath/grants/oldCoach');
    const grant = fs.docs.get('users/ath/grants/coachA')!;
    expect(grant).toBeDefined();
    expect(JSON.stringify(grant)).not.toContain(
      btoa(String.fromCharCode(...new Uint8Array(32).fill(7))),
    );

    const n = fs.writes.length;
    await athlete.runKeyExchange('coachA', false);
    expect(fs.writes.length).toBe(n); // current grant: no rewrite

    // coach opens it
    const key = await athlete.loadOwnCoachKey();
    expect(key).toBeNull(); // athlete has no coach key of its own
  });

  it('waits when the coach has no public key yet, and swallows storage failures', async () => {
    const io = await load();
    await io.initVault('ath');
    await io.runKeyExchange('ghost', false);
    expect(fs.docs.has('users/ath/grants/ghost')).toBe(false);

    fs.failReads = true;
    await expect(io.runKeyExchange('ghost', true)).resolves.toBeUndefined();
  });

  it('re-runs the last exchange when the vault becomes ready', async () => {
    const io = await load();
    fs.keyFails = true;
    await io.initVault('coach2');
    await io.runKeyExchange(null, true); // vault not ready: only remembered
    expect(fs.docs.has('coachKeys/coach2')).toBe(false);

    fs.keyFails = false;
    await io.vault.init();
    await vi.waitFor(() => expect(fs.docs.has('coachKeys/coach2')).toBe(true));
  });

  it('loadOwnCoachKey returns the stored record for the signed-in user', async () => {
    const io = await load();
    expect(await io.loadOwnCoachKey()).toBeNull();
    await io.initVault('coach3');
    await io.runKeyExchange(null, true);
    const rec = await io.loadOwnCoachKey();
    expect(rec?.v).toBe(1);
    expect(rec?.pub).toEqual(fs.docs.get('coachKeys/coach3')!.pub);
  });
});

describe('mirrorCollection ordering', () => {
  it('drops the result of an older snapshot that finishes after a newer one', async () => {
    const io = await load();
    await io.initVault('u1');
    const seen: string[][] = [];
    const m = io.mirrorCollection<{ id: string }>((items) => seen.push(items.map((i) => i.id)));
    m.push([{ id: 'old' }]);
    m.push([{ id: 'new' }]);
    await vi.waitFor(() => expect(seen.length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 20));
    expect(seen).toEqual([['new']]);
    m.dispose();
  });

  it('push before anything is known does not apply; meta is forwarded', async () => {
    const io = await load();
    const seen: unknown[] = [];
    const m = io.mirrorCollection<{ id: string }, string>((_i, info) => seen.push(info.meta));
    m.push([{ id: 'a' }], 'fromCache');
    await vi.waitFor(() => expect(seen).toEqual(['fromCache']));
    m.dispose();
  });
});
