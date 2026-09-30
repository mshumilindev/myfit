// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('./firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), getDoc: vi.fn(), setDoc: vi.fn() }));

import { createAutoVault } from './autoVault';
import { mirrorCollection, prepareWrite, readDocs } from './vaultIO';
import { isSealed } from './encryptedDoc';
import { memCache, randomServerKey, readyVault, unsetVault } from './testVault';

describe('prepareWrite', () => {
  it('is plaintext while no key was obtained (feature off changes nothing)', async () => {
    const v = await unsetVault();
    expect(await prepareWrite('injuries', { id: 'a', name: 'Knee' }, v)).toEqual({
      id: 'a',
      name: 'Knee',
    });
  });
  it('seals when ready', async () => {
    const v = await readyVault();
    const out = await prepareWrite('injuries', { id: 'a', updatedAt: 1, name: 'Knee' }, v);
    expect(isSealed(out)).toBe(true);
    expect(JSON.stringify(out)).not.toContain('Knee');
  });
});

describe('readDocs / mirrorCollection', () => {
  it('shows plaintext docs and skips sealed ones without a key, then reveals them when the key arrives', async () => {
    const server = randomServerKey();
    const a = await readyVault(server);
    const sealed = await prepareWrite('injuries', { id: 's', updatedAt: 1, name: 'Hip' }, a);
    const legacy = { id: 'l', name: 'Shoulder' };

    // Second device: the first key fetch fails (offline), the retry succeeds.
    let online = false;
    const b = createAutoVault({
      fetchKey: async () => {
        if (!online) throw new Error('offline');
        return server;
      },
      cache: memCache(),
    });
    await b.init();

    const seen: { names: string[]; locked: number }[] = [];
    const m = mirrorCollection<{ id: string; name: string }>(
      (items, info) => seen.push({ names: items.map((i) => i.name), locked: info.locked }),
      b,
    );
    m.push([sealed, legacy]);
    await vi.waitFor(() => expect(seen.length).toBe(1));
    expect(seen[0]).toEqual({ names: ['Shoulder'], locked: 1 });

    online = true;
    await b.init();
    await vi.waitFor(() => expect(seen.length).toBeGreaterThan(1));
    const last = seen[seen.length - 1];
    expect(last.names.sort()).toEqual(['Hip', 'Shoulder']);
    expect(last.locked).toBe(0);
    m.dispose();
  });

  it('a wrong-key document is counted as locked, not thrown', async () => {
    const a = await readyVault();
    const o = await readyVault();
    const foreign = await prepareWrite('gyms', { id: 'x', updatedAt: 1, name: 'Z' }, o);
    const r = await readDocs([foreign], a);
    expect(r.items).toEqual([]);
    expect(r.locked).toBe(1);
  });
});
