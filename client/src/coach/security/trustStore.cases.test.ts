/**
 * What a device remembers about a trainer's security code: the pure reducer and the sealed/in-memory stores. The sealed
 * store runs over the real sealedLocal on an in-memory backend: the record is encrypted at rest, never plaintext.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSealedLocal,
  memoryBackend,
  configureSealedLocal,
  type SealedLocal,
} from '../../offline/sealedLocal';
import { readyVault } from '../../testVault';
import {
  acknowledge,
  configureTrustStore,
  createMemoryTrustStore,
  createSealedTrustStore,
  isVerified,
  observe,
  trustStore,
  unverify,
  verify,
  type TrustRecord,
} from './trustStore';

const rec = (over: Partial<TrustRecord> = {}): TrustRecord => ({
  seen: '1111',
  verified: null,
  pending: false,
  ...over,
});

describe('trust reducer', () => {
  it('the first code is just remembered, the same code again changes nothing, a different one raises pending', () => {
    const first = observe(null, 'AAA');
    expect(first).toEqual({ rec: { seen: 'AAA', verified: null, pending: false }, changed: false });
    const again = observe(first.rec, 'AAA');
    expect(again.changed).toBe(false);
    expect(again.rec).toBe(first.rec);
    const next = observe(first.rec, 'BBB');
    expect(next).toEqual({ rec: { seen: 'BBB', verified: null, pending: true }, changed: true });
  });

  it('verified means THIS code: a later code makes the person unverified again', () => {
    const v = verify(rec({ seen: 'AAA', pending: true }));
    expect(v).toEqual({ seen: 'AAA', verified: 'AAA', pending: false });
    expect(isVerified(v)).toBe(true);
    const changed = observe(v, 'BBB').rec;
    expect(changed.verified).toBe('AAA');
    expect(isVerified(changed)).toBe(false);
    expect(isVerified(null)).toBe(false);
  });

  it('unverify keeps the seen code and the pending flag; acknowledge only clears pending', () => {
    const r = rec({ seen: 'X', verified: 'X', pending: true });
    expect(unverify(r)).toEqual({ seen: 'X', verified: null, pending: true });
    expect(acknowledge(r)).toEqual({ seen: 'X', verified: 'X', pending: false });
  });
});

describe('memory trust store', () => {
  it('saves, loads and forgets per conversation', async () => {
    const s = createMemoryTrustStore();
    expect(await s.load('c1')).toBeNull();
    await s.save('c1', rec());
    await s.save('c2', rec({ seen: '2222' }));
    expect((await s.load('c1'))?.seen).toBe('1111');
    await s.forget('c1');
    expect(await s.load('c1')).toBeNull();
    expect((await s.load('c2'))?.seen).toBe('2222');
  });
});

describe('sealed trust store', () => {
  let backend: ReturnType<typeof memoryBackend>;
  let local: SealedLocal;
  beforeEach(async () => {
    backend = memoryBackend();
    local = createSealedLocal({ vault: await readyVault(), backend });
  });

  it('the record is stored encrypted under trust:<cid> and read back', async () => {
    const s = createSealedTrustStore(async () => local);
    await s.save('cid-1', rec({ seen: 'SECRETCODE-9921', verified: 'SECRETCODE-9921' }));
    expect(await backend.keys()).toEqual(['trust:cid-1']);
    expect(JSON.stringify(await backend.get('trust:cid-1'))).not.toContain('SECRETCODE-9921');
    // a fresh store (another page load) reads it from the sealed copy
    const again = createSealedTrustStore(async () => local);
    expect(await again.load('cid-1')).toEqual({
      seen: 'SECRETCODE-9921',
      verified: 'SECRETCODE-9921',
      pending: false,
    });
  });

  it('a malformed stored value is ignored (memory answers instead)', async () => {
    await local.set('trust:cid-bad', { seen: 5, pending: 'yes', verified: null });
    await local.set('trust:cid-bad2', { seen: 'x', pending: false, verified: 7 });
    await local.set('trust:cid-null', null);
    const s = createSealedTrustStore(async () => local);
    expect(await s.load('cid-bad')).toBeNull();
    expect(await s.load('cid-bad2')).toBeNull();
    expect(await s.load('cid-null')).toBeNull();
  });

  it('forget removes the sealed copy and the memory copy', async () => {
    const s = createSealedTrustStore(async () => local);
    await s.save('cid-1', rec());
    await s.forget('cid-1');
    expect(await backend.keys()).toEqual([]);
    expect(await s.load('cid-1')).toBeNull();
  });

  it('a locked vault (store refuses writes) keeps the record in memory only; nothing is written', async () => {
    const locked = {
      ...local,
      set: async () => false,
      get: async () => null,
    } as unknown as SealedLocal;
    const s = createSealedTrustStore(async () => locked);
    await s.save('cid-1', rec({ seen: 'ZZZ' }));
    expect(await backend.keys()).toEqual([]);
    expect((await s.load('cid-1'))?.seen).toBe('ZZZ');
  });

  it('a sealed store that throws (no storage) falls back to memory for load, save and forget', async () => {
    const boom = async () => {
      throw new Error('no idb');
    };
    const s = createSealedTrustStore(boom as never);
    await s.save('cid-1', rec({ seen: 'M' }));
    expect((await s.load('cid-1'))?.seen).toBe('M');
    await expect(s.forget('cid-1')).resolves.toBeUndefined();
    expect(await s.load('cid-1')).toBeNull();
  });
});

describe('app trust store', () => {
  afterEach(() => {
    configureTrustStore(null);
    configureSealedLocal(null);
    vi.unstubAllGlobals();
  });

  it('a configured store wins and is returned as is', () => {
    const mine = createMemoryTrustStore();
    configureTrustStore(mine);
    expect(trustStore()).toBe(mine);
  });

  it('without IndexedDB or a sealed store it is memory only, and the choice is cached', async () => {
    configureTrustStore(null);
    configureSealedLocal(null);
    vi.stubGlobal('indexedDB', undefined);
    const a = trustStore();
    expect(trustStore()).toBe(a);
    await a.save('c', rec());
    expect((await a.load('c'))?.seen).toBe('1111');
  });

  it('with a sealed store configured it seals the record on the device', async () => {
    const backend = memoryBackend();
    configureSealedLocal(createSealedLocal({ vault: await readyVault(), backend }));
    configureTrustStore(null);
    vi.stubGlobal('indexedDB', undefined);
    await trustStore().save('cid-9', rec());
    expect(await backend.keys()).toEqual(['trust:cid-9']);
  });
});
