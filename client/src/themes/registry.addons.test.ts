import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_THEME,
  THEMES,
  availablePickableThemes,
  getTheme,
  initTheme,
  setAllowedThemes,
  setTheme,
} from './registry';
import { pickableFor } from './useThemeAccess';

const other = THEMES.find((t) => t.id !== DEFAULT_THEME && t.pickable !== false)!.id;
const holiday = THEMES.find((t) => t.holiday)!.id;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});
afterEach(() => setAllowedThemes(THEMES.map((t) => t.id)));

describe('Themes are installed one by one (SPO-518)', () => {
  it('a theme that is not installed shows the base look, and the saved choice comes back with the install', () => {
    localStorage.setItem('gym.theme', other);
    setAllowedThemes([other]);
    initTheme();
    expect(getTheme()).toBe(other);
    setAllowedThemes([]);
    expect(getTheme()).toBe(DEFAULT_THEME);
    expect(localStorage.getItem('gym.theme')).toBe(other);
    setAllowedThemes([other]);
    expect(getTheme()).toBe(other);
  });

  it('a pick made while the theme is not installed is saved but does not change the look', () => {
    initTheme();
    setAllowedThemes([]);
    setTheme(other);
    expect(getTheme()).toBe(DEFAULT_THEME);
    setAllowedThemes([other]);
    expect(getTheme()).toBe(other);
  });

  it('the base theme and the holiday themes are part of the base: always allowed', () => {
    setAllowedThemes([]);
    setTheme(DEFAULT_THEME);
    expect(getTheme()).toBe(DEFAULT_THEME);
    document.documentElement.setAttribute('data-theme', holiday);
    setAllowedThemes([]);
    expect(getTheme()).toBe(holiday);
  });

  it('the picker lists the base look plus the installed ones: one look means no Themes screen', () => {
    setAllowedThemes([]);
    expect(availablePickableThemes().map((t) => t.id)).toEqual([DEFAULT_THEME]);
    expect(pickableFor([])).toHaveLength(1);
    expect(
      pickableFor([other])
        .map((t) => t.id)
        .sort(),
    ).toEqual([DEFAULT_THEME, other].sort());
    setAllowedThemes([other]);
    expect(availablePickableThemes()).toHaveLength(2);
  });
});

describe('The holiday themes are one add-on (owner 08.11)', () => {
  const holidayIds = THEMES.filter((t) => t.holiday).map((t) => t.id);

  it('the add-on lists exactly the registry holiday themes', async () => {
    const { addonById } = await import('../addons/manifest');
    expect([...(addonById('holiday-themes')?.themeIds ?? [])].sort()).toEqual(
      [...holidayIds].sort(),
    );
  });

  it('installing the add-on allows every holiday theme, removing it allows none', async () => {
    const { themeIdsOf } = await import('../addons/enabledSet');
    expect(themeIdsOf(new Set(['holiday-themes'])).sort()).toEqual([...holidayIds].sort());
    expect(themeIdsOf(new Set())).toEqual([]);
  });

  it('without the add-on a holiday never puts its theme on, even on the day itself', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 31, 12)); // Halloween
    try {
      setAllowedThemes([]);
      initTheme();
      expect(getTheme()).toBe(DEFAULT_THEME);
      setAllowedThemes(holidayIds);
      expect(getTheme()).toBe('halloween'); // installed in the middle of the window: on at once
      setAllowedThemes([]);
      expect(getTheme()).toBe(DEFAULT_THEME); // removed: off at once
    } finally {
      vi.useRealTimers();
    }
  });
});
