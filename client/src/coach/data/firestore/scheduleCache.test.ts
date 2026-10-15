import { describe, expect, it } from 'vitest';
import { readyVault, unsetVault } from '../../../testVault';
import { createSealedLocal, memoryBackend } from '../../chat/sealedLocal';
import type { ScheduleData } from '../../schedule/port';
import { emptyDoc } from '../../schedule/types';
import { SCHEDULE_MAX_AGE_MS, SCHEDULE_SCHEMA, scheduleCacheOver } from './scheduleCache';

const NOW = 1_800_000_000_000;
const KEY = 'schedule:t1';

const data = (): ScheduleData => ({
  docs: [
    {
      ...emptyDoc('c1'),
      rev: 3,
      oneOffs: [{ id: 'oo1', day: 20_000, start: '18:00', dur: 60, gymId: 'g', note: 'left knee' }],
    },
  ],
  requests: [
    {
      id: 'rq1',
      clientId: 'c1',
      from: 'client',
      slotKey: 'k',
      fromStart: NOW,
      toStart: NOW + 3_600_000,
      status: 'pending',
      createdAt: NOW,
      expiresAt: NOW + 86_400_000,
      scope: 'one',
    },
  ],
  asOf: NOW,
});

async function setup() {
  const backend = memoryBackend();
  const local = createSealedLocal({ vault: await readyVault(), backend });
  return { backend, local };
}

describe('the on-device snapshot of the schedule', () => {
  it('is stored sealed (nothing readable on disk) and comes back whole', async () => {
    const { backend, local } = await setup();
    const c = scheduleCacheOver(Promise.resolve(local), 't1', { now: () => NOW });
    await c.set(data());
    expect(await backend.keys()).toEqual([KEY]);
    expect(JSON.stringify(await backend.get(KEY))).not.toContain('left knee');
    expect(await c.get()).toEqual(data());
  });

  it('is empty on a first start, and nothing is written while the vault is locked', async () => {
    const backend = memoryBackend();
    const locked = createSealedLocal({ vault: await unsetVault(), backend });
    const c = scheduleCacheOver(Promise.resolve(locked), 't1', { waitMs: 5 });
    expect(await c.get()).toBeNull();
    await c.set(data());
    expect(await backend.keys()).toEqual([]);
  });

  it('ignores (and drops) a snapshot of another account, another schema, too old or of a wrong shape', async () => {
    const { backend, local } = await setup();
    const c = scheduleCacheOver(Promise.resolve(local), 't1', { now: () => NOW });
    const base = { v: SCHEDULE_SCHEMA, uid: 't1', savedAt: NOW, value: data() };
    const d = data();
    for (const bad of [
      { ...base, uid: 't2' },
      { ...base, v: SCHEDULE_SCHEMA + 1 },
      { ...base, savedAt: NOW - SCHEDULE_MAX_AGE_MS - 1 },
      { ...base, value: { nope: true } },
      { ...base, value: { ...d, asOf: 'x' } },
      { ...base, value: { ...d, docs: 'x' } },
      { ...base, value: { ...d, docs: [{ clientId: 'c1' }] } },
      { ...base, value: { ...d, docs: [d.docs[0], d.docs[0]] } },
      { ...base, value: { ...d, requests: [{ id: 'r' }] } },
    ]) {
      await local.set(KEY, bad);
      expect(await c.get()).toBeNull();
      expect(await backend.keys()).toEqual([]);
    }
  });

  it('does not read a snapshot sealed by another vault key', async () => {
    const { backend, local } = await setup();
    await scheduleCacheOver(Promise.resolve(local), 't1').set(data());
    const other = createSealedLocal({ vault: await readyVault(), backend });
    expect(await scheduleCacheOver(Promise.resolve(other), 't1').get()).toBeNull();
  });
});
