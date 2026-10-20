import { describe, expect, it } from 'vitest';
import type { StorageBackend } from './scopedStorage';
import { isDeviceKey } from './scopedStorage';
import {
  REMEMBERED_KEY,
  readRemembered,
  recordSignIn,
  removeRemembered,
  setPasskey,
} from './rememberedPeople';

function memoryBackend(seed: Record<string, string> = {}): StorageBackend & { dump(): Record<string, string> } {
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

const anna = { uid: 'uAnna', name: 'Anna', appName: '[DEFAULT]' };
const boris = { uid: 'uBoris', name: 'Boris', appName: 'acct-2', avatar: 'a/b.png' };

describe('rememberedPeople', () => {
  it('is a device key, so it is readable before anyone signs in', () => {
    expect(isDeviceKey(REMEMBERED_KEY)).toBe(true);
  });

  it('stores nothing when "Remember me" is not ticked', () => {
    const b = memoryBackend();
    recordSignIn(b, anna, false, 1);
    expect(b.dump()).toEqual({});
    expect(readRemembered(b)).toEqual([]);
  });

  it('stores the person when ticked, newest first', () => {
    const b = memoryBackend();
    recordSignIn(b, anna, true, 1);
    recordSignIn(b, boris, true, 2);
    expect(readRemembered(b).map((p) => p.uid)).toEqual(['uBoris', 'uAnna']);
    recordSignIn(b, anna, true, 3);
    expect(readRemembered(b).map((p) => p.uid)).toEqual(['uAnna', 'uBoris']);
    expect(readRemembered(b)).toHaveLength(2);
  });

  it('an unticked sign-in drops that person\'s older entry and leaves the others', () => {
    const b = memoryBackend();
    recordSignIn(b, anna, true, 1);
    recordSignIn(b, boris, true, 2);
    recordSignIn(b, anna, false, 3);
    expect(readRemembered(b).map((p) => p.uid)).toEqual(['uBoris']);
  });

  it('the last person leaving removes the key itself (no trace on the device)', () => {
    const b = memoryBackend();
    recordSignIn(b, anna, true, 1);
    expect(removeRemembered(b, 'uAnna')).toBe(true);
    expect(b.dump()).toEqual({});
    expect(removeRemembered(b, 'uAnna')).toBe(false);
  });

  it('keeps the passkey flag across a re-sign-in and sets it only for known people', () => {
    const b = memoryBackend();
    recordSignIn(b, anna, true, 1);
    setPasskey(b, 'uAnna', true);
    setPasskey(b, 'uNobody', true);
    recordSignIn(b, anna, true, 2);
    expect(readRemembered(b)).toEqual([{ ...anna, passkey: true, lastUsed: 2 }]);
    setPasskey(b, 'uAnna', false);
    expect(readRemembered(b)[0].passkey).toBe(false);
  });

  it('reads corrupt or foreign data as nobody remembered and skips bad rows', () => {
    expect(readRemembered(memoryBackend({ [REMEMBERED_KEY]: '{not json' }))).toEqual([]);
    expect(readRemembered(memoryBackend({ [REMEMBERED_KEY]: '{"a":1}' }))).toEqual([]);
    const rows = JSON.stringify([
      { uid: 'bad:uid', name: 'x', appName: 'a', lastUsed: 1 },
      { uid: 'ok', name: 'Ok', appName: 'a', lastUsed: 2 },
      { uid: 'ok', name: 'Dup', appName: 'a', lastUsed: 3 },
      { uid: 'nan', name: 'N', appName: 'a', lastUsed: 'x' },
    ]);
    expect(readRemembered(memoryBackend({ [REMEMBERED_KEY]: rows })).map((p) => p.name)).toEqual(['Ok']);
  });

  it('refuses an invalid uid', () => {
    expect(() => recordSignIn(memoryBackend(), { ...anna, uid: 'a:b' }, true, 1)).toThrow('bad-uid');
  });
});
