import { afterEach, describe, expect, it, vi } from 'vitest';
import { isIosStandalone, navigateHash } from './navigateHash';
import { currentHash } from './route';

const setEnv = (ua: string, standalone: boolean) => {
  vi.stubGlobal('navigator', { userAgent: ua, platform: 'iPhone', maxTouchPoints: 5, standalone });
};

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('navigateHash', () => {
  it('pushes a normal hash change outside an iOS home-screen app', () => {
    setEnv('Mozilla/5.0 (Macintosh)', false);
    const spy = vi.spyOn(window.history, 'replaceState');
    navigateHash('#/trainer/chat');
    expect(currentHash()).toBe('#/trainer/chat');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('replaces the entry and fires hashchange in an iOS home-screen app', () => {
    setEnv('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', true);
    expect(isIosStandalone()).toBe(true);
    const before = window.history.length;
    const onHash = vi.fn();
    window.addEventListener('hashchange', onHash);
    navigateHash('#/trainer/chat');
    window.removeEventListener('hashchange', onHash);
    expect(currentHash()).toBe('#/trainer/chat');
    expect(window.history.length).toBe(before);
    expect(onHash).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the hash is already there', () => {
    setEnv('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', true);
    window.history.replaceState(null, '', '#/a');
    const onHash = vi.fn();
    window.addEventListener('hashchange', onHash);
    navigateHash('#/a');
    window.removeEventListener('hashchange', onHash);
    expect(onHash).not.toHaveBeenCalled();
  });
});
