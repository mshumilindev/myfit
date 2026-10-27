// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { createSealedState, mergeById, mergeSingleton, sealedKeyOf } from './sealedState';
import { readyVault, unsetVault } from './testVault';
import type { Vault } from './autoVault';

type W = { id: string; name: string };
const KEY = 'spotter.state';
const secret: W = { id: 'a', name: 'Bench secret' };

let data: Map<string, string>;
const storage = () => ({
  getItem: (k: string) => data.get(k) ?? null,
  setItem: (k: string, v: string) => void data.set(k, v),
  removeItem: (k: string) => void data.delete(k),
});
const make = (vault: Pick<Vault, 'materialOrNull'>) =>
  createSealedState({ vault, storage }).field<W[]>({
    key: KEY,
    merge: (cur, stored, ctx) => mergeById(cur, stored, ctx),
  });
const plaintextAnywhere = (needle: string) => [...data.values()].some((v) => v.includes(needle));

beforeEach(() => {
  data = new Map();
});

describe('sealed on-device state (SPO-216)', () => {
  it('with a key: sealed at rest, no plaintext, hydrated on the next start', async () => {
    const v = await readyVault();
    const f1 = make(v);
    f1.boot([]);
    f1.persist([secret]);
    await f1.flush();
    expect(data.has(sealedKeyOf(KEY))).toBe(true);
    expect(data.has(KEY)).toBe(false);
    expect(plaintextAnywhere('Bench secret')).toBe(false);

    const f2 = make(v);
    f2.boot([]);
    expect(await f2.hydrate([])).toEqual([secret]);
  });

  it('without a key writes NOTHING (no plaintext fallback)', async () => {
    const f = make(await unsetVault());
    f.boot([]);
    f.persist([secret]);
    await f.flush();
    expect(data.size).toBe(0);
  });

  it('migrates a legacy plaintext key once: sealed first, then removed; second run is a no-op', async () => {
    const v = await readyVault();
    data.set(KEY, JSON.stringify([secret]));
    const f = make(v);
    const boot = f.load([]);
    expect(boot).toEqual([secret]); // still readable at boot
    f.boot(boot);
    expect(await f.hydrate(boot)).toBeNull();
    await f.flush();
    expect(data.has(KEY)).toBe(false);
    expect(plaintextAnywhere('Bench secret')).toBe(false);
    const f2 = make(v);
    f2.boot([]);
    expect(await f2.hydrate([])).toEqual([secret]);
    await f2.flush();
    expect(data.has(KEY)).toBe(false);
  });

  it('keeps the legacy plaintext while there is no key (nothing lost, nothing new written)', async () => {
    data.set(KEY, JSON.stringify([secret]));
    const f = make(await unsetVault());
    const boot = f.load([]);
    f.boot(boot);
    f.persist([...boot, { id: 'b', name: 'New one' }]);
    await f.flush();
    expect(data.get(KEY)).toBe(JSON.stringify([secret]));
    expect(data.has(sealedKeyOf(KEY))).toBe(false);
  });

  it('does not overwrite an unmerged sealed copy with the empty boot state', async () => {
    const v = await readyVault();
    const f1 = make(v);
    f1.boot([]);
    f1.persist([secret]);
    await f1.flush();
    const before = data.get(sealedKeyOf(KEY));

    const f2 = make(v);
    f2.boot([]);
    f2.persist([]); // key present, sealed copy not merged yet
    await f2.flush();
    expect(data.get(sealedKeyOf(KEY))).toBe(before);
    expect(await f2.hydrate([])).toEqual([secret]);
  });

  it('a Firestore answer that arrived first wins: a deleted item is not brought back', async () => {
    const v = await readyVault();
    const f1 = make(v);
    f1.boot([]);
    f1.persist([secret, { id: 'b', name: 'Other' }]);
    await f1.flush();

    const f2 = make(v);
    f2.boot([]);
    f2.markRemote();
    const current = [{ id: 'b', name: 'Other' }]; // `a` was deleted on another device
    expect(await f2.hydrate(current)).toBeNull();
    await f2.flush();
    const f3 = make(v);
    f3.boot([]);
    expect(await f3.hydrate([])).toEqual(current);
  });

  it('a sealed copy under another key is ignored, never throws', async () => {
    const f1 = make(await readyVault());
    f1.boot([]);
    f1.persist([secret]);
    await f1.flush();
    const f2 = make(await readyVault()); // another account's key
    f2.boot([]);
    expect(await f2.hydrate([])).toBeNull();
  });

  it('an older seal still in flight never lands after a newer value that equals the one already written', async () => {
    const v = await readyVault();
    const f = make(v);
    f.boot([]);
    f.persist([]); // written: []
    await f.flush();
    f.persist([secret]); // in flight ...
    f.persist([]); // ... and the person is back to [] before it finished
    await f.flush();
    const g = make(v);
    g.boot([]);
    expect(await g.hydrate([])).toBeNull(); // the sealed copy is [], not [secret]
  });

  it('clear removes both copies', async () => {
    const v = await readyVault();
    data.set(KEY, '[]');
    const f = make(v);
    f.boot([]);
    f.persist([secret]);
    await f.flush();
    f.clear();
    expect(data.size).toBe(0);
  });

  it('a quota failure keeps the legacy plaintext (data is never lost)', async () => {
    const v = await readyVault();
    data.set(KEY, JSON.stringify([secret]));
    const f = createSealedState({
      vault: v,
      storage: () => ({
        getItem: (k) => data.get(k) ?? null,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
        removeItem: (k) => void data.delete(k),
      }),
    }).field<W[]>({ key: KEY, merge: (c, s, x) => mergeById(c, s, x) });
    f.boot(f.load([]));
    f.persist([secret, { id: 'b', name: 'x' }]);
    await f.flush();
    expect(data.get(KEY)).toBe(JSON.stringify([secret]));
  });
});

describe('merge helpers', () => {
  it('mergeById: union, memory wins, remote wins outright', () => {
    const ctx = { remote: false, edited: false };
    expect(mergeById([{ id: 'a' }], [{ id: 'a', x: 1 }, { id: 'b' }], ctx)).toEqual([
      { id: 'a' },
      { id: 'b' },
    ]);
    expect(mergeById([], [{ id: 'b' }], { ...ctx, remote: true })).toEqual([]);
    expect(mergeById([{ id: 'a' }], 'junk', ctx)).toEqual([{ id: 'a' }]);
    expect(
      mergeById<{ id: string }>([], [{ id: 'z' }, { id: 'y' }], ctx, (x) => x.id !== 'z'),
    ).toEqual([{ id: 'y' }]);
  });
  it('mergeSingleton: stored when untouched, newer wins when edited, remote wins', () => {
    const cur = { updatedAt: 5, n: 1 };
    const sto = { updatedAt: 9, n: 2 };
    expect(mergeSingleton(cur, sto, { remote: false, edited: false })).toBe(sto);
    expect(mergeSingleton(sto, cur, { remote: false, edited: false })).toBe(sto); // legacy copy newer than the sealed one
    expect(mergeSingleton(cur, sto, { remote: false, edited: true })).toBe(sto);
    expect(mergeSingleton(sto, cur, { remote: false, edited: true })).toBe(sto);
    expect(mergeSingleton(cur, sto, { remote: true, edited: false })).toBe(cur);
    expect(mergeSingleton(cur, null, { remote: false, edited: false })).toBe(cur);
  });
});
