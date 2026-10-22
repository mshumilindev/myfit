import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({
  writes: [] as { path: string; data: Record<string, unknown>; opts?: unknown }[],
  deletes: [] as string[],
  listeners: new Map<string, (snap: unknown) => void>(),
  failWith: null as null | { code: string },
  uid: 'u1' as string | null,
}));

vi.mock('./firebase', () => ({ db: {} }));
vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  currentUid: () => fs.uid,
  callFn: vi.fn(async () => {
    throw new Error('offline');
  }),
}));
vi.mock('firebase/firestore', () => {
  const ref = (_db: unknown, ...p: string[]) => ({ path: p.join('/') });
  return {
    doc: ref,
    collection: ref,
    query: (r: unknown) => r,
    where: () => ({}),
    arrayUnion: (...a: unknown[]) => ({ union: a }),
    arrayRemove: (...a: unknown[]) => ({ remove: a }),
    getDoc: vi.fn(async () => ({ exists: () => false })),
    getDocs: vi.fn(async () => ({ docs: [] })),
    deleteDoc: vi.fn(async (r: { path: string }) => {
      if (fs.failWith) throw fs.failWith;
      fs.deletes.push(r.path);
    }),
    setDoc: vi.fn(async (r: { path: string }, data: Record<string, unknown>, opts?: unknown) => {
      if (fs.failWith) throw fs.failWith;
      fs.writes.push({ path: r.path, data, opts });
    }),
    onSnapshot: (r: { path: string }, cb: (s: unknown) => void) => {
      fs.listeners.set(r.path, cb);
      return () => fs.listeners.delete(r.path);
    },
  };
});
vi.mock('./vaultIO', async (orig) => {
  const real = await orig<typeof import('./vaultIO')>();
  const { readyVault } = await import('./testVault');
  const v = await readyVault();
  return {
    ...real,
    vault: v,
    initVault: async () => undefined,
    runKeyExchange: async () => undefined,
    prepareWrite: (c: never, d: never) => real.prepareWrite(c, d, v),
    mirrorCollection: (apply: never) => real.mirrorCollection(apply, v),
  };
});

import {
  isHealthWriteDenied,
  resetHealthGateForTests,
  type HealthWriteDenied,
} from './data/healthConsentGate';
import * as store from './store';
import { vault } from './vaultIO';
import { isSealed, unsealDoc } from './encryptedDoc';
import { CONDITION_CATALOG } from './data/conditionCatalog';

const KEY = CONDITION_CATALOG[0].key;

const T0 = new Date('2026-03-04T10:00:00Z').getTime();
const DAY = 86_400_000;
const stub = vault as unknown as import('./autoVault').Vault;
/** The test grants every health consent (setup), so a write here is never denied; narrows the union. */
function granted<T>(x: T): Exclude<T, HealthWriteDenied> {
  if (isHealthWriteDenied(x)) throw new Error(`health write denied: ${x.feature}`);
  return x as Exclude<T, HealthWriteDenied>;
}

const st = () => store.__getStateForTests();
const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 8));
};
const at = (path: string) => fs.writes.filter((w) => w.path === path);
const open = (w: { data: Record<string, unknown> }) =>
  unsealDoc<Record<string, unknown>>(w.data, stub.material().key);
const snap = (d: Record<string, unknown> | null) => ({
  exists: () => d !== null,
  data: () => d,
  docs: d ? [{ data: () => d }] : [],
  metadata: { fromCache: false, hasPendingWrites: false },
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  localStorage.clear();
  fs.writes.length = 0;
  fs.deletes.length = 0;
  fs.listeners.clear();
  fs.failWith = null;
  fs.uid = 'u1';
  store.resetLocalData();
});
afterEach(async () => {
  vi.useRealTimers();
  await settle(); // let in-flight sealed writes land before the next test starts
  store.resetLocalData();
});

