import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  AXES,
  DEFAULT_THEME,
  THEMES,
  getAxis,
  getTheme,
  initAxes,
  initTheme,
  setAxis,
  setTheme,
  useAxis,
  useTheme,
} from './registry';
import { SKIN_TOKENS_OPTIONAL, SKIN_TOKENS_REQUIRED, THEME_SKINS, THEME_TOKENS } from './contract';
import { offSeason } from './testClock';

offSeason();

const html = () => document.documentElement;

beforeEach(() => {
  localStorage.clear();
  html().removeAttribute('data-theme');
  for (const a of Object.values(AXES)) html().removeAttribute(a.attr);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('theme registry', () => {
  it('lists the default theme and reads the attribute on <html>, falling back to the default', () => {
    expect(THEMES.some((t) => t.id === DEFAULT_THEME)).toBe(true);
    expect(getTheme()).toBe(DEFAULT_THEME);
    html().setAttribute('data-theme', 'no-such-theme');
    expect(getTheme()).toBe(DEFAULT_THEME);
    html().setAttribute('data-theme', DEFAULT_THEME);
    expect(getTheme()).toBe(DEFAULT_THEME);
  });

  it('initTheme applies the saved theme, or the default when nothing valid is saved', () => {
    initTheme();
    expect(html().getAttribute('data-theme')).toBe(DEFAULT_THEME);
    localStorage.setItem('gym.theme', 'unknown');
    initTheme();
    expect(html().getAttribute('data-theme')).toBe(DEFAULT_THEME);
    localStorage.setItem('gym.theme', DEFAULT_THEME);
    initTheme();
    expect(html().getAttribute('data-theme')).toBe(DEFAULT_THEME);
  });

  it('initTheme survives unavailable storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => initTheme()).not.toThrow();
    expect(html().getAttribute('data-theme')).toBe(DEFAULT_THEME);
  });

  it('setTheme ignores unknown ids, persists a known one and notifies subscribers', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current).toBe(DEFAULT_THEME);
    act(() => setTheme('no-such-theme'));
    expect(localStorage.getItem('gym.theme')).toBeNull();
    act(() => setTheme(DEFAULT_THEME));
    expect(localStorage.getItem('gym.theme')).toBe(DEFAULT_THEME);
    expect(result.current).toBe(DEFAULT_THEME);
  });

  it('setTheme still applies the theme when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => setTheme(DEFAULT_THEME)).not.toThrow();
    expect(html().getAttribute('data-theme')).toBe(DEFAULT_THEME);
  });
});

describe('look axes (mode / accent / density)', () => {
  it('every axis lists its default first and starts on it', () => {
    for (const [name, def] of Object.entries(AXES)) {
      expect(def.values[0]).toBe(def.default);
      expect(getAxis(name as keyof typeof AXES)).toBe(def.default);
    }
  });

  it('getAxis falls back to the default for an unknown attribute value', () => {
    html().setAttribute(AXES.density.attr, 'huge');
    expect(getAxis('density')).toBe(AXES.density.default);
  });

  it('initAxes writes every axis to <html>, using a saved known value', () => {
    localStorage.setItem(AXES.accent.key, AXES.accent.default);
    localStorage.setItem(AXES.density.key, 'nope');
    initAxes();
    for (const a of Object.values(AXES)) expect(html().getAttribute(a.attr)).toBe(a.default);
  });

  it('initAxes survives unavailable storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => initAxes()).not.toThrow();
    expect(html().getAttribute(AXES.mode.attr)).toBe(AXES.mode.default);
  });

  it('setAxis ignores unknown values, persists known ones and notifies useAxis', () => {
    const { result } = renderHook(() => useAxis('mode'));
    expect(result.current).toBe(AXES.mode.default);
    act(() => setAxis('mode', 'sepia'));
    expect(localStorage.getItem(AXES.mode.key)).toBeNull();
    act(() => setAxis('mode', AXES.mode.default));
    expect(localStorage.getItem(AXES.mode.key)).toBe(AXES.mode.default);
    expect(html().getAttribute(AXES.mode.attr)).toBe(AXES.mode.default);
  });

  it('setAxis still applies the value when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => setAxis('accent', AXES.accent.default)).not.toThrow();
    expect(html().getAttribute(AXES.accent.attr)).toBe(AXES.accent.default);
  });
});

describe('theme contract constants', () => {
  it('lists unique custom properties, and the skin tokens do not overlap each other', () => {
    expect(new Set(THEME_TOKENS).size).toBe(THEME_TOKENS.length);
    for (const t of [...THEME_TOKENS, ...SKIN_TOKENS_REQUIRED, ...SKIN_TOKENS_OPTIONAL])
      expect(t.startsWith('--')).toBe(true);
    const skin = [...SKIN_TOKENS_REQUIRED, ...SKIN_TOKENS_OPTIONAL];
    expect(new Set(skin).size).toBe(skin.length);
    expect(THEME_SKINS).toEqual(['apex', 'learn', 'roster', 'nutrition', 'coach']);
  });
});
