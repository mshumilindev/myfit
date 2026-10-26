import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_THEME, getTheme, getThemeStamp, setTheme, applyRemoteTheme } from './registry';
import {
  THEME_FIELD,
  THEME_STAMP_FIELD,
  pushThemeEdits,
  reconcileTheme,
  syncThemeFromDoc,
  themeFromDoc,
  themeToDoc,
} from './themeSync';

let stop: (() => void) | null = null;
beforeEach(() => {
  localStorage.clear();
  document.documentElement.setAttribute('data-theme', DEFAULT_THEME);
});
afterEach(() => {
  stop?.();
  stop = null;
  vi.useRealTimers();
});

describe('themeFromDoc', () => {
  it('reads a known id and stamp', () => {
    expect(themeFromDoc({ [THEME_FIELD]: 'cyberpunk', [THEME_STAMP_FIELD]: 5 })).toEqual({
      id: 'cyberpunk',
      at: 5,
    });
  });
  it('ignores a missing, non-string or unknown id', () => {
    expect(themeFromDoc({})).toBeNull();
    expect(themeFromDoc({ [THEME_FIELD]: 7 })).toBeNull();
    expect(themeFromDoc({ [THEME_FIELD]: 'from-the-future', [THEME_STAMP_FIELD]: 9 })).toBeNull();
  });
  it('treats a bad stamp as 0', () => {
    expect(themeFromDoc({ [THEME_FIELD]: 'glass', [THEME_STAMP_FIELD]: 'x' })?.at).toBe(0);
  });
});

describe('reconcileTheme (last-write-wins)', () => {
  const local = { id: 'glass', at: 100 };
  it('newer remote is applied', () => {
    const remote = { id: 'cyberpunk', at: 200 };
    expect(reconcileTheme(local, remote)).toEqual({ apply: remote, push: false });
  });
  it('newer local is pushed', () => {
    expect(reconcileTheme(local, { id: 'cyberpunk', at: 50 })).toEqual({ apply: null, push: true });
  });
  it('tie: remote wins when it differs, nothing when equal', () => {
    const remote = { id: 'cyberpunk', at: 100 };
    expect(reconcileTheme(local, remote)).toEqual({ apply: remote, push: false });
    expect(reconcileTheme(local, { id: 'glass', at: 100 })).toEqual({ apply: null, push: false });
  });
  it('no remote: push only a theme the user really chose', () => {
    expect(reconcileTheme(local, null)).toEqual({ apply: null, push: true });
    expect(reconcileTheme({ id: 'glass', at: 0 }, null)).toEqual({ apply: null, push: false });
  });
  it('a never-chosen device adopts the account theme and never overwrites it', () => {
    const remote = { id: 'cyberpunk', at: 1 };
    expect(reconcileTheme({ id: 'glass', at: 0 }, remote)).toEqual({ apply: remote, push: false });
  });
});

describe('registry stamping', () => {
  it('stamps only explicit choices', () => {
    expect(getThemeStamp()).toBe(0);
    vi.useFakeTimers();
    vi.setSystemTime(1234);
    setTheme('cyberpunk');
    expect(getThemeStamp()).toBe(1234);
  });
  it('a remote theme is stored with the remote stamp', () => {
    applyRemoteTheme('cyberpunk', 77);
    expect(getTheme()).toBe('cyberpunk');
    expect(getThemeStamp()).toBe(77);
    expect(localStorage.getItem('gym.theme')).toBe('cyberpunk');
  });
  it('an unknown id is not applied', () => {
    applyRemoteTheme('nope', 5);
    expect(getTheme()).toBe(DEFAULT_THEME);
    expect(getThemeStamp()).toBe(0);
  });
});

describe('syncThemeFromDoc / pushThemeEdits', () => {
  it('applies a newer account theme without writing back (no echo)', () => {
    const write = vi.fn();
    stop = pushThemeEdits(write);
    syncThemeFromDoc(themeToDoc('cyberpunk', 500), write);
    expect(getTheme()).toBe('cyberpunk');
    expect(write).not.toHaveBeenCalled();
  });
  it('pushes a newer local choice', () => {
    const write = vi.fn();
    vi.useFakeTimers();
    vi.setSystemTime(900);
    setTheme('cyberpunk');
    syncThemeFromDoc(themeToDoc('glass', 100), write);
    expect(write).toHaveBeenCalledWith(themeToDoc('cyberpunk', 900));
    expect(getTheme()).toBe('cyberpunk');
  });
  it('writes every explicit choice once', () => {
    const write = vi.fn();
    stop = pushThemeEdits(write);
    vi.useFakeTimers();
    vi.setSystemTime(42);
    setTheme('cyberpunk');
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(themeToDoc('cyberpunk', 42));
  });
  it('a default, never-chosen device writes nothing on an empty doc', () => {
    const write = vi.fn();
    syncThemeFromDoc({}, write);
    expect(write).not.toHaveBeenCalled();
  });
  it('an unknown newer account theme is never overwritten by an older local choice', () => {
    const write = vi.fn();
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    setTheme('cyberpunk');
    syncThemeFromDoc({ [THEME_FIELD]: 'from-the-future', [THEME_STAMP_FIELD]: 2000 }, write);
    expect(write).not.toHaveBeenCalledWith(expect.objectContaining({ theme: 'cyberpunk' }));
    expect(write).not.toHaveBeenCalled();
  });
  it('a far-future stamp is clamped so it cannot freeze the sync', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    expect(themeFromDoc({ [THEME_FIELD]: 'glass', [THEME_STAMP_FIELD]: 9e15 })?.at).toBeLessThan(
      2_000_000,
    );
  });
  it('ignores an unknown account theme and keeps the local one', () => {
    const write = vi.fn();
    syncThemeFromDoc({ [THEME_FIELD]: 'from-the-future', [THEME_STAMP_FIELD]: 9e12 }, write);
    expect(getTheme()).toBe(DEFAULT_THEME);
    expect(write).not.toHaveBeenCalled();
  });
});
