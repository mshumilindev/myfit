import { describe, expect, it } from 'vitest';
import type { StorageBackend } from './scopedStorage';
import { afterSignIn, afterSignOut } from './deviceSession';
import { readRemembered } from './rememberedPeople';

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

describe('deviceSession', () => {
  it('sign-in without "Remember me" leaves no trace of the person', () => {
    const b = memoryBackend();
    afterSignIn(b, { uid: 'uA', name: 'Anna' }, false, 1);
    expect(b.dump()).toEqual({});
  });

  it('sign-in with "Remember me" lists the person', () => {
    const b = memoryBackend();
    afterSignIn(b, { uid: 'uA', name: 'Anna' }, true, 1);
    expect(readRemembered(b)).toEqual([{ uid: 'uA', name: 'Anna', appName: '[DEFAULT]', lastUsed: 1 }]);
  });

  it('never stores a person whose uid is unusable', () => {
    const b = memoryBackend();
    afterSignIn(b, { uid: 'a:b', name: 'X' }, true, 1);
    expect(b.dump()).toEqual({});
  });

  it('sign-out wipes personal keys but keeps the person on the landing list', () => {
    const b = memoryBackend({ 'spotter.state': '{"x":1}', 'spotter.injuries': '[]', 'gym.locale': 'pl' });
    afterSignIn(b, { uid: 'uA', name: 'Anna' }, true, 1);
    afterSignOut(b, 'uA', false);
    expect(b.getItem('spotter.state')).toBeNull();
    expect(b.getItem('spotter.injuries')).toBeNull();
    expect(b.getItem('gym.locale')).toBe('pl');
    expect(readRemembered(b).map((p) => p.uid)).toEqual(['uA']);
  });

  it('sign-out with forget removes the person and leaves nothing of them', () => {
    const b = memoryBackend({ 'spotter.state': '{}' });
    afterSignIn(b, { uid: 'uA', name: 'Anna' }, true, 1);
    afterSignOut(b, 'uA', true);
    expect(b.dump()).toEqual({});
  });

  it('forget with an unknown or missing uid still wipes personal keys', () => {
    const b = memoryBackend({ 'spotter.state': '{}' });
    afterSignOut(b, null, true);
    expect(b.dump()).toEqual({});
  });

  it('person B signing in after person A signed out sees none of A\'s personal data, only device settings', () => {
    const b = memoryBackend({
      'spotter.state': '{"goal":"A"}',
      'spotter.atlasChat': '[{"q":"A"}]',
      'spotter.sleep': '[7]',
      'gym.locale': 'uk',
    });
    afterSignIn(b, { uid: 'uA', name: 'Anna' }, true, 1);
    afterSignOut(b, 'uA', false);
    afterSignIn(b, { uid: 'uB', name: 'Boris' }, false, 2);
    expect(b.dump()).toEqual({
      'gym.locale': 'uk',
      'spotter.accounts': expect.any(String),
    });
    expect(readRemembered(b).map((p) => p.uid)).toEqual(['uA']); // A stays offered on the landing; B left no trace
  });

  it('an already signed-in person is untouched at startup: reading the registry changes nothing (migration)', () => {
    const seed = { 'spotter.state': '{"x":1}', 'spotter.uid': 'uA', 'gym.locale': 'pl' };
    const b = memoryBackend(seed);
    expect(readRemembered(b)).toEqual([]);
    expect(b.dump()).toEqual(seed);
  });
});
