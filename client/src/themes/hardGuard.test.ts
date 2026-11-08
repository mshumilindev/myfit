import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A fresh registry per test: its installed set is "not read yet" (null), as at the very start of the app.
async function fresh() {
  vi.resetModules();
  return import('./registry');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  localStorage.clear();
  document.documentElement.lang = 'en';
  document.documentElement.removeAttribute('data-theme');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('hard guard: what is not installed is never worn (SPO-500, owner 08.11)', () => {
  it('before the installed set is read only the base look can be worn, not even for a frame', async () => {
    localStorage.setItem('gym.theme', 'cyberpunk');
    const r = await fresh();
    r.initTheme();
    expect(r.getTheme()).toBe(r.DEFAULT_THEME);
    expect(r.availablePickableThemes().map((t) => t.id)).toEqual([r.DEFAULT_THEME]);
  });
  it('inside a holiday window nothing switches on without the Holiday themes add-on', async () => {
    vi.setSystemTime(new Date(2026, 9, 30, 12));
    const r = await fresh();
    r.initTheme();
    expect(r.getTheme()).toBe(r.DEFAULT_THEME);
    r.setAllowedThemes([]);
    expect(r.getTheme()).toBe(r.DEFAULT_THEME);
    r.setAllowedThemes(['halloween', 'christmas']);
    expect(r.getTheme()).toBe('halloween');
  });
});
