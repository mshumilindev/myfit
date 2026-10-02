import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => {
  const writes: { path: string; data: Record<string, unknown> }[] = [];
  const listeners = new Map<string, (snap: unknown) => void>();
  return { writes, listeners, docs: new Map<string, Record<string, unknown>>() };
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
import { isSealed, unsealDoc } from './encryptedDoc';
import { newAlcoholEntry, weekdayIndex } from './alcohol';
import { weeklyGrams } from './alcoholCatalog';
import { MAX_CHECKIN_DAYS, addDays } from './alcohol';
import { ALCOHOL_ENC_KEY, ALCOHOL_KEY } from './alcoholCache';
import type { AlcoholEntry, AlcoholState } from './types';

const PATH = 'users/u1/meta/alcohol';
// Waits until the Firestore write count stops changing (a fixed delay was flaky under load).
const tick = async () => {
  let last = -1;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 30));
    const n = fs.writes.filter((w) => w.path === PATH).length;
    if (n === last) return;
    last = n;
  }
};
const stub = vault as unknown as import('./autoVault').Vault;
const cur = (): AlcoholState => store.__getStateForTests().alcohol;
const alcWrites = () => fs.writes.filter((w) => w.path === PATH);
const lastPlain = async () =>
  unsealDoc<AlcoholState & Record<string, unknown>>(alcWrites().at(-1)!.data, stub.material().key);
const beerE = (over: Partial<AlcoholEntry> = {}): AlcoholEntry => ({
  ...newAlcoholEntry('beerRegular', 'e-beer', 500),
  servingsPerWeek: 4,
  ...over,
});

