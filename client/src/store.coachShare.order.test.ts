import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** B3: coach-view publishes are serialised (an older one never overwrites a newer one) and a failed write is retried. */
const fs = vi.hoisted(() => ({
  writes: [] as { path: string; data: Record<string, unknown> }[],
  deletes: [] as string[],
  delays: [] as number[], // sealing latency of the next coachShare writes, in order
  failNext: 0,
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
      if (r.path.endsWith('/coachShare') && fs.failNext > 0) {
        fs.failNext--;
        throw Object.assign(new Error('offline'), { code: 'unavailable' });
      }
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
    prepareWrite: async (c: never, d: never) => {
      const ms = (c as string) === 'coachShare' ? fs.delays.shift() : undefined;
      if (ms) await new Promise((r) => setTimeout(r, ms));
      return real.prepareWrite(c, d, v);
    },
    mirrorCollection: (apply: never) => real.mirrorCollection(apply, v),
  };
});

import * as store from './store';
import { newNicotineProduct } from './nicotine';
import { resetHealthGateForTests } from './data/healthConsentGate';
import { isSealed, unsealDoc } from './encryptedDoc';
import { vault } from './vaultIO';
import type { CoachView } from './conditions';

const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const stub = vault as unknown as import('./autoVault').Vault;
const shareWrites = () => fs.writes.filter((x) => x.path === 'users/u1/meta/coachShare');
async function view(w: { data: Record<string, unknown> }): Promise<CoachView> {
  expect(isSealed(w.data)).toBe(true);
  return (await unsealDoc<{ view: CoachView }>(w.data, stub.material().key)).view;
}

describe('coach view publishing order (B3)', () => {
  let stop: () => void;
  beforeEach(async () => {
    localStorage?.clear?.();
    resetHealthGateForTests(true);
    store.setNicotineSharing('off');
    stop = store.startSyncLoop();
    store.saveNicotineProduct(newNicotineProduct('vape', 'p1'));
    await settle();
    await store.whenCoachSharePublished();
    fs.writes.length = 0;
    fs.delays.length = 0;
    fs.failNext = 0;
  });
  afterEach(() => {
    stop();
    store.setNicotineSharing('off');
  });

  it('a slow older publish can never overwrite a newer one, and Stop can await the final one', async () => {
    fs.delays.push(250); // the "shared" view seals slowly ...
    store.setNicotineSharing('effects');
    store.setNicotineSharing('off'); // ... and the person switches it off right away (fast)
    await store.whenCoachSharePublished();
    const last = shareWrites().at(-1)!;
    expect((await view(last)).nicotine).toBeUndefined();
    await settle(400);
    // nothing arrives later: the final write is still the Off view
    expect((await view(shareWrites().at(-1)!)).nicotine).toBeUndefined();
  });

  it('a rejected write is retried with backoff until it lands', async () => {
    fs.failNext = 1;
    store.setNicotineSharing('effects');
    await store.whenCoachSharePublished();
    await settle(100);
    expect(shareWrites()).toHaveLength(0);
    await settle(2200); // first backoff step is 2 s
    const w = shareWrites();
    expect(w).toHaveLength(1);
    expect((await view(w[0])).nicotine).toBeDefined();
  }, 10_000);
});
