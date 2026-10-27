import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * SPO-290 review fixes. Owner decision: the safety limits already stored (an active injury needing rest, a pregnancy,
 * a limiting condition) keep RESTRICTING (streak protection, load caps, cycle pause) when their feature is off, and are
 * never DISPLAYED. Writers refuse explicitly. Nothing new reaches localStorage while off; a late Firestore snapshot cannot
 * put deleted data back.
 */
const fs = vi.hoisted(() => ({
  writes: [] as { path: string; data: Record<string, unknown> }[],
  deletes: [] as string[],
  listeners: new Map<string, (snap: unknown) => void>(),
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
import { openSealedLocal } from './testVault';
import { newAlcoholEntry } from './alcohol';
import { newNicotineProduct } from './nicotine';
import { newSupplementEntry } from './supplements';
import {
  isHealthWriteDenied,
  resetHealthGateForTests,
  setHealthConsentState,
  closeHealthPrompt,
} from './data/healthConsentGate';
import { HEALTH_FEATURES, type HealthFeature } from './legal/consents';
import { healthBuildCtx } from './healthBuild';
import { dayKey } from './store';

const settle = () => new Promise((r) => setTimeout(r, 60));
const DAY = 86_400_000;
/** Everything on except the listed features. */
const allExcept = (...off: HealthFeature[]) =>
  setHealthConsentState({
    on: Object.fromEntries(HEALTH_FEATURES.map((k) => [k, !off.includes(k)])) as never,
    answered: {} as never,
    ready: true,
  });
const denied = (r: unknown, feature: HealthFeature) =>
  expect(r).toEqual({ ok: false, reason: 'consent', feature });

/** One active injury that needs rest, logged while the feature is on, then the feature goes off. */
function injuredThenOff(): string {
  resetHealthGateForTests(true);
  const inj = store.startInjury({
    reason: 'injury',
    bodyPart: 'knee',
    muscles: ['quads'],
    stage: 'protect',
    startDay: dayKey(Date.now()) - 3,
  });
  if (isHealthWriteDenied(inj)) throw new Error('should be on');
  allExcept('injuries');
  return inj.id;
}

describe('safety limits keep restricting while the feature is off (SPO-290 owner decision)', () => {
  let stop: () => void;
  beforeEach(async () => {
    localStorage?.clear?.();
    resetHealthGateForTests(true);
    for (const f of ['injuries', 'chronic', 'cycle', 'nicotine', 'alcohol', 'supplements'] as const)
      store.deleteStoredHealthData(f);
    stop = store.startSyncLoop();
    await settle();
    fs.writes.length = 0;
    fs.deletes.length = 0;
  });
  afterEach(() => {
    stop();
    closeHealthPrompt();
    resetHealthGateForTests(true);
  });

  it('DISPLAY: activeInjury / activeInjuryList / the store view show nothing while Injuries is off', () => {
    resetHealthGateForTests(true);
    store.startInjury({ reason: 'injury', bodyPart: 'knee', muscles: ['quads'], stage: 'protect' });
    expect(store.activeInjury()).not.toBeNull();
    allExcept('injuries');
    expect(store.activeInjury()).toBeNull();
    expect(store.activeInjuryList()).toEqual([]);
    expect(store.getStoreState().injuries).toEqual([]);
  });

  it('RESTRICTION: the stored injury still protects the streak (and nothing is displayed)', () => {
    const now = Date.now();
    const today = dayKey(now);
    injuredThenOff();
    const protectedDay = store.streakProtectedPredicate(now);
    expect(protectedDay(today - 2)).toBe(true); // inside the rehab window
    expect(protectedDay(today - 10)).toBe(false); // before it began
    expect(store.activeInjury()).toBeNull();
    // with Injuries on the answer is the same: the consent never changes what restricts
    resetHealthGateForTests(true);
    expect(store.streakProtectedPredicate(now)(today - 2)).toBe(true);
  });

  it('RESTRICTION: workout generation caps and protects from stored injuries and conditions', () => {
    resetHealthGateForTests(true);
    store.startInjury({ reason: 'injury', bodyPart: 'knee', muscles: ['quads'], stage: 'protect' });
    store.addCondition({ key: 'asthma', severity: 2, share: 'off' });
    const on = healthBuildCtx(Date.now());
    expect(on.protectedMuscles).toContain('quads');
    allExcept('injuries', 'chronic');
    expect(store.getStoreState().injuries).toEqual([]);
    expect(store.getStoreState().conditions).toEqual([]);
    const off = healthBuildCtx(Date.now());
    expect(off.protectedMuscles).toEqual(on.protectedMuscles);
    expect([...off.loadCaps]).toEqual([...on.loadCaps]);
    expect(off.conditions.keys).toEqual(on.conditions.keys);
    expect(store.getStoredLimits().injuries).toHaveLength(1);
  });

  it('RESTRICTION: with consent unknown (fail closed at start) the stored limits still apply', () => {
    injuredThenOff();
    resetHealthGateForTests(false);
    expect(healthBuildCtx(Date.now()).protectedMuscles).toContain('quads');
    expect(store.streakProtectedPredicate()(dayKey(Date.now()) - 1)).toBe(true);
  });

  it('a stored pregnancy pauses the Cycle by limit but is not named without the Chronic consent', async () => {
    const { cyclePause } = await import('./cycle/cycleView');
    resetHealthGateForTests(true);
    store.addCondition({
      key: 'preg_first',
      severity: 2,
      share: 'off',
      startedAt: Date.now() - 20 * DAY,
    });
    const stored = store.getStoredLimits().conditions;
    expect(cyclePause(store.getStoreState().conditions, stored, Date.now())).toBe('pregnancy');
    allExcept('chronic');
    expect(
      cyclePause(store.getStoreState().conditions, store.getStoredLimits().conditions, Date.now()),
    ).toBe('hidden');
  });
});

describe('writers refuse explicitly without consent (S1/B2)', () => {
  let stop: () => void;
  beforeEach(async () => {
    localStorage?.clear?.();
    resetHealthGateForTests(true);
    for (const f of ['injuries', 'chronic', 'cycle', 'nicotine', 'alcohol', 'supplements'] as const)
      store.deleteStoredHealthData(f);
    stop = store.startSyncLoop();
    await settle();
    resetHealthGateForTests(false);
    fs.writes.length = 0;
  });
  afterEach(() => {
    stop();
    closeHealthPrompt();
    resetHealthGateForTests(true);
  });

  it('every writer returns { ok:false, reason:"consent" } and stores nothing', async () => {
    denied(
      store.saveCycleSettings({ mode: 'regular', length: 28, period: 5, anchor: Date.now() }),
      'cycle',
    );
    denied(store.saveNicotineProduct(newNicotineProduct('vape', 'p1')), 'nicotine');
    denied(store.saveAlcoholEntry(newAlcoholEntry('beerRegular', 'e1', 500)), 'alcohol');
    denied(store.saveSupplementEntry(newSupplementEntry('creatine', 'e2', 1000)), 'supplements');
    denied(
      store.startInjury({
        reason: 'injury',
        bodyPart: 'knee',
        muscles: ['quads'],
        stage: 'protect',
      }),
      'injuries',
    );
    denied(store.addCondition({ key: 'asthma', severity: 2, share: 'off' }), 'chronic');
    denied(store.markPregnancyFromCycle(Date.now() - 20 * DAY), 'chronic');
    denied(store.markMenopauseFromCycle(), 'chronic');
    denied(store.updateCondition('x', { severity: 3 }), 'chronic');
    const today = dayKey(Date.now());
    denied(
      store.logPastInjury({
        bodyPart: 'knee',
        side: 'left',
        startDay: today - 9,
        healedDay: today - 2,
      }),
      'injuries',
    );
    denied(
      store.updateInjury('x', {
        bodyPart: 'knee',
        side: 'left',
        startDay: today - 9,
        healedDay: null,
      }),
      'injuries',
    );
    denied(store.logRehabCheckin('x', 'fine' as never), 'injuries');
    expect(store.answerAlcoholDay(Date.now(), { kind: 'none' })).toBe(false);
    expect(store.answerSupplementDay(Date.now(), { kind: 'all' })).toBe(false);
    store.setInjuryStage('x', 'return'); // patchInjury off path: a no-op
    await settle();
    expect(fs.writes).toEqual([]);
    const raw = store.__getStateForTests();
    expect(raw.injuries).toEqual([]);
    expect(raw.conditions).toEqual([]);
    expect(raw.cycle.enabled).toBe(false);
  });

  it('with consent the same writers succeed with their usual values', () => {
    resetHealthGateForTests(true);
    expect(
      store.saveCycleSettings({ mode: 'regular', length: 28, period: 5, anchor: Date.now() }),
    ).toEqual({
      ok: true,
    });
    const c = store.addCondition({ key: 'asthma', severity: 2, share: 'off' });
    expect(isHealthWriteDenied(c)).toBe(false);
    expect((c as { key: string }).key).toBe('asthma');
  });

  it('patchInjury / logRehabCheckin / updateInjury cannot change a stored injury while off', () => {
    const id = injuredThenOff();
    store.setInjuryStage(id, 'return');
    store.healInjury(id);
    denied(store.logRehabCheckin(id, 'fine' as never), 'injuries');
    const today = dayKey(Date.now());
    denied(
      store.updateInjury(id, {
        bodyPart: 'ankle',
        side: 'left',
        startDay: today - 5,
        healedDay: null,
      }),
      'injuries',
    );
    const stored = store.getStoredLimits().injuries[0];
    expect(stored.stage).toBe('protect');
    expect(stored.healedDay).toBeNull();
    expect(stored.bodyPart).toBe('knee');
  });
});

describe('persistence and mirrors while off / after delete (S3/S4)', () => {
  let stop: () => void;
  beforeEach(async () => {
    localStorage?.clear?.();
    resetHealthGateForTests(true);
    for (const f of ['injuries', 'chronic', 'cycle', 'nicotine', 'alcohol', 'supplements'] as const)
      store.deleteStoredHealthData(f);
    stop = store.startSyncLoop();
    await settle();
    fs.writes.length = 0;
    fs.deletes.length = 0;
  });
  afterEach(() => {
    stop();
    resetHealthGateForTests(true);
  });

  // The on-device copy is sealed (SPO-216): open it with the test vault's key; plaintext must not exist.
  const lsInjuries = async () => {
    await settle();
    expect(localStorage.getItem('spotter.injuries')).toBeNull();
    return (await openSealedLocal<{ id: string }[]>(vault, 'spotter.injuries')) ?? [];
  };
  const injuryDoc = (id: string) => ({
    id,
    reason: 'injury',
    bodyPart: 'elbow',
    side: 'left',
    muscles: ['biceps'],
    stage: 'protect',
    startDay: dayKey(Date.now()) - 1,
    createdAt: Date.now(),
    checkins: [],
    note: null,
    fullRestUntil: null,
    healedDay: null,
  });

  it('spotter.injuries is not written while Injuries is off, even when a mirror brings an injury', async () => {
    injuredThenOff();
    await settle();
    const before = localStorage.getItem('spotter.injuries.enc');
    fs.listeners.get('users/u1/injuries')!({ docs: [{ data: () => injuryDoc('late') }] });
    await settle();
    expect(localStorage.getItem('spotter.injuries.enc')).toBe(before);
    expect((await lsInjuries()).some((i) => i.id === 'late')).toBe(false);
    // memory still holds it as a limit; turning the feature on writes the up-to-date copy
    expect(store.getStoredLimits().injuries.some((i) => i.id === 'late')).toBe(true);
    resetHealthGateForTests(true);
    expect((await lsInjuries()).some((i) => i.id === 'late')).toBe(true);
  });

  it('deleting while off empties the on-device copy too', async () => {
    injuredThenOff();
    expect(await lsInjuries()).toHaveLength(1);
    store.deleteStoredHealthData('injuries');
    expect(await lsInjuries()).toEqual([]);
    expect(store.hasStoredHealthData('injuries')).toBe(false);
  });

  it('a snapshot of an injury deleted a moment ago does not bring it back', async () => {
    const id = injuredThenOff();
    store.deleteStoredHealthData('injuries');
    fs.listeners.get('users/u1/injuries')!({ docs: [{ data: () => injuryDoc(id) }] });
    await settle();
    expect(store.getStoredLimits().injuries).toEqual([]);
    expect(await lsInjuries()).toEqual([]);
  });

  it('an old cycle document that arrives after the delete does not bring the cycle back', async () => {
    store.saveCycleSettings({ mode: 'regular', length: 28, period: 5, anchor: Date.now() });
    const old = store.__getStateForTests().cycle;
    expect(old.enabled).toBe(true);
    await settle();
    allExcept('cycle');
    store.deleteStoredHealthData('cycle');
    expect(store.hasStoredHealthData('cycle')).toBe(false);
    const sealed = fs.writes.filter((w) => w.path === 'users/u1/meta/cycle').at(-1)!.data;
    fs.listeners.get('users/u1/meta/cycle')!({ exists: () => true, data: () => sealed });
    await settle();
    expect(store.hasStoredHealthData('cycle')).toBe(false);
    expect(store.__getStateForTests().cycle.enabled).toBe(false);
  });

  it('chronic delete also deletes meta/conditionPrefs and resets the sharing level', async () => {
    store.addCondition({ key: 'asthma', severity: 2, share: 'inherit' });
    store.setConditionsShare('full');
    expect(store.__getStateForTests().conditionsShare).toBe('full');
    allExcept('chronic');
    store.deleteStoredHealthData('chronic');
    await settle();
    expect(store.__getStateForTests().conditions).toEqual([]);
    expect(store.__getStateForTests().conditionsShare).toBe('effects');
    expect(fs.deletes).toContain('users/u1/meta/conditionPrefs');
    expect(JSON.stringify(localStorage)).not.toContain('"full"');
  });

  it('a stale conditionPrefs document after the delete does not restore the sharing level', async () => {
    store.addCondition({ key: 'asthma', severity: 2, share: 'inherit' });
    store.setConditionsShare('full');
    await settle();
    const prefs = fs.writes.filter((w) => w.path === 'users/u1/meta/conditionPrefs').at(-1)!.data;
    store.deleteStoredHealthData('chronic');
    fs.listeners.get('users/u1/meta/conditionPrefs')!({ exists: () => true, data: () => prefs });
    await settle();
    expect(store.__getStateForTests().conditionsShare).toBe('effects');
  });
});
