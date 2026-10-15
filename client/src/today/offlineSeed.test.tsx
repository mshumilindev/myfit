/**
 * Gym screens are offline-first: the last good answer (sealed on the device) paints without waiting for the network, a
 * fresh snapshot skips the call, and nothing readable is left in localStorage.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { readyVault } from '../testVault';
import { createSealedLocal, memoryBackend } from '../offline/sealedLocal';
import { configureOffline, createOfflineCache } from '../offline/offlineCache';

const callFn = vi.fn();
vi.mock('../api', () => ({ currentUid: () => 'u1', callFn: (...a: unknown[]) => callFn(...a) }));

import { useClientRoster, type RosterClient } from './clientRoster';
import { useMyTrainer } from './myTrainer';

const roster = (name: string): RosterClient[] => [
  { id: 'c1', name, avatar: false, lastSessionAt: null, dormantDays: null },
];

async function device(now?: () => number) {
  const backend = memoryBackend();
  const local = createSealedLocal({ vault: await readyVault(), backend });
  const mk = () =>
    createOfflineCache({ local: () => Promise.resolve(local), uid: () => 'u1', now, waitMs: 20 });
  return { backend, mk };
}

afterEach(() => {
  cleanup();
  configureOffline(null);
  callFn.mockReset();
  localStorage.clear();
});

describe('Today: roster', () => {
  it('shows the sealed snapshot at once while the network never answers, and keeps it readable-free on disk', async () => {
    const { backend, mk } = await device();
    await mk().set('trainerClients', roster('Olena Koval'));
    configureOffline(mk()); // a restart: no memory, only the disk
    callFn.mockReturnValue(new Promise(() => undefined)); // offline / hanging

    const { result } = renderHook(() => useClientRoster(true));
    expect(result.current).toBeNull(); // sealed storage is async: not on the very first render
    await waitFor(() => expect(result.current?.[0].name).toBe('Olena Koval'));

    for (const k of await backend.keys())
      expect(JSON.stringify(await backend.get(k))).not.toContain('Olena');
    expect(JSON.stringify(Object.entries(localStorage))).not.toContain('Olena');
  });

  it('a fresh snapshot skips the call; a stale one refreshes in the background and replaces it', async () => {
    let t = 1_000_000;
    const { mk } = await device(() => t);
    await mk().set('trainerClients', roster('Old'));
    callFn.mockResolvedValue({ clients: roster('New') });

    t += 60_000; // younger than the 2 min gate
    configureOffline(mk());
    const a = renderHook(() => useClientRoster(true));
    await waitFor(() => expect(a.result.current?.[0].name).toBe('Old'));
    await new Promise((r) => setTimeout(r, 50));
    expect(callFn).not.toHaveBeenCalled();
    a.unmount();

    t += 5 * 60_000; // older than the gate
    configureOffline(mk());
    const b = renderHook(() => useClientRoster(true));
    await waitFor(() => expect(b.result.current?.[0].name).toBe('New'));
    expect(callFn).toHaveBeenCalledTimes(1);
  });

  it('never touches the network when disabled', async () => {
    const { mk } = await device();
    configureOffline(mk());
    const { result } = renderHook(() => useClientRoster(false));
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current).toBeNull();
    expect(callFn).not.toHaveBeenCalled();
  });
});

describe('Today: my trainer', () => {
  it('"no trainer" is an answer too: cached as false, shown as none, no call while fresh', async () => {
    const { mk } = await device();
    callFn.mockResolvedValue({ trainer: null });
    configureOffline(mk());
    const a = renderHook(() => useMyTrainer(true));
    await waitFor(() => expect(callFn).toHaveBeenCalledTimes(1));
    expect(a.result.current).toBeNull();
    a.unmount();

    configureOffline(mk()); // restart
    const b = renderHook(() => useMyTrainer(true));
    await new Promise((r) => setTimeout(r, 80));
    expect(b.result.current).toBeNull();
    expect(callFn).toHaveBeenCalledTimes(1);
  });

  it('shows the cached trainer first and keeps it when the refresh fails', async () => {
    let t = 1_000_000;
    const { mk } = await device(() => t);
    await mk().set('myTrainer', { id: 't1', name: 'Coach Anna', avatar: false });
    t += 60 * 60_000; // past the 10 min gate: it will try the network
    configureOffline(mk());
    callFn.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useMyTrainer(true));
    await waitFor(() => expect(result.current?.name).toBe('Coach Anna'));
    await waitFor(() => expect(callFn).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 30));
    expect(result.current?.name).toBe('Coach Anna');
  });
});
