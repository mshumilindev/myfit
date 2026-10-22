import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * SPO-290: a health feature without consent is OFF. No write reaches the store or Firestore, data stored earlier is not
 * shown or processed (every reader gets the empty value) and is not deleted until the person asks.
 */
const fs = vi.hoisted(() => ({
  writes: [] as { path: string; data: Record<string, unknown> }[],
  deletes: [] as string[],
}));

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
    deleteDoc: vi.fn(async (r: { path: string }) => void fs.deletes.push(r.path)),
    setDoc: vi.fn(async (r: { path: string }, data: Record<string, unknown>) => {
      fs.writes.push({ path: r.path, data });
    }),
    onSnapshot: () => () => undefined,
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
import { newAlcoholEntry } from './alcohol';
import { newNicotineProduct } from './nicotine';
import { newSupplementEntry } from './supplements';
import { resetHealthGateForTests, setHealthConsentState } from './data/healthConsentGate';
import { HEALTH_FEATURES, type HealthFeature } from './legal/consents';

const settle = () => new Promise((r) => setTimeout(r, 60));
const writesTo = (frag: string) => fs.writes.filter((w) => w.path.includes(frag));

/** One real write per feature, and where it lands. */
const ACTIONS: Record<Exclude<HealthFeature, 'nutrition'>, { write: () => void; path: string }> = {
  injuries: {
    path: 'users/u1/injuries/',
    write: () =>
      void store.startInjury({
        reason: 'injury',
        bodyPart: 'knee',
        muscles: ['quads'],
        stage: 'protect',
      }),
  },
  chronic: {
    path: 'users/u1/conditions/',
    write: () => void store.addCondition({ key: 'asthma', severity: 2, share: 'off' }),
  },
  cycle: {
    path: 'users/u1/meta/cycle',
    write: () =>
      store.saveCycleSettings({ mode: 'regular', length: 28, period: 5, anchor: Date.now() }),
  },
  nicotine: {
    path: 'users/u1/meta/nicotine',
    write: () => void store.saveNicotineProduct(newNicotineProduct('vape', 'p1')),
  },
  alcohol: {
    path: 'users/u1/meta/alcohol',
    write: () => void store.saveAlcoholEntry(newAlcoholEntry('beerRegular', 'e1', 500)),
  },
  supplements: {
    path: 'users/u1/meta/supplements',
    write: () => void store.saveSupplementEntry(newSupplementEntry('creatine', 'e2', 1000)),
  },
};
const FEATURES = Object.keys(ACTIONS) as (keyof typeof ACTIONS)[];

const seen = (f: keyof typeof ACTIONS): number => {
  const s = store.getStoreState();
  switch (f) {
    case 'injuries':
      return s.injuries.length;
    case 'chronic':
      return s.conditions.length;
    case 'cycle':
      return s.cycle.enabled ? 1 : 0;
    case 'nicotine':
      return s.nicotine.products.length;
    case 'alcohol':
      return s.alcohol.entries.length;
    case 'supplements':
      return s.supplements.entries.length;
  }
};
const raw = (f: keyof typeof ACTIONS): number => {
  const s = store.__getStateForTests();
  return {
    injuries: s.injuries.length,
    chronic: s.conditions.length,
    cycle: s.cycle.enabled ? 1 : 0,
    nicotine: s.nicotine.products.length,
    alcohol: s.alcohol.entries.length,
    supplements: s.supplements.entries.length,
  }[f];
};

describe('health consent in the store', () => {
  let stop: () => void;
  beforeEach(async () => {
    localStorage?.clear?.();
    resetHealthGateForTests(true);
    for (const f of FEATURES) store.deleteStoredHealthData(f);
    stop = store.startSyncLoop();
    await settle();
    fs.writes.length = 0;
    fs.deletes.length = 0;
    resetHealthGateForTests(false);
  });
  afterEach(() => {
    stop();
    resetHealthGateForTests(true);
  });

  it('every feature is off by default (fail closed)', () => {
    const s = store.getStoreState();
    expect(s.injuries).toEqual([]);
    expect(s.conditions).toEqual([]);
    expect(s.nicotine.products).toEqual([]);
    expect(store.getNicotineEffects()).toBeNull();
  });

  for (const f of FEATURES) {
    it(`${f}: with no consent nothing is stored or written`, async () => {
      ACTIONS[f].write();
      await settle();
      expect(writesTo(ACTIONS[f].path)).toEqual([]);
      expect(raw(f)).toBe(0);
      expect(seen(f)).toBe(0);
    });

    it(`${f}: with consent the same action is stored and written`, async () => {
      setHealthConsentState({
        on: { ...Object.fromEntries(HEALTH_FEATURES.map((k) => [k, false])), [f]: true } as never,
        answered: {} as never,
        ready: true,
      });
      ACTIONS[f].write();
      await settle();
      expect(writesTo(ACTIONS[f].path).length).toBeGreaterThan(0);
      expect(seen(f)).toBe(1);
    });

    it(`${f}: data stored earlier is not shown while off, is kept, and comes back on consent`, async () => {
      resetHealthGateForTests(true);
      ACTIONS[f].write();
      await settle();
      expect(seen(f)).toBe(1);
      resetHealthGateForTests(false);
      expect(seen(f)).toBe(0);
      expect(raw(f)).toBe(1);
      expect(store.hasStoredHealthData(f)).toBe(true);
      resetHealthGateForTests(true);
      expect(seen(f)).toBe(1);
    });

    it(`${f}: deleting removes what is stored through the feature's own path, even while off`, async () => {
      resetHealthGateForTests(true);
      ACTIONS[f].write();
      await settle();
      resetHealthGateForTests(false);
      fs.deletes.length = 0;
      store.deleteStoredHealthData(f);
      await settle();
      expect(raw(f)).toBe(0);
      expect(store.hasStoredHealthData(f)).toBe(false);
      expect(fs.deletes.some((p) => p.includes(ACTIONS[f].path))).toBe(true);
    });
  }

  it('one feature off leaves the others working', async () => {
    resetHealthGateForTests(true);
    setHealthConsentState({
      on: {
        ...Object.fromEntries(HEALTH_FEATURES.map((k) => [k, true])),
        nicotine: false,
      } as never,
      answered: {} as never,
      ready: true,
    });
    ACTIONS.alcohol.write();
    ACTIONS.nicotine.write();
    await settle();
    expect(seen('alcohol')).toBe(1);
    expect(seen('nicotine')).toBe(0);
  });
});