describe('chronic conditions', () => {
  it('add / update / delete write sealed docs and delete the document', async () => {
    const c = granted(store.addCondition({ key: KEY, severity: 2, share: 'off' }));
    await settle();
    let w = at(`users/u1/conditions/${c.id}`).at(-1)!;
    expect(isSealed(w.data)).toBe(true);
    expect(JSON.stringify(w.data)).not.toContain(KEY);
    store.updateCondition(c.id, { severity: 3 });
    store.updateCondition('missing', { severity: 1 });
    await settle();
    w = at(`users/u1/conditions/${c.id}`).at(-1)!;
    expect((await open(w)).severity).toBe(3);
    store.deleteCondition(c.id);
    await settle();
    expect(fs.deletes).toContain(`users/u1/conditions/${c.id}`);
    expect(st().conditions).toEqual([]);
  });

  it('the coach share is published sealed and only when it changed', async () => {
    // A condition makes the coach view differ from the empty one an earlier test left as the last published view.
    granted(store.addCondition({ key: KEY, severity: 2, share: 'inherit' }));
    store.setConditionsShare('full');
    store.setConditionsShare('full'); // unchanged: nothing
    store.setConditionsShare('bogus' as never);
    await settle();
    const prefs = at('users/u1/meta/conditionPrefs');
    expect(prefs).toHaveLength(1);
    expect(isSealed(prefs[0].data)).toBe(true);
    const shares = at('users/u1/meta/coachShare');
    expect(shares.length).toBeGreaterThan(0);
    expect(JSON.stringify(shares[0].data)).not.toContain('"view"');
  });

  it('a failed coach-share write is retried with the next change', async () => {
    store.addCondition({ key: KEY, severity: 3, share: 'full' });
    fs.failWith = { code: 'unavailable' };
    store.setConditionsShare('off');
    await settle();
    fs.failWith = null;
    expect(at('users/u1/meta/coachShare')).toHaveLength(0);
    store.setConditionsShare('effects');
    await settle();
    expect(at('users/u1/meta/coachShare').length).toBe(1);
  });

  it('the server snapshot of conditions and prefs updates state', async () => {
    const stop = store.startSyncLoop();
    fs.listeners.get('users/u1/meta/conditionPrefs')!(
      snap({ conditionsShare: 'full', updatedAt: Date.now() }),
    );
    await settle();
    expect(st().conditionsShare).toBe('full');
    fs.listeners.get('users/u1/meta/conditionPrefs')!(snap({ conditionsShare: 'junk' }));
    await settle();
    expect(st().conditionsShare).toBe('full');
    stop();
  });

  it('without the chronic-conditions consent a write is refused and nothing is stored', async () => {
    resetHealthGateForTests();
    expect(store.addCondition({ key: KEY, severity: 2, share: 'off' })).toEqual({
      ok: false,
      reason: 'consent',
      feature: 'chronic',
    });
    await settle();
    expect(st().conditions).toEqual([]);
    expect(fs.writes.filter((w) => w.path.includes('/conditions/'))).toEqual([]);
  });
});

describe('cycle', () => {
  const settings = {
    mode: 'regular',
    length: 28,
    period: 5,
    anchor: store.dayKey(T0) - 10,
  } as const;

  it('first setup enables the feature, seals the doc and never exposes dates in clear', async () => {
    store.saveCycleSettings(settings);
    expect(store.getCycle().enabled).toBe(true);
    expect(store.getCycle().starts).toEqual([settings.anchor]);
    await settle();
    const w = at('users/u1/meta/cycle').at(-1)!;
    expect(isSealed(w.data)).toBe(true);
    expect(Object.keys(w.data).sort()).toEqual(['enc', 'updatedAt']);
    expect(JSON.stringify(w.data)).not.toContain(String(settings.anchor));
    // never part of the coach share
    for (const s of at('users/u1/meta/coachShare'))
      expect(JSON.stringify(await open(s))).not.toContain('cycle');
  });

  it('update anchor, pending date, surfaces', () => {
    store.updateCycleAnchor(5); // no settings yet: ignored
    expect(store.getCycle().settings).toBeNull();
    store.saveCycleSettings(settings);
    const before = store.getCycle().updatedAt;
    store.updateCycleAnchor(settings.anchor + 20);
    expect(store.getCycle().settings?.anchor).toBe(settings.anchor + 20);
    expect(store.getCycle().starts).toHaveLength(2);
    expect(store.getCycle().updatedAt).toBeGreaterThan(before);
    store.setCyclePendingDate(true);
    store.setCyclePendingDate(true);
    expect(store.getCycle().pendingDate).toBe(true);
    store.setCycleSurface('today', false);
    expect(store.getCycle().surfaces.today).toBe(false);
  });

  it('pregnancy / menopause become private conditions', () => {
    const p = granted(store.markPregnancyFromCycle(T0 - 30 * DAY));
    expect(p.share).toBe('off');
    expect(p.startedAt).toBe(T0 - 30 * DAY);
    const m = granted(store.markMenopauseFromCycle());
    expect(m.share).toBe('off');
    expect(st().conditions.map((c) => c.id)).toEqual([m.id, p.id]);
  });

  it('deleteCycleData wipes state and deletes the Firestore document', async () => {
    store.saveCycleSettings(settings);
    store.deleteCycleData();
    expect(store.getCycle().enabled).toBe(false);
    await settle();
    expect(fs.deletes).toContain('users/u1/meta/cycle');
  });

  it('a newer local edit beats a server snapshot; an older local state takes the server copy', async () => {
    const stop = store.startSyncLoop();
    store.saveCycleSettings(settings);
    await settle();
    const sealed = at('users/u1/meta/cycle').at(-1)!.data;
    // the same doc echoed back: unchanged
    fs.listeners.get('users/u1/meta/cycle')!(snap(sealed));
    await settle();
    expect(store.getCycle().settings?.length).toBe(28);
    // a stale copy cannot overwrite
    const { sealDoc } = await import('./encryptedDoc');
    const stale = await sealDoc(
      'cycle',
      { ...store.getCycle(), settings: { ...settings, length: 40 }, updatedAt: 1 },
      stub.material().key,
      stub.material().salt,
    );
    fs.listeners.get('users/u1/meta/cycle')!(snap(stale));
    await settle();
    expect(store.getCycle().settings?.length).toBe(28);
    const newer = await sealDoc(
      'cycle',
      { ...store.getCycle(), settings: { ...settings, length: 33 }, updatedAt: Date.now() + 5_000 },
      stub.material().key,
      stub.material().salt,
    );
    fs.listeners.get('users/u1/meta/cycle')!(snap(newer));
    await settle();
    expect(store.getCycle().settings?.length).toBe(33);
    stop();
  });
});