describe('alcohol store', () => {
  let stop: () => void;
  beforeEach(async () => {
    localStorage?.clear?.();
    fs.writes.length = 0;
    fs.docs.clear();
    fs.listeners.clear();
    store.deleteAlcoholData();
    stop = store.startSyncLoop();
    await tick();
    fs.writes.length = 0;
  });
  afterEach(() => stop());

  it('starts empty: master on, check-ins off, sharing off, no usual days, no entries, no effects', () => {
    expect(cur().entries).toEqual([]);
    expect(cur().settings.useInCalculations).toBe(true);
    expect(cur().settings.sharing).toBe('off');
    expect(cur().settings.usualDays).toEqual([]);
    expect(cur().settings.checkinsOn).toBe(false);
    expect(store.getAlcoholEffects()).toBeNull();
    expect(store.getAlcoholEffectsFor('2026-10-03')).toBeNull();
    expect(store.getAlcoholLoad()).toEqual({ gramsPerWeek: 0, gramsPerDay: 0 });
  });

  it('an old state without alcohol gives no effects, an empty load and a region (no crash)', () => {
    const st = store.__getStateForTests() as { alcohol?: unknown };
    const saved = st.alcohol;
    st.alcohol = undefined;
    try {
      expect(store.getAlcoholEffects()).toBeNull();
      expect(store.getAlcoholEffectsFor(Date.now())).toBeNull();
      expect(store.getAlcoholLoad()).toEqual({ gramsPerWeek: 0, gramsPerDay: 0 });
      expect(typeof store.getAlcoholRegion()).toBe('string');
      // A write on such a state starts from the defaults.
      expect(store.saveAlcoholEntry(beerE())).not.toBeNull();
      expect(cur().entries).toHaveLength(1);
    } finally {
      st.alcohol = saved;
    }
  });

  it('saves an entry as a sealed doc: only updatedAt is readable', async () => {
    store.saveAlcoholEntry(beerE());
    await tick();
    const w = alcWrites().at(-1)!;
    expect(isSealed(w.data)).toBe(true);
    expect(Object.keys(w.data).sort()).toEqual(['enc', 'updatedAt']);
    const text = JSON.stringify(w.data);
    for (const secret of ['beer', 'servingMl', 'entries', 'sharing', 'usualDays', 'e-beer'])
      expect(text).not.toContain(secret);
    const plain = await lastPlain();
    expect(plain.entries).toHaveLength(1);
    expect(plain.entries[0]).toMatchObject({ itemId: 'beerRegular', servingsPerWeek: 4 });
    expect(weeklyGrams(cur().entries)).toBeCloseTo(78.9, 1);
    expect(store.getAlcoholLoad().gramsPerWeek).toBeCloseTo(78.9, 1);
    expect(store.getAlcoholEffects()).not.toBeNull();
  });

  it('rejects an unknown drink (the user cannot create drinks) and writes nothing', async () => {
    expect(store.saveAlcoholEntry({ ...beerE(), itemId: 'moonshine' as never })).toBeNull();
    await tick();
    expect(alcWrites()).toHaveLength(0);
  });

  it('saving the same id replaces; remove deletes; unknown remove does not write', async () => {
    store.saveAlcoholEntry(beerE());
    store.saveAlcoholEntry(beerE({ servingsPerWeek: 7 }));
    expect(cur().entries).toHaveLength(1);
    expect(cur().entries[0].servingsPerWeek).toBe(7);
    store.saveAlcoholEntry({ ...newAlcoholEntry('spWhisky', 'e-w'), occasional: true });
    expect(cur().entries).toHaveLength(2);
    await tick();
    const n = alcWrites().length;
    store.removeAlcoholEntry('missing');
    await tick();
    expect(alcWrites().length).toBe(n);
    store.removeAlcoholEntry('e-beer');
    expect(cur().entries.map((e) => e.id)).toEqual(['e-w']);
    await tick();
    expect((await lastPlain()).entries.map((e) => e.id)).toEqual(['e-w']);
  });

  it('saves and clears the from-time-to-time flag', async () => {
    store.saveAlcoholEntry(beerE({ occasional: true }));
    expect(cur().entries[0].occasional).toBe(true);
    store.saveAlcoholEntry({ ...beerE(), occasional: undefined });
    expect('occasional' in cur().entries[0]).toBe(false);
  });

  it('master, surface, sharing, usual days and region settings persist and are validated', async () => {
    store.saveAlcoholEntry(beerE());
    store.setAlcoholUseInCalculations(false);
    expect(store.getAlcoholEffects()).toBeNull();
    store.setAlcoholUseInCalculations(true);
    store.setAlcoholSurface('sleep', true);
    store.setAlcoholSurface('readiness', true);
    store.setAlcoholSurface('sleep', false);
    store.setAlcoholSharing('effects');
    store.setAlcoholSharing('full' as never); // no 'full' level for alcohol
    store.setAlcoholSharing('bogus' as never);
    store.setAlcoholUsualDays([6, 4, 4, 9, -1, 4.5]);
    store.setAlcoholRegionOverride('us');
    store.setAlcoholCheckinsOn(true);
    await tick();
    expect(cur().settings).toMatchObject({
      useInCalculations: true,
      sharing: 'effects',
      usualDays: [4, 6],
      regionOverride: 'us',
      checkinsOn: true,
    });
    expect(cur().settings.surfaces.sleep).toBe(false);
    expect(store.getAlcoholRegion()).toBe('us');
    expect(store.getAlcoholEffects()!.sleepMin).toEqual({ low: 0, high: 0 });
    const plain = await lastPlain();
    expect(plain.settings.sharing).toBe('effects');
    expect(plain.settings.usualDays).toEqual([4, 6]);
    expect(plain.settings.checkinsOn).toBe(true);
    expect(plain.settings.regionOverride).toBe('us');
    const n = alcWrites().length;
    store.setAlcoholSharing('effects'); // same value
    store.setAlcoholUsualDays([4, 6]);
    store.setAlcoholCheckinsOn(true);
    store.setAlcoholRegionOverride('us');
    await tick();
    expect(alcWrites().length).toBe(n);
    store.setAlcoholRegionOverride(null); // back to detection
    expect('regionOverride' in cur().settings).toBe(false);
  });

  it('usual days make the day-after effect land on the next day only', () => {
    store.saveAlcoholEntry(beerE({ servingsPerWeek: 6 }));
    store.setAlcoholSurface('readiness', true);
    store.setAlcoholSurface('sleep', true);
    store.setAlcoholUsualDays([4]); // Friday
    expect(weekdayIndex('2026-10-02')).toBe(4);
    expect(store.getAlcoholEffectsFor('2026-10-02')!.readiness.high).toBe(1);
    expect(store.getAlcoholEffectsFor('2026-10-03')!.readiness.high).toBeLessThan(1);
    expect(store.getAlcoholEffects()!.readiness.high).toBeLessThan(1); // flat view unchanged
  });

  it('memoises the flat effects on the state object', () => {
    store.saveAlcoholEntry(beerE());
    expect(store.getAlcoholEffects()).toBe(store.getAlcoholEffects());
    expect(store.getAlcoholLoad()).toBe(store.getAlcoholLoad());
  });

  it('applies a newer doc from another device, ignores an older one, never echoes', async () => {
    store.saveAlcoholEntry(beerE());
    await tick();
    fs.writes.length = 0;
    const { prepareWrite } = await import('./vaultIO');
    const remote = {
      entries: [newAlcoholEntry('spGin', 'g1')],
      settings: { useInCalculations: false, sharing: 'effects', surfaces: {}, usualDays: [5] },
      updatedAt: Date.now() + 10_000,
    };
    const sealed = await prepareWrite('alcohol', remote);
    fs.listeners.get(PATH)!({ exists: () => true, data: () => sealed });
    await tick();
    expect(cur().entries.map((e) => e.id)).toEqual(['g1']);
    expect(cur().settings.useInCalculations).toBe(false);
    expect(cur().settings.sharing).toBe('effects');
    expect(cur().settings.usualDays).toEqual([5]);
    expect(alcWrites()).toHaveLength(0);

    const old = await prepareWrite('alcohol', { ...remote, entries: [], updatedAt: 5 });
    fs.listeners.get(PATH)!({ exists: () => true, data: () => old });
    await tick();
    expect(cur().entries.map((e) => e.id)).toEqual(['g1']);
  });

  it('deleteAlcoholData wipes state, the Firestore doc and the on-device copy', async () => {
    store.saveAlcoholEntry(beerE());
    store.setAlcoholSharing('effects');
    await tick();
    expect(fs.docs.has(PATH)).toBe(true);
    expect(
      localStorage.getItem(ALCOHOL_ENC_KEY) !== null || localStorage.getItem(ALCOHOL_KEY) !== null,
    ).toBe(true);
    store.deleteAlcoholData();
    await tick();
    expect(cur().entries).toEqual([]);
    expect(cur().settings.sharing).toBe('off');
    expect(cur().updatedAt).toBe(0);
    expect(fs.docs.has(PATH)).toBe(false);
    expect(localStorage.getItem(ALCOHOL_ENC_KEY)).toBeNull();
    expect(localStorage.getItem(ALCOHOL_KEY)).toBeNull();
    // A later unrelated change must not bring an empty copy back.
    store.setConditionsShare('off');
    await tick();
    expect(localStorage.getItem(ALCOHOL_ENC_KEY)).toBeNull();
    expect(localStorage.getItem(ALCOHOL_KEY)).toBeNull();
  });

  it('the on-device copy is sealed once the key exists (no plaintext drink data)', async () => {
    store.saveAlcoholEntry(beerE());
    await tick();
    const enc = localStorage.getItem(ALCOHOL_ENC_KEY);
    expect(enc).not.toBeNull();
    expect(enc).not.toContain('beer');
    expect(localStorage.getItem(ALCOHOL_KEY)).toBeNull();
  });

  it('resetLocalData clears alcohol too', async () => {
    store.saveAlcoholEntry(beerE());
    await tick();
    store.resetLocalData();
    expect(cur().entries).toEqual([]);
    expect(localStorage.getItem(ALCOHOL_ENC_KEY)).toBeNull();
    expect(localStorage.getItem(ALCOHOL_KEY)).toBeNull();
  });

  describe('day check-ins', () => {
    beforeEach(() => {
      store.saveAlcoholEntry(beerE({ servingsPerWeek: 6 }));
      store.setAlcoholUsualDays([4]); // Friday
    });

    it('answers none / usual / custom, seals them with the doc, and the effects follow', async () => {
      expect(store.getAlcoholEffectsFor('2026-10-03')!.readiness.high).toBeLessThan(1);
      expect(store.answerAlcoholDay('2026-10-02', { kind: 'none' })).toBe(true);
      expect(cur().checkins['2026-10-02']).toEqual({ drank: false });
      expect(store.getAlcoholEffectsFor('2026-10-03')!.readiness.high).toBe(1);
      expect(store.answerAlcoholDay('2026-10-02', { kind: 'usual' })).toBe(true);
      expect(cur().checkins['2026-10-02']).toMatchObject({ drank: true, entryIds: ['e-beer'] });
      expect(cur().checkins['2026-10-02'].grams).toBeCloseTo(118.4, 1);
      expect(store.answerAlcoholDay('2026-10-02', { kind: 'custom', grams: 25 })).toBe(true);
      expect(cur().checkins['2026-10-02']).toEqual({ drank: true, grams: 25 });
      expect(store.answerAlcoholDay('2026-10-04', { kind: 'custom', grams: 0 })).toBe(true);
      expect(cur().checkins['2026-10-04']).toEqual({ drank: false });
      expect(store.answerAlcoholDay('nope', { kind: 'none' })).toBe(false);
      expect(store.answerAlcoholDay('2026-10-05', { kind: 'custom', grams: Number.NaN })).toBe(
        false,
      );
      await tick();
      const w = alcWrites().at(-1)!;
      // Sealed: neither the answers nor their dates are readable on the wire.
      for (const secret of ['checkins', '2026-10-02', 'drank', 'grams'])
        expect(JSON.stringify(w.data)).not.toContain(secret);
      expect((await lastPlain()).checkins['2026-10-02']).toEqual({ drank: true, grams: 25 });
    });

    it('clearAlcoholDay makes the day unanswered again; no-ops do not write', async () => {
      store.answerAlcoholDay('2026-10-02', { kind: 'none' });
      await tick();
      const n = alcWrites().length;
      store.answerAlcoholDay('2026-10-02', { kind: 'none' }); // same answer
      store.clearAlcoholDay('2026-10-09'); // never answered
      await tick();
      expect(alcWrites().length).toBe(n);
      store.clearAlcoholDay('2026-10-02');
      expect(cur().checkins).toEqual({});
      await tick();
      expect(alcWrites().length).toBe(n + 1);
    });

    it("'usual' needs usual days and a drink", () => {
      store.setAlcoholUsualDays([]);
      expect(store.answerAlcoholDay('2026-10-02', { kind: 'usual' })).toBe(false);
    });

    it('keeps only the last 60 days', () => {
      for (let i = 0; i < 70; i++)
        store.answerAlcoholDay(addDays('2026-10-02', -i), { kind: 'none' });
      expect(Object.keys(cur().checkins)).toHaveLength(MAX_CHECKIN_DAYS);
      expect(cur().checkins['2026-10-02']).toBeDefined();
    });

    it('pending check-in and the week so far', () => {
      const sat9 = new Date(2026, 9, 3, 9).getTime();
      expect(store.getPendingAlcoholCheckin(sat9)).toBeNull(); // "Ask me on Today" is off
      store.setAlcoholCheckinsOn(true);
      expect(store.getPendingAlcoholCheckin(sat9)).toMatchObject({ date: '2026-10-02' });
      store.setAlcoholCheckinsOn(false);
      expect(store.getPendingAlcoholCheckin(sat9)).toBeNull();
      store.setAlcoholCheckinsOn(true);
      expect(store.getPendingAlcoholCheckin(sat9)).toMatchObject({ date: '2026-10-02' });
      expect(store.getPendingAlcoholCheckin(sat9)).toBe(store.getPendingAlcoholCheckin(sat9));
      store.answerAlcoholDay('2026-10-02', { kind: 'custom', grams: 40 });
      expect(store.getPendingAlcoholCheckin(sat9)).toBeNull();
      const w = store.getAlcoholWeekActual(sat9)!;
      expect(w).toMatchObject({ grams: 40, drinkDays: 1, from: '2026-09-28' });
    });

    it('an old state without alcohol: nothing pending, empty week, no crash', () => {
      const st = store.__getStateForTests() as { alcohol?: unknown };
      const saved = st.alcohol;
      st.alcohol = undefined;
      try {
        expect(store.getPendingAlcoholCheckin(Date.now() + 99)).toBeNull();
        expect(store.getAlcoholWeekActual()!.grams).toBe(0);
      } finally {
        st.alcohol = saved;
      }
    });

    it('delete and reset wipe the check-ins too', async () => {
      store.answerAlcoholDay('2026-10-02', { kind: 'none' });
      await tick();
      store.deleteAlcoholData();
      expect(cur().checkins).toEqual({});
      store.saveAlcoholEntry(beerE());
      store.answerAlcoholDay('2026-10-02', { kind: 'none' });
      store.resetLocalData();
      expect(cur().checkins).toEqual({});
    });
  });
});
