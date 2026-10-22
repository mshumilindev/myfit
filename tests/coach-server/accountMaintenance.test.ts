/** Housekeeping behind account deletion (SPO-285 S1/S2) on the in-memory Kv. */
import { describe, expect, it } from 'vitest';
import { createMemoryKv } from '../../functions/src/coach/memoryKv';
import {
  LOGIN_ATTEMPT_RETENTION_MS,
  purgeStaleLoginAttempts,
  sweepPhantomUsers,
} from '../../functions/src/accountMaintenanceCore';

const NOW = Date.UTC(2026, 9, 22, 12, 0, 0);

describe('stale loginAttempts purge (S2)', () => {
  it('removes counters whose window ended long ago (also those without `identifier`), keeps recent ones', async () => {
    const kv = createMemoryKv();
    await kv.set('loginAttempts/1.1.1.1|old', {
      count: 3,
      windowStart: NOW - 2 * LOGIN_ATTEMPT_RETENTION_MS,
    });
    await kv.set('loginAttempts/1.1.1.1|legacy', {
      count: 1,
      windowStart: NOW - 5 * LOGIN_ATTEMPT_RETENTION_MS,
    });
    await kv.set('loginAttempts/1.1.1.1|fresh', {
      count: 9,
      windowStart: NOW - 60_000,
      identifier: 'fresh',
    });
    expect(await purgeStaleLoginAttempts(kv, NOW)).toBe(2);
    expect(kv.paths()).toEqual(['loginAttempts/1.1.1.1|fresh']);
  });

  it('is bounded: one run removes at most `limit`', async () => {
    const kv = createMemoryKv();
    for (let i = 0; i < 7; i++)
      await kv.set(`loginAttempts/ip|u${i}`, { count: 1, windowStart: 1 });
    expect(await purgeStaleLoginAttempts(kv, NOW, 3)).toBe(3);
    expect(kv.paths()).toHaveLength(4);
  });
});

describe('phantom user sweep (S1)', () => {
  const setup = async () => {
    const kv = createMemoryKv();
    await kv.set('users/live1', { role: 'member' });
    await kv.set('users/live1/workouts/w1', { id: 'w1' });
    await kv.set('users/gone1/sessions/dev1', { lastSeenAt: 1 }); // recreated by a stale token
    await kv.set('users/gone1/workouts/w9', { id: 'w9' });
    await kv.set('users/gone2/meta/body', {});
    const deleted: string[] = [];
    const ports = {
      phantomUserIds: async () => {
        const ids = new Set(kv.paths().map((p) => p.split('/')[1]));
        return [...ids].filter((id) => !kv.has(`users/${id}`));
      },
      deleteTree: async (path: string) => {
        deleted.push(path);
        for (const p of kv.paths()) if (p === path || p.startsWith(`${path}/`)) await kv.del(p);
      },
    };
    return { kv, ports, deleted };
  };

  it('deletes trees whose user document is gone and never touches a live account', async () => {
    const { kv, ports, deleted } = await setup();
    expect(await sweepPhantomUsers(kv, ports)).toBe(2);
    expect(deleted.sort()).toEqual(['users/gone1', 'users/gone2']);
    expect(kv.paths()).toEqual(['users/live1', 'users/live1/workouts/w1']);
  });

  it('re-checks right before deleting: an account created since the listing survives', async () => {
    const { kv, ports } = await setup();
    const list = ports.phantomUserIds;
    ports.phantomUserIds = async () => {
      const ids = await list();
      await kv.set('users/gone1', { role: 'member' }); // created between listing and sweeping
      return ids;
    };
    expect(await sweepPhantomUsers(kv, ports)).toBe(1);
    expect(kv.has('users/gone1/sessions/dev1')).toBe(true);
  });

  it('is bounded and skips ids that are not safe uids', async () => {
    const { kv, ports } = await setup();
    expect(await sweepPhantomUsers(kv, ports, 1)).toBe(1);
    const ids = ports.phantomUserIds;
    ports.phantomUserIds = async () => ['a/b', ...(await ids())];
    expect(await sweepPhantomUsers(kv, ports)).toBe(1);
  });
});
