import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => {
  const writes: { path: string; data: Record<string, unknown> }[] = [];
  const listeners = new Map<string, (snap: unknown) => void>();
  return { writes, listeners, docs: new Map<string, Record<string, unknown>>(), failNext: false };
});

vi.mock('./firebase', () => ({ db: {} }));
vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  currentUid: () => 'u1',
}));
vi.mock('firebase/firestore', () => {
  const ref = (_db: unknown, ...p: string[]) => ({ path: p.join('/') });
  return {
    doc: ref,
    collection: ref,
    query: (r: unknown) => r,
    where: () => ({}),
    arrayUnion: (...a: unknown[]) => a,
    arrayRemove: (...a: unknown[]) => a,
    getDoc: vi.fn(async () => ({ exists: () => false })),
    getDocs: vi.fn(async () => ({ docs: [] })),
    deleteDoc: vi.fn(async (r: { path: string }) => void fs.docs.delete(r.path)),
    setDoc: vi.fn(async (r: { path: string }, data: Record<string, unknown>) => {
      if (fs.failNext) {
        fs.failNext = false;
        throw new Error('offline');
      }
      fs.writes.push({ path: r.path, data });
      fs.docs.set(r.path, data);
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
    prepareWrite: (c: never, d: never) => real.prepareWrite(c, d, v),
    mirrorCollection: (apply: never) => real.mirrorCollection(apply, v),
  };
});

import * as store from './store';
import { vault } from './vaultIO';
import { coachView, type CoachView, type GeneralShare } from './conditions';
import type { ChronicCondition } from './types';
import { CONDITION_CATALOG } from './data/conditionCatalog';
import { isSealed, unsealDoc } from './encryptedDoc';

const tick = () => new Promise((r) => setTimeout(r, 30));
const KEY = CONDITION_CATALOG[0].key;
const PATH = 'users/u1/meta/coachShare';
const PREFS = 'users/u1/meta/conditionPrefs';
const stub = vault as unknown as import('./autoVault').Vault;

const shareWrites = () => fs.writes.filter((w) => w.path === PATH);
async function lastView(): Promise<CoachView> {
  const w = shareWrites().at(-1)!;
  expect(isSealed(w.data)).toBe(true);
  const { key } = stub.material();
  const plain = await unsealDoc<{ view: CoachView; updatedAt: number }>(w.data, key);
  return plain.view;
}
/** Echo the written condition docs back through the conditions snapshot, like Firestore does. */
async function echoConditions(): Promise<void> {
  await tick();
  const docs = [...fs.docs].filter(([p]) => p.startsWith('users/u1/conditions/'));
  fs.listeners.get('users/u1/conditions')!({ docs: docs.map(([, d]) => ({ data: () => d })) });
  await tick();
}
const items = () => store.__getStateForTests().conditions as ChronicCondition[];
const general = () => store.__getStateForTests().conditionsShare as GeneralShare;

describe('coachShare publishing', () => {
  let stop: () => void;
  beforeEach(async () => {
    localStorage?.clear?.();
    fs.writes.length = 0;
    fs.docs.clear();
    fs.listeners.clear();
    for (const c of [...items()]) store.deleteCondition(c.id);
    store.setConditionsShare('effects');
    stop = store.startSyncLoop();
    await tick();
    fs.writes.length = 0;
  });
  afterEach(() => stop());

  it('republishes a sealed view equal to coachView on add / update / delete', async () => {
    const a = store.addCondition({
      key: KEY,
      severity: 2,
      share: 'full',
    });
    await echoConditions();
    store.updateCondition(a.id, { severity: 3 });
    await echoConditions();
    const v1 = await lastView();
    expect(v1).toEqual(coachView(items(), general()));
    expect(v1.full[0]).toMatchObject({ key: KEY, severity: 3 });
    expect(JSON.stringify(shareWrites().at(-1)!.data)).not.toContain(KEY);

    // Delete: the mirror reports no documents -> empty view.
    store.deleteCondition(a.id);
    await echoConditions();
    expect(await lastView()).toEqual({ full: [], effects: [] });
  });

  it('Off / Effects / Full general default republish the matching view', async () => {
    store.addCondition({ key: KEY, severity: 2, share: 'inherit' });
    await echoConditions();

    store.setConditionsShare('off');
    await tick();
    expect(await lastView()).toEqual({ full: [], effects: [] });

    store.setConditionsShare('effects');
    await tick();
    let v = await lastView();
    expect(v.full).toEqual([]);
    expect(v.effects.length).toBeGreaterThan(0);
    expect(JSON.stringify(v)).not.toMatch(new RegExp(`${KEY}|"key"`));
    expect(v).toEqual(coachView(items(), 'effects'));

    store.setConditionsShare('full');
    await tick();
    v = await lastView();
    expect(v.full).toHaveLength(1);
    expect(v.full[0]).toMatchObject({ key: KEY, severity: 2 });
    expect(v.effects).toEqual([]);
    expect(v).toEqual(coachView(items(), 'full'));
    for (const w of shareWrites())
      expect(JSON.stringify(await unsealDoc(w.data, stub.material().key))).not.toContain('N-1');
  });

  it('identical state does not republish', async () => {
    store.addCondition({ key: KEY, severity: 2, share: 'full' });
    await echoConditions();
    const n = shareWrites().length;
    expect(n).toBeGreaterThan(0);
    await echoConditions();
    await echoConditions();
    expect(shareWrites().length).toBe(n);
    // Re-setting the same general default is a no-op too.
    store.setConditionsShare(general());
    await tick();
    expect(shareWrites().length).toBe(n);
  });

  it('a failed write is retried on the next change', async () => {
    store.addCondition({ key: KEY, severity: 1, share: 'full' });
    await tick();
    fs.failNext = true;
    await echoConditions();
    expect(shareWrites().length).toBe(0);
    await echoConditions();
    expect(shareWrites().length).toBe(1);
  });
});

describe('conditionPrefs round trip', () => {
  let stop: () => void;
  beforeEach(async () => {
    fs.writes.length = 0;
    fs.docs.clear();
    fs.listeners.clear();
    store.setConditionsShare('effects');
    stop = store.startSyncLoop();
    await tick();
    fs.writes.length = 0;
  });
  afterEach(() => stop());

  it('writes a sealed doc: enc envelope, only updatedAt open', async () => {
    store.setConditionsShare('full');
    await tick();
    const w = fs.writes.filter((x) => x.path === PREFS).at(-1)!;
    expect(isSealed(w.data)).toBe(true);
    expect(Object.keys(w.data).sort()).toEqual(['enc', 'updatedAt']);
    expect(JSON.stringify(w.data)).not.toContain('full');
    const plain = await unsealDoc<{ conditionsShare: string }>(w.data, stub.material().key);
    expect(plain.conditionsShare).toBe('full');
  });

  it('applies a value written by another device and republishes the view', async () => {
    store.addCondition({ key: KEY, severity: 2, share: 'inherit' });
    await echoConditions();
    fs.writes.length = 0;

    const { prepareWrite } = await import('./vaultIO');
    const sealed = await prepareWrite('conditionPrefs', { conditionsShare: 'off', updatedAt: 99 });
    fs.listeners.get(PREFS)!({ exists: () => true, data: () => sealed });
    await tick();
    expect(general()).toBe('off');
    expect(await lastView()).toEqual({ full: [], effects: [] });
    // Mirror applying must not write the prefs doc back (no echo loop).
    expect(fs.writes.filter((x) => x.path === PREFS)).toHaveLength(0);

    // Invalid value from another device is ignored.
    const bad = await prepareWrite('conditionPrefs', { conditionsShare: 'bogus', updatedAt: 100 });
    fs.listeners.get(PREFS)!({ exists: () => true, data: () => bad });
    await tick();
    expect(general()).toBe('off');
  });
});
