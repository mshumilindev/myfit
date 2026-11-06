import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_THEME, THEMES, getTheme, initTheme, setTheme, setThemesAllowed } from './registry';

const other = THEMES.find((t) => t.id !== DEFAULT_THEME)!.id;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});
afterEach(() => setThemesAllowed(true));

describe('Themes add-on gate (SPO-518)', () => {
  it('without the add-on the base theme shows, and the saved choice comes back with it', () => {
    localStorage.setItem('gym.theme', other);
    initTheme();
    expect(getTheme()).toBe(other);
    setThemesAllowed(false);
    expect(getTheme()).toBe(DEFAULT_THEME);
    expect(localStorage.getItem('gym.theme')).toBe(other);
    setThemesAllowed(true);
    expect(getTheme()).toBe(other);
  });

  it('a pick made while the add-on is off is saved but does not change the look', () => {
    initTheme();
    setThemesAllowed(false);
    setTheme(other);
    expect(getTheme()).toBe(DEFAULT_THEME);
    setThemesAllowed(true);
    expect(getTheme()).toBe(other);
  });
});
