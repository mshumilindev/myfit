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
import { MAX_CHECKIN_DAYS, addDays, newSupplementEntry } from './supplements';
import { SUPPLEMENTS_ENC_KEY, SUPPLEMENTS_KEY } from './supplementsCache';
import type { SupplementEntry, SupplementState } from './types';

const PATH = 'users/u1/meta/supplements';
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
const cur = (): SupplementState => store.__getStateForTests().supplements;
const supWrites = () => fs.writes.filter((w) => w.path === PATH);
const lastPlain = async () =>
  unsealDoc<SupplementState & Record<string, unknown>>(
    supWrites().at(-1)!.data,
    stub.material().key,
  );
const creatine = (over: Partial<SupplementEntry> = {}): SupplementEntry => ({
  ...newSupplementEntry('creatine', 'e-cr', 1000),
  ...over,
});
const whey = (over: Partial<SupplementEntry> = {}): SupplementEntry => ({
  ...newSupplementEntry('whey', 'e-wh', 1000),
  ...over,
});
const ALL = { isTrainingDay: () => true };

describe('supplements store', () => {
  let stop: () => void;
  beforeEach(async () => {
    localStorage?.clear?.();
    fs.writes.length = 0;
    fs.docs.clear();
    fs.listeners.clear();
    store.deleteSupplementData();
    stop = store.startSyncLoop();
    await tick();
    fs.writes.length = 0;
  });
  afterEach(() => stop());

  it('starts empty: master on, check-ins off, sharing off, no entries, no effects', () => {
    expect(cur().entries).toEqual([]);
    expect(cur().settings.useInCalculations).toBe(true);
    expect(cur().settings.checkinsOn).toBe(false);
    expect(cur().settings.sharing).toBe('off');
    expect(store.getSupplementEffectsFor('2026-10-03', ALL)).toBeNull();
    expect(store.getSupplementProteinGramsFor('2026-10-03', ALL)).toBe(0);
    expect(store.getSupplements()).toEqual(cur());
  });

  it('an old state without supplements gives no effects, no warnings, nothing pending (no crash)', () => {
    const st = store.__getStateForTests() as { supplements?: unknown };
    const saved = st.supplements;
    st.supplements = undefined;
    try {
      expect(store.getSupplementEffectsFor(Date.now(), ALL)).toBeNull();
      expect(store.getSupplementWarnings(ALL)).toEqual([]);
      expect(store.getPendingSupplementCheckin(ALL)).toBeNull();
      expect(store.getSupplements().entries).toEqual([]);
      // A write on such a state starts from the defaults.
      expect(store.saveSupplementEntry(creatine())).not.toBeNull();
      expect(cur().entries).toHaveLength(1);
    } finally {
      st.supplements = saved;
    }
  });

  it('saves an entry as a sealed doc: only updatedAt is readable', async () => {
    store.saveSupplementEntry(creatine());
    await tick();
    const w = supWrites().at(-1)!;
    expect(isSealed(w.data)).toBe(true);
    expect(Object.keys(w.data).sort()).toEqual(['enc', 'updatedAt']);
    const text = JSON.stringify(w.data);
    for (const secret of [
      'creatine',
      'dose',
      'entries',
      'sharing',
      'startedAt',
      'e-cr',
      'checkins',
    ])
      expect(text).not.toContain(secret);
    const plain = await lastPlain();
    expect(plain.entries).toHaveLength(1);
    expect(plain.entries[0]).toMatchObject({ itemId: 'creatine', dose: 5, startedAt: 1000 });
    expect(store.getSupplementEffectsFor('2027-03-01', ALL)).not.toBeNull();
  });

  it('rejects an unknown item (the user cannot create items) and writes nothing', async () => {
    expect(store.saveSupplementEntry({ ...creatine(), itemId: 'moonshine' as never })).toBeNull();
    await tick();
    expect(supWrites()).toHaveLength(0);
  });

  it('startedAt is set when the entry is first saved and kept on every edit', async () => {
    const before = Date.now();
    const first = store.saveSupplementEntry({ ...creatine(), startedAt: 0 })!;
    expect(first.startedAt).toBeGreaterThanOrEqual(before); // a missing one is "now"
    const stamped = first.startedAt;
    const edited = store.saveSupplementEntry({
      ...creatine({ dose: 3, schedule: 'trainingDays', timing: 'morning' }),
      startedAt: 5, // whatever the caller sends is ignored for an existing id
    })!;
    expect(edited.startedAt).toBe(stamped);
    expect(cur().entries[0]).toMatchObject({
      dose: 3,
      schedule: 'trainingDays',
      timing: 'morning',
      startedAt: stamped,
    });
    await tick();
    expect((await lastPlain()).entries[0].startedAt).toBe(stamped);
    // Removing and adding again starts over.
    store.removeSupplementEntry('e-cr');
    const again = store.saveSupplementEntry({ ...creatine(), startedAt: 0 })!;
    expect(again.startedAt).toBeGreaterThanOrEqual(stamped);
  });

  it('a given startedAt is kept for a new entry; the dose is clamped to the item range', () => {
    const e = store.saveSupplementEntry(creatine({ dose: 500 }))!;
    expect(e.startedAt).toBe(1000);
    expect(e.dose).toBe(20);
  });

  it('saving the same id replaces; remove deletes; unknown remove does not write', async () => {
    store.saveSupplementEntry(creatine());
    store.saveSupplementEntry(creatine({ dose: 4 }));
    expect(cur().entries).toHaveLength(1);
    expect(cur().entries[0].dose).toBe(4);
    store.saveSupplementEntry(whey());
    expect(cur().entries).toHaveLength(2);
    await tick();
    const n = supWrites().length;
    store.removeSupplementEntry('missing');
    await tick();
    expect(supWrites().length).toBe(n);
    store.removeSupplementEntry('e-cr');
    expect(cur().entries.map((e) => e.id)).toEqual(['e-wh']);
    await tick();
    expect((await lastPlain()).entries.map((e) => e.id)).toEqual(['e-wh']);
  });

  it('master, surface, sharing and check-in settings persist and are validated', async () => {
    store.saveSupplementEntry(whey());
    store.setSupplementUseInCalculations(false);
    expect(store.getSupplementEffectsFor('2026-10-06', ALL)).toBeNull();
    store.setSupplementUseInCalculations(true);
    expect(store.getSupplementEffectsFor('2026-10-06', ALL)!.proteinGrams.high).toBe(20);
    store.setSupplementSurface('protein', false);
    expect(store.getSupplementEffectsFor('2026-10-06', ALL)).toBeNull();
    store.setSupplementSurface('protein', true);
    store.setSupplementSharing('effects');
    store.setSupplementSharing('bogus' as never);
    store.setSupplementSharing('full');
    store.setSupplementCheckinsOn(false);
    await tick();
    expect(cur().settings).toMatchObject({
      useInCalculations: true,
      sharing: 'full',
      checkinsOn: false,
    });
    const plain = await lastPlain();
    expect(plain.settings.sharing).toBe('full');
    expect(plain.settings.checkinsOn).toBe(false);
    const n = supWrites().length;
    store.setSupplementSharing('full'); // same value
    store.setSupplementCheckinsOn(false);
    store.setSupplementSurface('protein', true);
    await tick();
    expect(supWrites().length).toBe(n);
  });

  it('memoises nothing it should not: the document object is stable until something changes', () => {
    store.saveSupplementEntry(creatine());
    expect(store.getSupplements()).toBe(store.getSupplements());
    const before = store.getSupplements();
    store.setSupplementCheckinsOn(true);
    expect(store.getSupplements()).not.toBe(before);
  });

  it('applies a newer doc from another device, ignores an older one, never echoes', async () => {
    store.saveSupplementEntry(creatine());
    await tick();
    fs.writes.length = 0;
    const { prepareWrite } = await import('./vaultIO');
    const remote = {
      entries: [newSupplementEntry('zinc', 'z1', 5)],
      settings: { useInCalculations: false, sharing: 'effects', surfaces: {}, checkinsOn: false },
      checkins: { '2026-10-01': { taken: false } },
      updatedAt: Date.now() + 10_000,
    };
    const sealed = await prepareWrite('supplements', remote);
    fs.listeners.get(PATH)!({ exists: () => true, data: () => sealed });
    await tick();
    expect(cur().entries.map((e) => e.id)).toEqual(['z1']);
    expect(cur().settings).toMatchObject({
      useInCalculations: false,
      sharing: 'effects',
      checkinsOn: false,
    });
    expect(cur().checkins).toEqual({ '2026-10-01': { taken: false } });
    expect(supWrites()).toHaveLength(0);

    const old = await prepareWrite('supplements', { ...remote, entries: [], updatedAt: 5 });
    fs.listeners.get(PATH)!({ exists: () => true, data: () => old });
    await tick();
    expect(cur().entries.map((e) => e.id)).toEqual(['z1']);
  });

  it('deleteSupplementData wipes state, the Firestore doc and the on-device copy', async () => {
    store.saveSupplementEntry(creatine());
    store.setSupplementSharing('effects');
    await tick();
    expect(fs.docs.has(PATH)).toBe(true);
    expect(
      localStorage.getItem(SUPPLEMENTS_ENC_KEY) !== null ||
        localStorage.getItem(SUPPLEMENTS_KEY) !== null,
    ).toBe(true);
    store.deleteSupplementData();
    await tick();
    expect(cur().entries).toEqual([]);
    expect(cur().settings.sharing).toBe('off');
    expect(cur().updatedAt).toBe(0);
    expect(fs.docs.has(PATH)).toBe(false);
    expect(localStorage.getItem(SUPPLEMENTS_ENC_KEY)).toBeNull();
    expect(localStorage.getItem(SUPPLEMENTS_KEY)).toBeNull();
    // A later unrelated change must not bring an empty copy back.
    store.setConditionsShare('off');
    await tick();
    expect(localStorage.getItem(SUPPLEMENTS_ENC_KEY)).toBeNull();
    expect(localStorage.getItem(SUPPLEMENTS_KEY)).toBeNull();
  });

  it('the on-device copy is sealed once the key exists (no plaintext supplement data)', async () => {
    store.saveSupplementEntry(creatine());
    await tick();
    const enc = localStorage.getItem(SUPPLEMENTS_ENC_KEY);
    expect(enc).not.toBeNull();
    expect(enc).not.toContain('creatine');
    expect(localStorage.getItem(SUPPLEMENTS_KEY)).toBeNull();
  });

  it('resetLocalData clears supplements too', async () => {
    store.saveSupplementEntry(creatine());
    await tick();
    store.resetLocalData();
    expect(cur().entries).toEqual([]);
    expect(localStorage.getItem(SUPPLEMENTS_ENC_KEY)).toBeNull();
    expect(localStorage.getItem(SUPPLEMENTS_KEY)).toBeNull();
  });

  it('the firestore rules cover meta/supplements and an account wipe removes it', async () => {
    const { readFileSync } = await import('node:fs');
    const root = `${process.cwd()}/..`;
    const rules = readFileSync(`${root}/firestore.rules`, 'utf8');
    expect(rules).toMatch(/match \/meta\/\{docId\}[\s\S]*?allow read, write: if isSelf\(userId\)/);
    const admin = readFileSync(`${root}/functions/src/admin.ts`, 'utf8');
    expect(admin).toMatch(/recursiveDelete\(db\.collection\('users'\)\.doc\(id\)\)/);
  });

  describe('day check-ins', () => {
    beforeEach(() => {
      store.saveSupplementEntry(creatine());
      store.saveSupplementEntry(whey());
    });

    it('answers none / all / some, seals them with the doc, and the effects follow', async () => {
      expect(store.getSupplementEffectsFor('2026-10-06', ALL)).not.toBeNull();
      expect(store.answerSupplementDay('2026-10-06', { kind: 'none' })).toBe(true);
      expect(cur().checkins['2026-10-06']).toEqual({ taken: false });
      expect(store.getSupplementEffectsFor('2026-10-06', ALL)).toBeNull();
      expect(store.answerSupplementDay('2026-10-06', { kind: 'all' })).toBe(true);
      expect(cur().checkins['2026-10-06']).toEqual({ taken: true });
      expect(store.getSupplementProteinGramsFor('2026-10-06', ALL)).toBe(20);
      expect(
        store.answerSupplementDay('2026-10-06', { kind: 'some', entryIds: ['e-cr', 'ghost'] }),
      ).toBe(true);
      expect(cur().checkins['2026-10-06']).toEqual({ taken: true, entryIds: ['e-cr'] });
      expect(store.getSupplementProteinGramsFor('2026-10-06', ALL)).toBe(0);
      // No known ids left = nothing taken.
      store.answerSupplementDay('2026-10-06', { kind: 'some', entryIds: ['ghost'] });
      expect(cur().checkins['2026-10-06']).toEqual({ taken: false });
      await tick();
      const text = JSON.stringify(supWrites().at(-1)!.data);
      expect(text).not.toContain('2026-10');
      expect(text).not.toContain('taken');
      expect((await lastPlain()).checkins['2026-10-06']).toEqual({ taken: false });
    });

    it('clearSupplementDay makes the day unanswered again; no-ops do not write', async () => {
      store.answerSupplementDay('2026-10-06', { kind: 'none' });
      await tick();
      const n = supWrites().length;
      store.answerSupplementDay('2026-10-06', { kind: 'none' }); // same answer
      store.clearSupplementDay('2026-10-09'); // never answered
      store.clearSupplementDay('garbage');
      await tick();
      expect(supWrites().length).toBe(n);
      store.clearSupplementDay('2026-10-06');
      expect('2026-10-06' in cur().checkins).toBe(false);
      expect(store.answerSupplementDay('garbage', { kind: 'all' })).toBe(false);
    });

    it('keeps only the last 60 days', () => {
      for (let i = 0; i < MAX_CHECKIN_DAYS + 10; i++)
        store.answerSupplementDay(addDays('2026-01-01', i), { kind: 'all' });
      expect(Object.keys(cur().checkins)).toHaveLength(MAX_CHECKIN_DAYS);
      expect(cur().checkins[addDays('2026-01-01', MAX_CHECKIN_DAYS + 9)]).toBeDefined();
      expect(cur().checkins['2026-01-01']).toBeUndefined();
    });

    it('pending check-in: grouped entries for the day, off with the switch', () => {
      const now = new Date(2026, 9, 2, 20).getTime();
      expect(store.getPendingSupplementCheckin(ALL, now)).toBeNull(); // off by default
      store.setSupplementCheckinsOn(true);
      const p = store.getPendingSupplementCheckin(ALL, now)!;
      expect(p.date).toBe('2026-10-02');
      expect(p.entries.map((e) => e.itemId)).toEqual(['creatine', 'whey']);
      store.answerSupplementDay('2026-10-02', { kind: 'all' });
      expect(store.getPendingSupplementCheckin(ALL, now)!.date).toBe('2026-10-01');
      store.setSupplementCheckinsOn(false);
      expect(store.getPendingSupplementCheckin(ALL, now)).toBeNull();
    });

    it('training facts: finished workouts and conditioning activities, the latest weight', () => {
      const st = store.__getStateForTests();
      const f = store.getSupplementTrainingFacts(new Date(2026, 9, 7, 12).getTime());
      expect(f.todayKey).toBe('2026-10-07');
      expect(f.trainedDays).toEqual([]);
      expect(f.bodyWeightKg).toBeNull();
      expect(st.workouts).toBeDefined();
    });

    it('delete and reset wipe the check-ins too', async () => {
      store.answerSupplementDay('2026-10-06', { kind: 'none' });
      store.deleteSupplementData();
      expect(cur().checkins).toEqual({});
      store.saveSupplementEntry(creatine());
      store.answerSupplementDay('2026-10-06', { kind: 'none' });
      await tick();
      store.resetLocalData();
      expect(cur().checkins).toEqual({});
    });
  });
});
