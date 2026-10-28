import { beforeEach, describe, expect, it, vi } from 'vitest';

/** SPO-388: widget values reach the account: the goal in meta/prefs, the person's numbers sealed. */
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

import './store';
import { isSealed, unsealDoc } from './encryptedDoc';
import { vault } from './vaultIO';
import { emitTwEdit, stampTw } from './today/widgetSync';

const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const stub = vault as unknown as import('./autoVault').Vault;

describe('widget values reach the account (SPO-388)', () => {
  beforeEach(() => {
    fs.writes.length = 0;
    localStorage.clear();
  });

  it('the weekly goal is a field of meta/prefs with its own stamp', async () => {
    emitTwEdit('weekly-goal', 5, 1234);
    await settle();
    const w = fs.writes.find((x) => x.path === 'users/u1/meta/prefs');
    expect(w?.data).toEqual({ weeklyGoal: 5, weeklyGoalUpdatedAt: 1234 });
  });

  it('left/right results go only into the sealed document', async () => {
    const tests = [{ name: 'Row', l: 30, r: 28, at: 5 }];
    localStorage.setItem('spotter.tw.lr-balance', JSON.stringify(tests));
    stampTw('lr-balance', 777);
    emitTwEdit('lr-balance', tests, 777);
    await settle();
    expect(fs.writes.some((x) => x.path === 'users/u1/meta/prefs')).toBe(false);
    const w = fs.writes.find((x) => x.path === 'users/u1/meta/widgetData');
    expect(w).toBeTruthy();
    expect(isSealed(w!.data)).toBe(true);
    expect(Object.keys(w!.data).sort()).toEqual(['enc', 'updatedAt']);
    const body = await unsealDoc<{ values: Record<string, unknown>; at: Record<string, number> }>(
      w!.data,
      stub.material().key,
    );
    expect(body.values['lr-balance']).toEqual(tests);
    expect(body.at['lr-balance']).toBe(777);
  });

  it('a widget that is not synced writes nothing', async () => {
    emitTwEdit('rest-timer', { a: 1 }, 1);
    await settle();
    expect(fs.writes).toEqual([]);
  });
});
