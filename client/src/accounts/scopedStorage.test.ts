import { describe, expect, it } from 'vitest';
import {
  ADOPTED_FLAG,
  adoptLegacyKeys,
  createScopedStorage,
  forgetAccountKeys,
  wipeAccountKeys,
  isDeviceKey,
  isValidUid,
  scopedKey,
  type StorageBackend,
} from './scopedStorage';

function memoryBackend(seed: Record<string, string> = {}): StorageBackend & {
  dump(): Record<string, string>;
} {
  const m = new Map(Object.entries(seed));
  return {
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

const active = (uid: string | null) => () => uid;

describe('scopedStorage: isolation between accounts', () => {
  it('a value written by account A is invisible to B and survives B writing the same key', () => {
    const backend = memoryBackend();
    let uid: string | null = 'alice';
    const s = createScopedStorage({ backend, activeUid: () => uid });
    s.setItem('spotter.goals', 'A-goals');
    uid = 'bob';
    expect(s.getItem('spotter.goals')).toBeNull();
    s.setItem('spotter.goals', 'B-goals');
    uid = 'alice';
    expect(s.getItem('spotter.goals')).toBe('A-goals');
    expect(backend.dump()).toEqual({
      'u:alice:spotter.goals': 'A-goals',
      'u:bob:spotter.goals': 'B-goals',
    });
  });

  it('removeItem only touches the active account', () => {
    const backend = memoryBackend({ 'u:alice:k': '1', 'u:bob:k': '2' });
    createScopedStorage({ backend, activeUid: active('alice') }).removeItem('k');
    expect(backend.dump()).toEqual({ 'u:bob:k': '2' });
  });

  it('device keys are shared and stored as-is', () => {
    const backend = memoryBackend();
    let uid: string | null = 'alice';
    const s = createScopedStorage({ backend, activeUid: () => uid });
    s.setItem('gym.locale', 'uk');
    uid = 'bob';
    expect(s.getItem('gym.locale')).toBe('uk');
    expect(backend.dump()).toEqual({ 'gym.locale': 'uk' });
  });

  it('with no active account reads are empty and writes are dropped (fail closed)', () => {
    const backend = memoryBackend();
    const s = createScopedStorage({ backend, activeUid: active(null) });
    s.setItem('spotter.goals', 'x');
    expect(s.getItem('spotter.goals')).toBeNull();
    expect(backend.dump()).toEqual({});
  });

  it('a malformed uid is treated as no account', () => {
    const backend = memoryBackend();
    const s = createScopedStorage({ backend, activeUid: active('a:b') });
    s.setItem('k', 'x');
    expect(backend.dump()).toEqual({});
  });

  it('keys() lists the active account unprefixed plus device keys, never another account', () => {
    const backend = memoryBackend({
      'u:alice:a': '1',
      'u:alice:b': '2',
      'u:bob:c': '3',
      'gym.locale': 'en',
      'firebase:authUser:k:[DEFAULT]': '{}',
    });
    const s = createScopedStorage({ backend, activeUid: active('alice') });
    expect(s.keys().sort()).toEqual(['a', 'b', 'firebase:authUser:k:[DEFAULT]', 'gym.locale']);
  });
});

describe('scopedStorage: keys and uids', () => {
  it('classifies device keys and library prefixes', () => {
    expect(isDeviceKey('gym.locale')).toBe(true);
    expect(isDeviceKey('firebase:host:x')).toBe(true);
    expect(isDeviceKey('u:alice:k')).toBe(true);
    expect(isDeviceKey('spotter.goals')).toBe(false);
    expect(isDeviceKey('coach:last')).toBe(false);
  });

  it('accepts Firebase-style uids only', () => {
    expect(isValidUid('aB3_-9')).toBe(true);
    expect(isValidUid('')).toBe(false);
    expect(isValidUid('a:b')).toBe(false);
    expect(isValidUid('x'.repeat(129))).toBe(false);
    expect(isValidUid(null)).toBe(false);
    expect(() => scopedKey('a:b', 'k')).toThrow('bad-uid');
  });
});

describe('forgetAccountKeys', () => {
  it('removes only that account, not a uid sharing its prefix, nor device keys', () => {
    const backend = memoryBackend({
      'u:ann:a': '1',
      'u:ann:b': '2',
      'u:anna:a': '3',
      'gym.locale': 'en',
    });
    expect(forgetAccountKeys(backend, 'ann')).toBe(2);
    expect(backend.dump()).toEqual({ 'u:anna:a': '3', 'gym.locale': 'en' });
  });

  it('is a no-op for an account with no keys', () => {
    const backend = memoryBackend({ 'u:bob:a': '1' });
    expect(forgetAccountKeys(backend, 'ann')).toBe(0);
    expect(backend.dump()).toEqual({ 'u:bob:a': '1' });
  });
});

describe('adoptLegacyKeys (migration of an existing single-account device)', () => {
  const legacy = {
    'spotter.goals': 'g',
    'spotter.supplements.enc': '{"v":1}',
    'coach:last': '#/c/x',
    'gym.locale': 'pl',
    'firebase:authUser:k:[DEFAULT]': '{}',
  };

  it('moves account keys to the uid, leaves device and library keys, sets the flag', () => {
    const backend = memoryBackend(legacy);
    expect(adoptLegacyKeys(backend, 'alice')).toBe(3);
    expect(backend.dump()).toEqual({
      'u:alice:spotter.goals': 'g',
      'u:alice:spotter.supplements.enc': '{"v":1}',
      'u:alice:coach:last': '#/c/x',
      'gym.locale': 'pl',
      'firebase:authUser:k:[DEFAULT]': '{}',
      [ADOPTED_FLAG]: 'alice',
    });
  });

  it("runs once: a second account is not given the first one's keys", () => {
    const backend = memoryBackend(legacy);
    adoptLegacyKeys(backend, 'alice');
    backend.setItem('late-legacy-key', 'x');
    expect(adoptLegacyKeys(backend, 'bob')).toBe(0);
    expect(backend.getItem('u:bob:late-legacy-key')).toBeNull();
    expect(backend.getItem(ADOPTED_FLAG)).toBe('alice');
  });

  it('after a crash half-way, a re-run keeps the newer scoped value and drops the legacy copy', () => {
    const backend = memoryBackend({ 'spotter.goals': 'old', 'u:alice:spotter.goals': 'new' });
    adoptLegacyKeys(backend, 'alice');
    expect(backend.getItem('u:alice:spotter.goals')).toBe('new');
    expect(backend.getItem('spotter.goals')).toBeNull();
  });

  it('refuses a malformed uid and writes nothing', () => {
    const backend = memoryBackend(legacy);
    expect(() => adoptLegacyKeys(backend, 'a:b')).toThrow('bad-uid');
    expect(backend.dump()).toEqual(legacy);
  });

  it('works end to end with the scoped view', () => {
    const backend = memoryBackend(legacy);
    adoptLegacyKeys(backend, 'alice');
    const s = createScopedStorage({ backend, activeUid: active('alice') });
    expect(s.getItem('spotter.goals')).toBe('g');
    expect(
      createScopedStorage({ backend, activeUid: active('bob') }).getItem('spotter.goals'),
    ).toBeNull();
  });
});

describe('wipeAccountKeys', () => {
  it('removes personal keys and keeps device and library keys', () => {
    const b = memoryBackend({
      'spotter.state': '{}',
      'spotter.atlasChat': '[]',
      'spotter.weightUnit': 'kg',
      'gym.locale': 'uk',
      'gym.flags': '{}',
      'spotter.pushDevice': 'd1',
      'firebase:authUser:x': '{}',
      'spotter.accounts': '[]',
    });
    expect(wipeAccountKeys(b)).toBe(3);
    expect(Object.keys(b.dump()).sort()).toEqual(
      [
        'firebase:authUser:x',
        'gym.flags',
        'gym.locale',
        'spotter.accounts',
        'spotter.pushDevice',
      ].sort(),
    );
  });
});
