import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
    expect(pickableFor([other]).map((t) => t.id)).toEqual([DEFAULT_THEME, other]);
    setAllowedThemes([other]);
    expect(availablePickableThemes()).toHaveLength(2);
  });
});
