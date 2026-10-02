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
import { isSealed, unsealDoc } from './encryptedDoc';
import { newAlcoholEntry } from './alcohol';
import type { CoachView } from './conditions';

const tick = () => new Promise((r) => setTimeout(r, 30));
const PATH = 'users/u1/meta/coachShare';
const stub = vault as unknown as import('./autoVault').Vault;
const shareWrites = () => fs.writes.filter((w) => w.path === PATH);
async function lastView(): Promise<CoachView> {
  const w = shareWrites().at(-1)!;
  expect(isSealed(w.data)).toBe(true);
  const plain = await unsealDoc<{ view: CoachView }>(w.data, stub.material().key);
  return plain.view;
}

describe('alcohol in the sealed coach share', () => {
  let stop: () => void;
  beforeEach(async () => {
    localStorage?.clear?.();
    fs.writes.length = 0;
    fs.docs.clear();
    fs.listeners.clear();
    store.deleteAlcoholData();
    store.setAlcoholSharing('off');
    stop = store.startSyncLoop();
    await tick();
    store.saveAlcoholEntry({ ...newAlcoholEntry('spWhisky', 'e-w', 40), servingsPerWeek: 10 });
    // The placeholder coefficients are experimental (off by default): switch the numbers on.
    store.setAlcoholSurface('readiness', true);
    store.setAlcoholSurface('sleep', true);
    await tick();
    fs.writes.length = 0;
  });
  afterEach(() => {
    stop();
    store.deleteAlcoholData();
  });

  it('Off (the default) never carries alcohol, whatever the entries do', async () => {
    store.saveAlcoholEntry({ ...newAlcoholEntry('spWhisky', 'e-w', 40), servingsPerWeek: 20 });
    store.setAlcoholUseInCalculations(false);
    await tick();
    for (const w of shareWrites()) {
      const plain = await unsealDoc<{ view: CoachView }>(w.data, stub.material().key);
      expect(plain.view.alcohol).toBeUndefined();
    }
  });

  it('Effects publishes only the effect ranges: no grams, no drink names, no weekdays; sealed on the wire', async () => {
    store.setAlcoholUsualDays([4, 5]);
    store.setAlcoholSharing('effects');
    await tick();
    const v = await lastView();
    expect(v.alcohol!.mode).toBe('effects');
    expect(v.alcohol!.effects.map((e) => e.key).sort()).toEqual(['readiness', 'sleepMin']);
    expect(JSON.stringify(v.alcohol)).not.toMatch(
      /whisky|spWhisky|gram|servings|entries|usualDays|itemId|abv|mgPerDay/i,
    );
    for (const w of shareWrites()) expect(JSON.stringify(w.data)).not.toMatch(/whisky|alcohol/i);
  });

  it('an entry change republishes; going back to Off or deleting the data removes it', async () => {
    store.setAlcoholSharing('effects');
    await tick();
    const before = (await lastView()).alcohol!.effects.find((e) => e.key === 'readiness')!;
    store.saveAlcoholEntry({ ...newAlcoholEntry('spWhisky', 'e-w', 40), servingsPerWeek: 40 });
    await tick();
    const after = (await lastView()).alcohol!.effects.find((e) => e.key === 'readiness')!;
    expect(after.high).toBeLessThan(before.high);
    store.setAlcoholSharing('off');
    await tick();
    expect((await lastView()).alcohol).toBeUndefined();
    store.setAlcoholSharing('effects');
    await tick();
    store.deleteAlcoholData();
    await tick();
    expect((await lastView()).alcohol).toBeUndefined();
  });

  it('check-ins never reach the coach: no days, no answers, no amounts', async () => {
    store.setAlcoholUsualDays([4]);
    store.setAlcoholSharing('effects');
    store.answerAlcoholDay('2026-10-02', { kind: 'custom', grams: 77 });
    await tick();
    const v = await lastView();
    expect(v.alcohol!.mode).toBe('effects');
    expect(JSON.stringify(v.alcohol)).not.toMatch(/checkin|drank|2026-10|77|usualDays|grams/i);
    for (const w of shareWrites()) expect(JSON.stringify(w.data)).not.toMatch(/2026-10|drank/);
  });
});
