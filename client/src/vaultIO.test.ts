// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('./firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), getDoc: vi.fn(), setDoc: vi.fn() }));

import { createVault, type VaultHeader, type VaultPorts } from './vault';
import { mirrorCollection, prepareWrite, readDocs } from './vaultIO';
import { isSealed } from './encryptedDoc';

function fresh() {
  let header: VaultHeader | null = null;
  let cached: { key: CryptoKey; salt: string } | null = null;
  const p: VaultPorts = {
    remote: { load: async () => header, save: async (h) => void (header = h) },
    cache: {
      get: async () => cached,
      set: async (v) => void (cached = v),
      clear: async () => void (cached = null),
    },
  };
  return { p, wipe: () => (cached = null) };
}

describe('prepareWrite', () => {
  it('is plaintext until the vault exists (feature off changes nothing)', async () => {
    const { p } = fresh();
    const v = createVault(p);
    await v.init();
    expect(await prepareWrite('injuries', { id: 'a', name: 'Knee' }, v)).toEqual({
      id: 'a',
      name: 'Knee',
    });
  });
  it('seals when ready', async () => {
    const { p } = fresh();
    const v = createVault(p);
    await v.init();
    await v.create();
    const out = await prepareWrite('injuries', { id: 'a', updatedAt: 1, name: 'Knee' }, v);
    expect(isSealed(out)).toBe(true);
    expect(JSON.stringify(out)).not.toContain('Knee');
  });
  it('refuses to downgrade while locked', async () => {
    const { p, wipe } = fresh();
    const a = createVault(p);
    await a.init();
    await a.create();
    wipe();
    const b = createVault(p);
    await b.init();
    await expect(prepareWrite('injuries', { id: 'a' }, b)).rejects.toThrow('vault-locked');
  });
});

describe('readDocs / mirrorCollection', () => {
  it('shows plaintext docs and skips sealed ones while locked, then reveals them on unlock', async () => {
    const { p, wipe } = fresh();
    const a = createVault(p);
    await a.init();
    const rk = await a.create();
    const sealed = await prepareWrite('injuries', { id: 's', updatedAt: 1, name: 'Hip' }, a);
    const legacy = { id: 'l', name: 'Shoulder' };
    wipe();
    const b = createVault(p);
    await b.init();

    const seen: { names: string[]; locked: number }[] = [];
    const m = mirrorCollection<{ id: string; name: string }>(
      (items, info) => seen.push({ names: items.map((i) => i.name), locked: info.locked }),
      b,
    );
    m.push([sealed, legacy]);
    await vi.waitFor(() => expect(seen.length).toBe(1));
    expect(seen[0]).toEqual({ names: ['Shoulder'], locked: 1 });

    await b.unlock(rk);
    await vi.waitFor(() => expect(seen.length).toBe(2));
    expect(seen[1].names.sort()).toEqual(['Hip', 'Shoulder']);
    expect(seen[1].locked).toBe(0);
    m.dispose();
  });

  it('a wrong-key document is counted as locked, not thrown', async () => {
    const { p } = fresh();
    const a = createVault(p);
    await a.init();
    await a.create();
    const other = fresh();
    const o = createVault(other.p);
    await o.init();
    await o.create();
    const foreign = await prepareWrite('gyms', { id: 'x', updatedAt: 1, name: 'Z' }, o);
    const r = await readDocs([foreign], a);
    expect(r.items).toEqual([]);
    expect(r.locked).toBe(1);
  });
});
