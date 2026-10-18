import { describe, expect, it } from 'vitest';
import { CYCLE_ENC_KEY, CYCLE_KEY, createCycleCache } from './cycleCache';
import { emptyCycleState, type CycleState } from './cycle/cycleState';
import { b64, decryptJson, encryptJson, importRawKey } from './vaultCrypto';

const rnd = (n: number) => b64(globalThis.crypto.getRandomValues(new Uint8Array(n)));
const material = async () => ({ key: await importRawKey(rnd(32), false), salt: rnd(16) });

const mem = () => {
  const m = new Map<string, string>();
  const writes: string[] = [];
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      writes.push(k);
      m.set(k, v);
    },
    removeItem: (k: string) => void m.delete(k),
    m,
    writes,
  };
};
const state = (updatedAt: number, anchor = 100): CycleState => ({
  ...emptyCycleState(),
  enabled: true,
  settings: { mode: 'regular', length: 28, period: 5, anchor },
  updatedAt,
});
const flush = () => new Promise((r) => setTimeout(r, 20));

type Mat = Awaited<ReturnType<typeof material>> | null;
const make = (st: ReturnType<typeof mem>, mat: Mat = null) => {
  let m = mat;
  const cache = createCycleCache({ vault: { materialOrNull: () => m }, storage: () => st });
  return { cache, setMat: (x: Mat) => (m = x) };
};

describe('load', () => {
  it('returns an empty document for nothing, corrupt JSON or a throwing storage', () => {
    const st = mem();
    expect(make(st).cache.load()).toEqual(emptyCycleState());
    st.setItem(CYCLE_KEY, '{not json');
    expect(make(st).cache.load()).toEqual(emptyCycleState());
    const boom = createCycleCache({
      vault: { materialOrNull: () => null },
      storage: () => {
        throw new Error('denied');
      },
    });
    expect(boom.load()).toEqual(emptyCycleState());
  });

  it('normalises the stored plaintext (clamps out-of-range values)', () => {
    const st = mem();
    st.setItem(
      CYCLE_KEY,
      JSON.stringify({
        enabled: true,
        settings: { mode: 'regular', length: 999, period: 5, anchor: 3.6 },
      }),
    );
    expect(make(st).cache.load().settings).toMatchObject({ length: 60, anchor: 4 });
  });
});

describe('persist without a key', () => {
  it('writes plaintext when nothing is sealed', () => {
    const st = mem();
    make(st).cache.persist(state(5));
    expect(JSON.parse(st.getItem(CYCLE_KEY)!).updatedAt).toBe(5);
  });

  it('leaves the plaintext alone while a sealed copy exists and the user changed nothing since boot', () => {
    const st = mem();
    st.setItem(CYCLE_ENC_KEY, '{"sealed":1}');
    const { cache } = make(st);
    const boot = state(5);
    cache.boot(boot);
    cache.persist(boot);
    expect(st.getItem(CYCLE_KEY)).toBeNull();
    cache.persist(state(6, 111)); // the user edited meanwhile -> kept in plaintext
    expect(JSON.parse(st.getItem(CYCLE_KEY)!).settings.anchor).toBe(111);
    expect(st.getItem(CYCLE_ENC_KEY)).toBe('{"sealed":1}'); // the sealed copy is never dropped
  });

  it('survives a storage that refuses writes', () => {
    const cache = createCycleCache({
      vault: { materialOrNull: () => null },
      storage: () => ({
        getItem: () => null,
        setItem: () => {
          throw new Error('quota');
        },
        removeItem: () => undefined,
      }),
    });
    expect(() => cache.persist(state(5))).not.toThrow();
  });

  it('does nothing when the state was never saved', () => {
    const st = mem();
    make(st).cache.persist(emptyCycleState());
    expect(st.writes).toEqual([]);
  });
});

describe('persist with a key', () => {
  it('seals the document, removes the plaintext fallback and never stores readable data', async () => {
    const st = mem();
    const mat = await material();
    st.setItem(CYCLE_KEY, 'old-plain');
    const { cache } = make(st, mat);
    cache.persist(state(5, 4242));
    await flush();
    const raw = st.getItem(CYCLE_ENC_KEY)!;
    expect(raw).not.toContain('4242');
    expect(st.getItem(CYCLE_KEY)).toBeNull();
    const back = await decryptJson<CycleState & { v: number }>(mat.key, JSON.parse(raw));
    expect(back).toMatchObject({ v: 1, updatedAt: 5, settings: { anchor: 4242 } });
  });

  it('does not reseal an unchanged document', async () => {
    const st = mem();
    const { cache } = make(st, await material());
    cache.persist(state(5));
    await flush();
    cache.persist(state(5));
    await flush();
    expect(st.writes.filter((k) => k === CYCLE_ENC_KEY)).toHaveLength(1);
  });

  it('a slower, older seal never overwrites a newer one', async () => {
    const st = mem();
    const mat = await material();
    const { cache } = make(st, mat);
    cache.persist(state(5, 1));
    cache.persist(state(6, 2));
    await flush();
    const back = await decryptJson<CycleState>(mat.key, JSON.parse(st.getItem(CYCLE_ENC_KEY)!));
    expect(back.updatedAt).toBe(6);
    expect(st.writes.filter((k) => k === CYCLE_ENC_KEY)).toHaveLength(1);
  });

  it('falls back to plaintext when sealing fails, so nothing is lost', async () => {
    const st = mem();
    const { cache } = make(st, { key: {} as CryptoKey, salt: 'x' });
    cache.persist(state(5, 77));
    await flush();
    expect(JSON.parse(st.getItem(CYCLE_KEY)!).settings.anchor).toBe(77);
    expect(st.getItem(CYCLE_ENC_KEY)).toBeNull();
  });

  it('writes nothing and does not throw when the storage is unavailable', async () => {
    const cache = createCycleCache({
      vault: { materialOrNull: () => null },
      storage: () => {
        throw new Error('denied');
      },
    });
    expect(() => cache.persist(state(5))).not.toThrow();
    const mat = await material();
    const c2 = createCycleCache({
      vault: { materialOrNull: () => mat },
      storage: () => {
        throw new Error('denied');
      },
    });
    expect(() => c2.persist(state(5))).not.toThrow();
    await flush();
  });

  it('clear() during an in-flight seal discards its result', async () => {
    const st = mem();
    const { cache } = make(st, await material());
    cache.persist(state(5));
    cache.clear();
    await flush();
    expect(st.m.size).toBe(0);
  });
});

