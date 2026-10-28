import { beforeEach, describe, expect, it, vi } from 'vitest';

/** SPO-391: started challenges reach the account as one sealed document. */
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
import { startChallenge, giveUpChallenge } from './challenges';

const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const stub = vault as unknown as import('./autoVault').Vault;
const writes = () => fs.writes.filter((x) => x.path === 'users/u1/meta/challenges');

describe('challenges reach the account (SPO-391)', () => {
  beforeEach(() => {
    fs.writes.length = 0;
  });

  it('starting and giving up a challenge writes the sealed document with only the stamp open', async () => {
    const ac = startChallenge('vol-1', 10, 7);
    await settle();
    const w = writes().at(-1);
    expect(w).toBeTruthy();
    expect(isSealed(w!.data)).toBe(true);
    expect(Object.keys(w!.data).sort()).toEqual(['enc', 'updatedAt']);
    const body = await unsealDoc<{ list: { id: string }[] }>(w!.data, stub.material().key);
    expect(body.list.map((c) => c.id)).toEqual([ac.id]);
    giveUpChallenge(ac.id);
    await settle();
    const last = await unsealDoc<{ list: unknown[] }>(writes().at(-1)!.data, stub.material().key);
    expect(last.list).toEqual([]);
  });
});
