import { beforeEach, describe, expect, it, vi } from 'vitest';

/** SPO-397: the sleep schedule and the sleep switches go to the account as one sealed document. */
const fs = vi.hoisted(() => ({
  writes: [] as { path: string; data: Record<string, unknown> }[],
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
    deleteDoc: vi.fn(async () => undefined),
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
    prepareWrite: async (c: never, d: never) => real.prepareWrite(c, d, v),
    mirrorCollection: (apply: never) => real.mirrorCollection(apply, v),
  };
});

import * as store from './store';
import { isSealed, unsealDoc } from './encryptedDoc';
import { vault } from './vaultIO';

const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const stub = vault as unknown as import('./autoVault').Vault;
const prefWrites = () => fs.writes.filter((x) => x.path === 'users/u1/meta/sleepPrefs');

describe('sleep schedule and switches reach the account (SPO-397)', () => {
  beforeEach(() => {
    fs.writes.length = 0;
  });

  it('a schedule change is written sealed, with only the stamp open', async () => {
    store.setSleepSchedule({
      sameEveryNight: true,
      every: { bedMin: 1380, wakeMin: 420 },
      byDay: {},
    });
    await settle();
    const w = prefWrites().at(-1);
    expect(w).toBeTruthy();
    expect(isSealed(w!.data)).toBe(true);
    expect(typeof w!.data.updatedAt).toBe('number');
    expect(Object.keys(w!.data).sort()).toEqual(['enc', 'updatedAt']);
    const body = await unsealDoc<
      Record<string, unknown> & { schedule: { every: unknown }; settings: unknown }
    >(w!.data, stub.material().key);
    expect(body.schedule.every).toEqual({ bedMin: 1380, wakeMin: 420 });
  });

  it('a switch or goal change is written; the night bookkeeping never is', async () => {
    store.setSleepSettings({ autoDim: true, goalMin: 420 });
    await settle();
    const n = prefWrites().length;
    expect(n).toBeGreaterThanOrEqual(1);
    const body = await unsealDoc<
      Record<string, unknown> & { schedule: { every: unknown }; settings: unknown }
    >(prefWrites().at(-1)!.data, stub.material().key);
    expect(body.settings).toEqual({ autoDim: true, autoLog: false, goalMin: 420 });
    expect(JSON.stringify(body)).not.toMatch(/lastDimDay|lastAutoNight|skippedAutoSleepDates/);
    // bookkeeping only: no account write
    store.setSleepSettings({ lastDimDay: '2026-10-30' });
    await settle();
    expect(prefWrites().length).toBe(n);
  });
});
