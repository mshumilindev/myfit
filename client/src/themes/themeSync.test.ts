import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_THEME, applyRemoteTheme, getTheme, setTheme } from './registry';
import { THEME_FIELD, pushThemeEdits, syncThemeFromDoc } from './themeSync';

let stop: (() => void) | null = null;
beforeEach(() => {
  localStorage.clear();
  document.documentElement.setAttribute('data-theme', DEFAULT_THEME);
});
afterEach(() => {
  stop?.();
  stop = null;
});

describe('registry', () => {
  it('a remote theme is applied and cached, an unknown id is not', () => {
    applyRemoteTheme('cyberpunk');
    expect(getTheme()).toBe('cyberpunk');
    expect(localStorage.getItem('gym.theme')).toBe('cyberpunk');
    applyRemoteTheme('nope');
    expect(getTheme()).toBe('cyberpunk');
  });
  it('a remote theme does not fire the choice listeners', () => {
    const write = vi.fn();
    stop = pushThemeEdits(write);
    applyRemoteTheme('cyberpunk');
    expect(write).not.toHaveBeenCalled();
  });
});

describe('syncThemeFromDoc / pushThemeEdits', () => {
  it('adopts the account theme without writing back (no echo)', () => {
    const write = vi.fn();
    stop = pushThemeEdits(write);
    syncThemeFromDoc({ [THEME_FIELD]: 'cyberpunk' }, write);
    expect(getTheme()).toBe('cyberpunk');
    expect(write).not.toHaveBeenCalled();
  });
  it('the account value wins over a different cached one', () => {
    const write = vi.fn();
    setTheme('cyberpunk');
    syncThemeFromDoc({ [THEME_FIELD]: 'glass' }, write);
    expect(getTheme()).toBe('glass');
    expect(write).not.toHaveBeenCalled();
  });
  it('writes every explicit choice once', () => {
    const write = vi.fn();
    stop = pushThemeEdits(write);
    setTheme('cyberpunk');
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith({ [THEME_FIELD]: 'cyberpunk' });
  });
  it('a default device writes nothing on an empty doc', () => {
    const write = vi.fn();
    syncThemeFromDoc({}, write);
    expect(write).not.toHaveBeenCalled();
  });
  it('seeds the account from a cached non-default theme when the doc has none', () => {
    const write = vi.fn();
    setTheme('cyberpunk');
    syncThemeFromDoc({}, write);
    expect(write).toHaveBeenCalledWith({ [THEME_FIELD]: 'cyberpunk' });
  });
  it('an unknown account theme is neither applied nor overwritten', () => {
    const write = vi.fn();
    setTheme('cyberpunk');
    syncThemeFromDoc({ [THEME_FIELD]: 'from-the-future' }, write);
    expect(getTheme()).toBe('cyberpunk');
    expect(write).not.toHaveBeenCalled();
  });
  it('ignores a non-string value', () => {
    const write = vi.fn();
    syncThemeFromDoc({ [THEME_FIELD]: 7 }, write);
    expect(getTheme()).toBe(DEFAULT_THEME);
    expect(write).not.toHaveBeenCalled();
  });
});
