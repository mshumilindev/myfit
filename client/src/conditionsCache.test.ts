// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CONDITIONS_ENC_KEY,
  CONDITIONS_KEY,
  CONDITIONS_SHARE_KEY,
  createConditionsCache,
} from './conditionsCache';
import { readyVault, unsetVault } from './testVault';
import type { Vault } from './autoVault';

type C = { id: string; name: string; updatedAt?: number };
type S = 'off' | 'effects' | 'full';
const isShare = (v: unknown): v is S => v === 'off' || v === 'effects' || v === 'full';

let data: Map<string, string>;
const storage = () => ({
  getItem: (k: string) => data.get(k) ?? null,
  setItem: (k: string, v: string) => void data.set(k, v),
  removeItem: (k: string) => void data.delete(k),
});
const make = (vault: Pick<Vault, 'materialOrNull'>) =>
  createConditionsCache<C, S>({ vault, storage, isShare });
const tick = () => new Promise((r) => setTimeout(r, 20));
const knee: C = { id: 'a', name: 'Knee secret', updatedAt: 1 };

beforeEach(() => {
  data = new Map();
});

describe('conditions on-device cache', () => {
  it('round trip: sealed at rest, hydrated on the next start', async () => {
    const v = await readyVault();
    const c1 = make(v);
    c1.boot({ conditions: [], share: 'effects' });
    c1.persist({ conditions: [knee], share: 'full' });
    await tick();
    expect(data.has(CONDITIONS_ENC_KEY)).toBe(true);
    expect(data.has(CONDITIONS_KEY)).toBe(false);
    expect(data.has(CONDITIONS_SHARE_KEY)).toBe(false);
    expect(data.get(CONDITIONS_ENC_KEY)).not.toContain('Knee');

    const c2 = make(v); // next start: plaintext keys empty
    c2.boot({ conditions: [], share: 'effects' });
    const out = await c2.hydrate({ conditions: [], share: 'effects' });
    expect(out).toEqual({ conditions: [knee], share: 'full' });
  });

  it('migrates legacy plaintext once and never writes it again', async () => {
    data.set(CONDITIONS_KEY, JSON.stringify([knee]));
    data.set(CONDITIONS_SHARE_KEY, 'off');
    const v = await readyVault();
    const c = make(v);
    c.boot({ conditions: [knee], share: 'off' });
    await c.hydrate({ conditions: [knee], share: 'off' });
    await tick();
    expect(data.has(CONDITIONS_KEY)).toBe(false);
    expect(data.has(CONDITIONS_SHARE_KEY)).toBe(false);
    expect(data.has(CONDITIONS_ENC_KEY)).toBe(true);
    c.persist({ conditions: [knee, { id: 'b', name: 'Asthma' }], share: 'off' });
    await tick();
    expect(data.has(CONDITIONS_KEY)).toBe(false);
  });

  it('falls back to plaintext while no key exists, losing nothing', async () => {
    const v = await unsetVault();
    const c = make(v);
    c.boot({ conditions: [], share: 'effects' });
    c.persist({ conditions: [knee], share: 'full' });
    expect(JSON.parse(data.get(CONDITIONS_KEY) ?? '[]')).toEqual([knee]);
    expect(data.get(CONDITIONS_SHARE_KEY)).toBe('full');
    expect(data.has(CONDITIONS_ENC_KEY)).toBe(false);
    expect(await c.hydrate({ conditions: [knee], share: 'full' })).toBeNull();
  });

  it('never clobbers a sealed copy while the key is not here; merges edits on hydrate', async () => {
    const v = await readyVault();
    const first = make(v);
    first.boot({ conditions: [], share: 'effects' });
    first.persist({ conditions: [knee], share: 'full' });
    await tick();
    const sealed = data.get(CONDITIONS_ENC_KEY);

    // Offline restart before the key is available: state boots empty.
    const noKey = { materialOrNull: () => null };
    const c = createConditionsCache<C, S>({ vault: noKey, storage, isShare });
    c.boot({ conditions: [], share: 'effects' });
    c.persist({ conditions: [], share: 'effects' }); // unrelated persist: must not write
    expect(data.has(CONDITIONS_KEY)).toBe(false);
    expect(data.get(CONDITIONS_ENC_KEY)).toBe(sealed);
    const added: C = { id: 'n', name: 'New', updatedAt: 5 };
    c.persist({ conditions: [added], share: 'effects' }); // a real edit is kept in plaintext
    expect(JSON.parse(data.get(CONDITIONS_KEY) ?? '[]')).toEqual([added]);

    // Key arrives: sealed + edited merge, plaintext migrated away.
    const c2 = createConditionsCache<C, S>({ vault: v, storage, isShare });
    c2.boot({ conditions: [], share: 'effects' });
    const out = await c2.hydrate({ conditions: [added], share: 'effects' });
    expect(out?.conditions.map((x) => x.id).sort()).toEqual(['a', 'n']);
    await tick();
    expect(data.has(CONDITIONS_KEY)).toBe(false);
  });

  it('Firestore truth wins over the sealed copy once it arrived', async () => {
    const v = await readyVault();
    const a = make(v);
    a.boot({ conditions: [], share: 'effects' });
    a.persist({ conditions: [knee], share: 'full' });
    await tick();
    const b = make(v);
    b.boot({ conditions: [], share: 'effects' });
    b.markRemote('conditions'); // remote says: none (deleted elsewhere)
    expect(await b.hydrate({ conditions: [], share: 'effects' })).toEqual({
      conditions: [],
      share: 'full',
    });
  });

  it('reset clears both the sealed and the plaintext keys', async () => {
    const v = await readyVault();
    const c = make(v);
    c.boot({ conditions: [], share: 'effects' });
    c.persist({ conditions: [knee], share: 'full' });
    await tick();
    data.set(CONDITIONS_KEY, '[]');
    data.set(CONDITIONS_SHARE_KEY, 'off');
    c.clear();
    expect([...data.keys()]).toEqual([]);
  });
});
