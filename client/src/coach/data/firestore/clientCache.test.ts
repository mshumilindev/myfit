import { afterEach, describe, expect, it, vi } from 'vitest';
import { readyVault, unsetVault } from '../../../testVault';
import { createSealedLocal, memoryBackend } from '../../chat/sealedLocal';
import { createFixturesClientPort } from '../../client/data/__fixtures__/fixtures';
import { CLIENT_MAX_AGE_MS, CLIENT_SCHEMA, clientCacheOver } from './clientCache';

const snap = () => createFixturesClientPort({ scenario: 'active' }).state();

afterEach(() => vi.useRealTimers());

describe('the on-device snapshot of the client link', () => {
  it('is sealed on disk and comes back whole', async () => {
    // The fixture has a fixed asOf; the clock is pinned to it so the 14-day age limit doesn't turn this into a time bomb.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(snap().asOf);
    const backend = memoryBackend();
    const local = createSealedLocal({ vault: await readyVault(), backend });
    const c = clientCacheOver(Promise.resolve(local), 'u1');
    const s = snap();
    await c.set(s);
    expect(JSON.stringify(await backend.get('client:u1'))).not.toContain('"asOf"');
    expect((await c.get())?.asOf).toBe(s.asOf);
  });

  it('is empty while the vault is locked, and a bad / foreign / old one is dropped', async () => {
    const backend = memoryBackend();
    const locked = createSealedLocal({ vault: await unsetVault(), backend });
    const c0 = clientCacheOver(Promise.resolve(locked), 'u1', { waitMs: 5 });
    expect(await c0.get()).toBeNull();
    await c0.set(snap());
    expect(await backend.keys()).toEqual([]);

    const local = createSealedLocal({ vault: await readyVault(), backend });
    const s = snap();
    const c = clientCacheOver(Promise.resolve(local), 'u1', { now: () => s.asOf });
    const base = { v: CLIENT_SCHEMA, uid: 'u1', savedAt: s.asOf, value: s };
    for (const bad of [
      { ...base, uid: 'u2' },
      { ...base, v: CLIENT_SCHEMA + 1 },
      { ...base, savedAt: s.asOf - CLIENT_MAX_AGE_MS - 1 },
      { ...base, value: { nope: 1 } },
    ]) {
      await local.set('client:u1', bad);
      expect(await c.get()).toBeNull();
      expect(await backend.keys()).toEqual([]);
    }
  });
});
