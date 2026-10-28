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

describe('look axes and language (SPO-389)', () => {
  it('writes the language the person picks, once, and not the one that came from the account', async () => {
    const { setLocale, getLocale } = await import('../i18n');
    const write = vi.fn();
    stop = pushThemeEdits(write);
    setLocale('pl');
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith({ locale: 'pl' });
    syncThemeFromDoc({ locale: 'lt' } as never, write);
    const { syncAxesAndLocaleFromDoc } = await import('./themeSync');
    syncAxesAndLocaleFromDoc({ locale: 'lt' }, write);
    expect(getLocale()).toBe('lt');
    expect(write).toHaveBeenCalledTimes(1);
    setLocale('en');
  });
  it('ignores an unknown language or axis value from a newer build', async () => {
    const { getLocale } = await import('../i18n');
    const { syncAxesAndLocaleFromDoc } = await import('./themeSync');
    const write = vi.fn();
    const before = getLocale();
    syncAxesAndLocaleFromDoc({ locale: 'xx', themeMode: 'neon', themeAccent: 5 }, write);
    expect(getLocale()).toBe(before);
    expect(document.documentElement.getAttribute('data-mode')).not.toBe('neon');
    expect(write).not.toHaveBeenCalled();
  });
  it('a device that picked a language sends it when the account has none; a default axis is not sent', async () => {
    const { setLocale } = await import('../i18n');
    const { syncAxesAndLocaleFromDoc } = await import('./themeSync');
    setLocale('et');
    localStorage.setItem('gym.mode', 'dark');
    const write = vi.fn();
    syncAxesAndLocaleFromDoc({}, write);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith({ locale: 'et' });
    setLocale('en');
  });
  it('an axis choice is written under its own field and a remote one is not echoed', async () => {
    const { setAxis, applyRemoteAxis } = await import('./registry');
    const write = vi.fn();
    stop = pushThemeEdits(write);
    setAxis('density', 'regular');
    expect(write).toHaveBeenCalledWith({ themeDensity: 'regular' });
    write.mockClear();
    applyRemoteAxis('density', 'regular');
    expect(write).not.toHaveBeenCalled();
  });
});
