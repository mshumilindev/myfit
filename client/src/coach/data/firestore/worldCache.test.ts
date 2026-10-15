import { describe, expect, it } from 'vitest';
import { readyVault, unsetVault } from '../../../testVault';
import { createSealedLocal, memoryBackend } from '../../chat/sealedLocal';
import { buildFixtureWorld, FIXTURE_NOW } from '../__fixtures__/fixtures';
import { WORLD_MAX_AGE_MS, WORLD_SCHEMA, worldCacheOver } from './worldCache';

const world = () => ({ ...buildFixtureWorld(), trainer: { id: 't1', name: 'Coach' } });

async function setup() {
  const backend = memoryBackend();
  const local = createSealedLocal({ vault: await readyVault(), backend });
  return { backend, local };
}

describe('the on-device snapshot of the world', () => {
  it('is stored sealed (no readable names on disk) and comes back whole', async () => {
    const { backend, local } = await setup();
    const c = worldCacheOver(Promise.resolve(local), 't1', { now: () => FIXTURE_NOW });
    const w = world();
    await c.set({ data: w, fetchedAt: FIXTURE_NOW });
    const raw = JSON.stringify(await backend.get('world:t1'));
    expect(raw).not.toContain(w.clients[0].name);
    const back = await c.get();
    expect(back?.fetchedAt).toBe(FIXTURE_NOW);
    expect(back?.data.clients).toHaveLength(w.clients.length);
  });

  it('is empty on a first start, and nothing is written while the vault is locked', async () => {
    const backend = memoryBackend();
    const locked = createSealedLocal({ vault: await unsetVault(), backend });
    const c = worldCacheOver(Promise.resolve(locked), 't1', { waitMs: 5 });
    expect(await c.get()).toBeNull();
    await c.set({ data: world(), fetchedAt: FIXTURE_NOW });
    expect(await backend.keys()).toEqual([]);
  });

  it('ignores (and drops) a snapshot of another account, another schema or one that is too old', async () => {
    const { backend, local } = await setup();
    const c = worldCacheOver(Promise.resolve(local), 't1', { now: () => FIXTURE_NOW });
    const base = { v: WORLD_SCHEMA, uid: 't1', fetchedAt: FIXTURE_NOW, data: world() };
    for (const bad of [
      { ...base, uid: 't2' },
      { ...base, v: WORLD_SCHEMA + 1 },
      { ...base, fetchedAt: FIXTURE_NOW - WORLD_MAX_AGE_MS - 1 },
      { ...base, data: { ...world(), trainer: { id: 't2', name: 'x' } } },
      { ...base, data: { nope: true } },
    ]) {
      await local.set('world:t1', bad);
      expect(await c.get()).toBeNull();
      expect(await backend.keys()).toEqual([]);
    }
  });

  it('waits for the vault key instead of giving up at once', async () => {
    const { local } = await setup();
    const c = worldCacheOver(Promise.resolve(local), 't1', { now: () => FIXTURE_NOW });
    await c.set({ data: world(), fetchedAt: FIXTURE_NOW });
    expect((await c.get())?.fetchedAt).toBe(FIXTURE_NOW);
  });
});