describe('hydrate', () => {
  const sealed = async (st: ReturnType<typeof mem>, mat: NonNullable<Mat>, s: CycleState) =>
    st.setItem(CYCLE_ENC_KEY, JSON.stringify(await encryptJson(mat.key, mat.salt, { v: 1, ...s })));

  it('returns null while the vault is locked', async () => {
    expect(await make(mem()).cache.hydrate(state(5))).toBeNull();
  });

  it('takes the sealed copy when it is newer and re-seals, dropping the plaintext', async () => {
    const st = mem();
    const mat = await material();
    await sealed(st, mat, state(9, 500));
    st.setItem(CYCLE_KEY, 'plain');
    const { cache } = make(st, mat);
    const r = await cache.hydrate(state(5, 100));
    expect(r).toMatchObject({ updatedAt: 9, settings: { anchor: 500 } });
    await flush();
    expect(st.getItem(CYCLE_KEY)).toBeNull();
  });

  it('keeps current when the sealed copy is older or equally old (null = nothing to change)', async () => {
    const st = mem();
    const mat = await material();
    await sealed(st, mat, state(5, 500));
    const { cache } = make(st, mat);
    expect(await cache.hydrate(state(5, 100))).toBeNull();
    expect(await cache.hydrate(state(7, 100))).toBeNull();
  });

  it('a Firestore answer that already arrived wins over a newer on-device copy', async () => {
    const st = mem();
    const mat = await material();
    await sealed(st, mat, state(99, 500));
    const { cache } = make(st, mat);
    cache.markRemote();
    expect(await cache.hydrate(state(5, 100))).toBeNull();
  });

  it('survives a corrupt or foreign-key sealed copy and still seals current', async () => {
    const st = mem();
    const mat = await material();
    st.setItem(CYCLE_ENC_KEY, 'not json');
    expect(await make(st, mat).cache.hydrate(state(5))).toBeNull();
    const other = await material();
    await sealed(st, other, state(50));
    expect(await make(st, mat).cache.hydrate(state(5))).toBeNull(); // wrong key: decrypt throws
    st.setItem(CYCLE_ENC_KEY, JSON.stringify({ foo: 1 })); // not an envelope
    expect(await make(st, mat).cache.hydrate(state(5))).toBeNull();
    await flush();
    const back = await decryptJson<CycleState>(mat.key, JSON.parse(st.getItem(CYCLE_ENC_KEY)!));
    expect(back.updatedAt).toBe(5);
  });

  it('after hydrate without a key later on, the plaintext is no longer written over the sealed copy', async () => {
    const st = mem();
    const mat = await material();
    await sealed(st, mat, state(5));
    const h = make(st, mat);
    await h.cache.hydrate(state(5));
    await flush();
    h.setMat(null); // key gone (sign-out race)
    h.cache.persist(state(6, 321));
    expect(st.getItem(CYCLE_KEY)).toBeNull();
  });
});

describe('clear', () => {
  it('removes both copies and resets hydrate/remote/boot bookkeeping', async () => {
    const st = mem();
    const mat = await material();
    const h = make(st, mat);
    h.cache.boot(state(5));
    h.cache.markRemote();
    await h.cache.hydrate(state(5));
    await flush();
    h.cache.clear();
    expect(st.m.size).toBe(0);
    // markRemote forgotten: a newer sealed copy is taken again
    await st.setItem(
      CYCLE_ENC_KEY,
      JSON.stringify(await encryptJson(mat.key, mat.salt, { v: 1, ...state(9, 600) })),
    );
    expect(await h.cache.hydrate(state(5))).toMatchObject({ updatedAt: 9 });
    // no stale "sealed at boot": plaintext writes work again without a key
    h.cache.clear();
    h.setMat(null);
    h.cache.persist(state(10, 700));
    expect(JSON.parse(st.getItem(CYCLE_KEY)!).settings.anchor).toBe(700);
  });

  it('does not throw when the storage throws', () => {
    const cache = createCycleCache({
      vault: { materialOrNull: () => null },
      storage: () => {
        throw new Error('denied');
      },
    });
    expect(() => cache.clear()).not.toThrow();
  });
});
