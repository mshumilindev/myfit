import { describe, expect, it } from 'vitest';
import type { StorageBackend } from '../../accounts/scopedStorage';
import {
  classifyKey,
  formatBytes,
  idbKind,
  readInventory,
  scanStorage,
  unscoped,
} from './deviceInventory';

function fake(entries: Record<string, string>): StorageBackend {
  const m = new Map(Object.entries(entries));
  return {
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

describe('device inventory: key groups', () => {
  it('reads an account-scoped key by its own name', () => {
    expect(unscoped('u:abc123:spotter.state')).toBe('spotter.state');
    expect(unscoped('u:bad uid:spotter.state')).toBe('u:bad uid:spotter.state');
    expect(unscoped('spotter.state')).toBe('spotter.state');
  });

  it.each([
    ['spotter.activeAccount', 'signin'],
    ['firebase:authUser:key:[DEFAULT]', 'signin'],
    ['FCM_xyz', 'signin'],
    ['u:abc:spotter.state', 'offline'],
    ['spotter.sleeps', 'offline'],
    ['spotter.cache.roster', 'cache'],
    ['spotter.programMine', 'cache'],
    ['spotter.atlasChat', 'atlas'],
    ['spotter.atlasIntroSeen', 'atlas'],
    ['spotter.consentQueue', 'consent'],
    ['spotter.consentRevokeQueue', 'consent'],
    ['spotter.consentLocalOff', 'consent'],
    ['spotter.consentVerified', 'consent'],
    ['spotter.pushOn', 'reminders'],
    ['spotter.quietHours', 'reminders'],
    ['gym.search.london', 'gymsearch'],
    ['spotter.lastPos', 'gymsearch'],
    ['gym.locale', 'settings'],
    ['spotter.weightUnit', 'settings'],
    ['coach:last', 'settings'],
    ['some.other.library', 'other'],
  ])('%s -> %s', (key, group) => {
    expect(classifyKey(key)).toBe(group);
  });

  it('names the databases the browser lists', () => {
    expect(idbKind('spotter.coach.chat')).toBe('idbCoachChat');
    expect(idbKind('spotter.vault')).toBe('idbVault');
    expect(idbKind('firestore/[DEFAULT]/spotter/main')).toBe('idbFirestore');
    expect(idbKind('whatever')).toBe('idbOther');
  });
});

describe('device inventory: scan', () => {
  it('lists only groups that have keys, with real key counts and UTF-16 sizes', () => {
    const s = fake({
      'spotter.atlasChat': '[1]',
      'spotter.atlasIntroSeen': '1',
      'spotter.cache.roster': 'xx',
      'gym.locale': 'en',
    });
    const r = scanStorage(s);
    expect(Object.keys(r).sort()).toEqual(['atlas', 'cache', 'settings']);
    expect(r.atlas).toEqual({
      keys: 2,
      bytes: ('spotter.atlasChat'.length + 3 + 'spotter.atlasIntroSeen'.length + 1) * 2,
    });
    expect(r.cache?.keys).toBe(1);
    expect(r.offline).toBeUndefined();
  });

  it('no storage means nothing found, not a guess', () => {
    expect(scanStorage(null)).toEqual({});
  });

  it('counts databases and caches the browser reports, and says so when it cannot list them', async () => {
    const inv = await readInventory({
      storage: fake({}),
      idb: {
        databases: async () => [
          { name: 'spotter-avatars' },
          { name: 'firestore/[DEFAULT]/p/main' },
          { name: 'spotter.vault' },
          { name: 'zzz' },
        ],
      },
      cacheKeys: async () => ['a', 'b'],
      estimate: async () => ({ usage: 4096 }),
    });
    expect(inv.idb).toEqual({ idbAvatars: 1, idbFirestore: 1, idbVault: 1, idbOther: 1 });
    expect(inv.caches).toBe(2);
    expect(inv.usage).toBe(4096);
    const none = await readInventory({ storage: fake({}), idb: {} });
    expect(none).toEqual({ storage: {}, idb: null, caches: null, usage: null });
  });

  it('formats sizes', () => {
    expect(formatBytes(512, 'en')).toBe('512 B');
    expect(formatBytes(1536, 'en')).toBe('1.5 KB');
    expect(formatBytes(3 * 1024 * 1024, 'en')).toBe('3 MB');
  });
});
