import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** The look's bundle, held back until the test lets it through. */
let release: () => void = () => undefined;
let fail: (e: Error) => void = () => undefined;

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  document.documentElement.setAttribute('data-theme', 'studio');
  const held = new Promise((resolve, reject) => {
    release = () => resolve({ BUNDLE: 'cyberpunk' });
    fail = reject;
  });
  vi.doMock('./bundles/cyberpunk', () => held);
});
afterEach(() => {
  vi.doUnmock('./bundles/cyberpunk');
  vi.restoreAllMocks();
});

describe('looks load on demand (SPO-500 I8)', () => {
  it('the base look and looks without a bundle are always ready; a bundled look is not until loaded', async () => {
    const l = await import('./lazy');
    expect(l.themeCssReady('studio')).toBe(true);
    expect(l.themeCssReady('cyberpunk')).toBe(false);
    const p = l.loadThemeCss('cyberpunk');
    expect(l.loadThemeCss('cyberpunk')).toBe(p);
    release();
    await p;
    expect(l.themeCssReady('cyberpunk')).toBe(true);
  });

  it('wears the look only once its styles are in, and keeps the current one meanwhile', async () => {
    const r = await import('./registry');
    r.initTheme();
    r.setAllowedThemes(['cyberpunk']);
    r.setTheme('cyberpunk');
    expect(r.getTheme()).toBe('studio');
    release();
    await vi.waitFor(() => expect(r.getTheme()).toBe('cyberpunk'));
  });

  it('does not wear a look that is no longer wanted when its styles arrive late', async () => {
    const r = await import('./registry');
    r.initTheme();
    r.setAllowedThemes(['cyberpunk']);
    r.setTheme('cyberpunk');
    r.setTheme('studio');
    release();
    await new Promise((res) => setTimeout(res, 20));
    expect(r.getTheme()).toBe('studio');
  });

  it('reports a failed fetch and keeps the current look', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const r = await import('./registry');
    r.initTheme();
    r.setAllowedThemes(['cyberpunk']);
    r.setTheme('cyberpunk');
    fail(new Error('offline'));
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    expect(r.getTheme()).toBe('studio');
  });

  it('every bundled look has a loader, and marking all ready skips the wait', async () => {
    for (const id of ['glass', 'halloween', 'christmas'])
      vi.doMock(`./bundles/${id}`, () => ({ BUNDLE: id }));
    const l = await import('./lazy');
    expect(l.lazyThemeIds().sort()).toEqual(['christmas', 'cyberpunk', 'glass', 'halloween']);
    for (const id of ['glass', 'halloween', 'christmas']) {
      expect(l.themeCssReady(id)).toBe(false);
      await l.loadThemeCss(id);
      expect(l.themeCssReady(id)).toBe(true);
    }
    expect(l.themeCssReady('cyberpunk')).toBe(false);
    l.markAllThemeCssReady();
    expect(l.themeCssReady('cyberpunk')).toBe(true);
  });

  it('tries a failed look again when the device comes back online, and dresses the app then', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const r = await import('./registry');
    r.initTheme();
    r.setAllowedThemes(['cyberpunk']);
    r.setTheme('cyberpunk');
    fail(new Error('offline'));
    await vi.waitFor(() => expect(console.warn).toHaveBeenCalled());
    // the second attempt gets a bundle that loads
    vi.resetModules();
    vi.doMock('./bundles/cyberpunk', () => ({ BUNDLE: 'cyberpunk' }));
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(r.getTheme()).toBe('cyberpunk'));
  });

  it('a saved look that is already installed at start is fetched, not worn before its styles', async () => {
    localStorage.setItem('gym.theme', 'cyberpunk');
    const r = await import('./registry');
    r.setAllowedThemes(['cyberpunk']);
    r.initTheme();
    expect(r.getTheme()).toBe('studio');
    release();
    await vi.waitFor(() => expect(r.getTheme()).toBe('cyberpunk'));
  });
});
