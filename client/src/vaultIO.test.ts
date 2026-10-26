// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('./firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), getDoc: vi.fn(), setDoc: vi.fn() }));

import { createAutoVault } from './autoVault';
import { mirrorCollection, prepareWrite, readDocs } from './vaultIO';
import { isSealed } from './encryptedDoc';
import { memCache, randomServerKey, readyVault } from './testVault';

describe('prepareWrite', () => {
  it('never returns plaintext while no key was obtained: the write waits and is sealed when the key arrives (SPO-269)', async () => {
    const server = randomServerKey();
    let online = false;
    const v = createAutoVault({
      fetchKey: async () => {
        if (!online) throw new Error('offline');
        return server;
      },
      cache: memCache(),
    });
    await v.init();
    expect(v.status()).toBe('unset');

    let out: Record<string, unknown> | null = null;
    void prepareWrite('injuries', { id: 'a', updatedAt: 1, name: 'Knee' }, v).then(
      (r) => (out = r),
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(out).toBeNull(); // nothing (least of all plaintext) is handed out

    online = true;
    await v.init();
    await vi.waitFor(() => expect(out).not.toBeNull());
    expect(isSealed(out)).toBe(true);
    expect(JSON.stringify(out)).not.toContain('Knee');
  });
  it('keeps the order of deferred writes', async () => {
    const server = randomServerKey();
    let online = false;
    const v = createAutoVault({
      fetchKey: async () => {
        if (!online) throw new Error('offline');
        return server;
      },
      cache: memCache(),
    });
    await v.init();
    const order: string[] = [];
    for (const id of ['1', '2', '3'])
      void prepareWrite('injuries', { id, updatedAt: 1, name: id }, v).then((r) =>
        order.push(String(r.id)),
      );
    online = true;
    await v.init();
    await vi.waitFor(() => expect(order).toEqual(['1', '2', '3']));
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
