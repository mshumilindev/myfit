import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * SPO-107/108 follow-up: `forgetShareLevel` zeroes the RAW stored sharing level while the feature's consent is off (the
 * setters refuse then), writes only Off, and a later grant brings nothing back.
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
import { newNicotineProduct } from './nicotine';
import { newSupplementEntry } from './supplements';
import { setHealthConsentState, resetHealthGateForTests } from './data/healthConsentGate';
import { HEALTH_FEATURES, type HealthFeature } from './legal/consents';
import { isSealed, unsealDoc } from './encryptedDoc';
import { vault } from './vaultIO';
import type { CoachView } from './conditions';
import { CONDITION_CATALOG } from './data/conditionCatalog';
import type { ChronicCondition } from './types';

const settle = () => new Promise((r) => setTimeout(r, 60));
const stub = vault as unknown as import('./autoVault').Vault;
const onMap = (on: Partial<Record<HealthFeature, boolean>>) =>
  Object.fromEntries(HEALTH_FEATURES.map((f) => [f, !!on[f]])) as Record<HealthFeature, boolean>;
const setConsent = (on: Partial<Record<HealthFeature, boolean>>) =>
  setHealthConsentState({ on: onMap(on), ready: true, answered: onMap({}) });
const rawLevels = () => {
  const s = store.__getStateForTests();
  return {
    conditions: s.conditionsShare,
    nicotine: s.nicotine.settings.sharing,
    alcohol: s.alcohol.settings.sharing,
    supplements: s.supplements.settings.sharing,
  };
};
async function lastShareView(): Promise<CoachView | null> {
  const w = fs.writes.filter((x) => x.path === 'users/u1/meta/coachShare').at(-1);
  if (!w) return null;
  expect(isSealed(w.data)).toBe(true);
  return (await unsealDoc<{ view: CoachView }>(w.data, stub.material().key)).view;
}

const KINDS = ['conditions', 'nicotine', 'alcohol', 'supplements'] as const;
const FEATURE: Record<(typeof KINDS)[number], HealthFeature> = {
  conditions: 'chronic',
  nicotine: 'nicotine',
  alcohol: 'alcohol',
  supplements: 'supplements',
};

describe('forgetShareLevel', () => {
  let stop: () => void;
  beforeEach(async () => {
    localStorage?.clear?.();
    resetHealthGateForTests(true);
    store.setConditionsShare('off');
    store.setNicotineSharing('off');
    store.setAlcoholSharing('off');
    store.setSupplementSharing('off');
    stop = store.startSyncLoop();
    await settle();
    fs.writes.length = 0;
    fs.deletes.length = 0;
  });
  afterEach(() => {
    stop();
    resetHealthGateForTests(true);
    store.setConditionsShare('off');
    store.setNicotineSharing('off');
    store.setAlcoholSharing('off');
    store.setSupplementSharing('off');
  });

  it('with the feature OFF the setter refuses, forget still zeroes the stored level, and a re-grant does not restore it', async () => {
    store.setConditionsShare('full');
    store.setNicotineSharing('full');
    store.setAlcoholSharing('effects');
    store.setSupplementSharing('full');
    expect(rawLevels()).toEqual({
      conditions: 'full',
      nicotine: 'full',
      alcohol: 'effects',
      supplements: 'full',
    });
    setConsent({}); // every consent withdrawn
    store.setNicotineSharing('effects'); // the setter refuses while off
    expect(rawLevels().nicotine).toBe('full');
    for (const k of KINDS) store.forgetShareLevel(k);
    expect(rawLevels()).toEqual({
      conditions: 'off',
      nicotine: 'off',
      alcohol: 'off',
      supplements: 'off',
    });
    await settle();
    // the sealed documents on the wire say Off too (an offline write is queued by Firestore persistence)
    const nic = fs.writes.filter((w) => w.path === 'users/u1/meta/nicotine').at(-1)!;
    expect(
      (await unsealDoc<{ settings: { sharing: string } }>(nic.data, stub.material().key)).settings
        .sharing,
    ).toBe('off');
    // re-grant: nothing comes back, on this device or in what a coach sees
    fs.writes.length = 0;
    setConsent(onMap(Object.fromEntries(HEALTH_FEATURES.map((f) => [f, true]))));
    store.setNicotineSharing('off');
    await settle();
    expect(rawLevels()).toEqual({
      conditions: 'off',
      nicotine: 'off',
      alcohol: 'off',
      supplements: 'off',
    });
    const v = await lastShareView();
    if (v) {
      expect(v.nicotine).toBeUndefined();
      expect(v.alcohol).toBeUndefined();
      expect(v.supplements).toBeUndefined();
    }
  });

  it('each kind republishes the coach view without the feature, one step at a time', async () => {
    store.saveNicotineProduct(newNicotineProduct('vape', 'p1'));
    store.saveSupplementEntry(newSupplementEntry('creatine', 'e2', 1000));
    store.setNicotineSharing('full');
    store.setSupplementSharing('effects');
    await settle();
    expect((await lastShareView())!.nicotine).toBeDefined();
    store.forgetShareLevel('nicotine');
    await settle();
    const v = (await lastShareView())!;
    expect(v.nicotine).toBeUndefined();
    store.forgetShareLevel('supplements');
    await settle();
    expect((await lastShareView())!.supplements).toBeUndefined();
  });

  it('it can only lower: an Off level stays Off and nothing is written for it', async () => {
    for (const k of KINDS) store.forgetShareLevel(k);
    await settle();
    expect(
      fs.writes.filter((w) => /meta\/(nicotine|alcohol|supplements|conditionPrefs)/.test(w.path)),
    ).toEqual([]);
    expect(rawLevels()).toEqual({
      conditions: 'off',
      nicotine: 'off',
      alcohol: 'off',
      supplements: 'off',
    });
    // no level parameter exists: the signature takes the kind only
    expect(store.forgetShareLevel.length).toBe(1);
  });

  it('with consent ON it behaves like the setter (level Off, feature data untouched)', () => {
    store.setSupplementSharing('full');
    store.forgetShareLevel('supplements');
    expect(rawLevels().supplements).toBe('off');
    expect(FEATURE.supplements).toBe('supplements');
  });

  it('B1: a per-condition Full override does not outlive Stop, the general Off, or a re-grant', async () => {
    const c = store.addCondition({
      key: CONDITION_CATALOG[0].key,
      severity: 2,
      share: 'full',
    }) as ChronicCondition;
    store.setConditionsShare('effects'); // publishes the view with the override
    await settle();
    expect((await lastShareView())!.full).toHaveLength(1);
    // the general level Off is a master off for the published view, even before any Stop
    store.setConditionsShare('off');
    await settle();
    let v = (await lastShareView())!;
    expect(v.full).toEqual([]);
    expect(v.effects).toEqual([]);
    store.setConditionsShare('effects');
    await settle();
    expect((await lastShareView())!.full).toHaveLength(1);
    // Stop: nothing full/effects is published and the override itself is gone from the stored state
    store.forgetShareLevel('conditions');
    await settle();
    v = (await lastShareView())!;
    expect(v.full).toEqual([]);
    expect(v.effects).toEqual([]);
    expect(store.__getStateForTests().conditions.find((x) => x.id === c.id)!.share).toBe('off');
    // re-grant: the override does not come back
    store.setConditionsShare('effects');
    await settle();
    v = (await lastShareView())!;
    expect(v.full).toEqual([]);
    expect(v.effects).toEqual([]);
  });
});
