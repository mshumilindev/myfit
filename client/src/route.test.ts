import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  currentHash,
  hashToUrl,
  normalizeLegacyHash,
  pushHash,
  replaceHash,
  setHash,
} from './route';

beforeEach(() => window.history.replaceState(null, '', '/'));
afterEach(() => vi.restoreAllMocks());

describe('clean-URL routing', () => {
  it('maps hash routes to clean paths', () => {
    expect(hashToUrl('#/today')).toBe('/today');
    expect(hashToUrl('#/c/chat?with=ab')).toBe('/c/chat?with=ab');
    expect(hashToUrl('today')).toBe('/today');
    expect(hashToUrl('')).toBe('/');
    expect(hashToUrl('#/')).toBe('/');
  });

  it('currentHash gives the legacy shape of the real path', () => {
    window.history.replaceState(null, '', '/coach/chat?with=ab');
    expect(currentHash()).toBe('#/coach/chat?with=ab');
    window.history.replaceState(null, '', '/');
    expect(currentHash()).toBe('');
  });

  it('setHash pushes a clean URL and notifies hashchange listeners', () => {
    const on = vi.fn();
    window.addEventListener('hashchange', on);
    setHash('#/today');
    expect(window.location.pathname).toBe('/today');
    expect(currentHash()).toBe('');
    expect(on).toHaveBeenCalledTimes(1);
    setHash('#/today'); // same route: nothing happens, like assigning the same hash
    expect(on).toHaveBeenCalledTimes(1);
    window.removeEventListener('hashchange', on);
  });

  it('setHash(…, true) replaces instead of pushing', () => {
    const before = window.history.length;
    setHash('#/progress', true);
    expect(window.history.length).toBe(before);
    expect(window.location.pathname).toBe('/progress');
  });

  it('pushHash / replaceHash are silent', () => {
    const on = vi.fn();
    window.addEventListener('hashchange', on);
    pushHash('#/a');
    replaceHash('#/b');
    expect(window.location.pathname).toBe('/b');
    expect(on).not.toHaveBeenCalled();
    window.removeEventListener('hashchange', on);
  });

  it('rewrites a legacy /#/route link (invite, push, bookmark) to the clean path', () => {
    window.history.replaceState(null, '', '/#/join/abc-123');
    expect(currentHash()).toBe('#/join/abc-123');
    normalizeLegacyHash();
    expect(window.location.pathname).toBe('/join/abc-123');
    expect(currentHash()).toBe('');
    expect(currentHash()).toBe('#/join/abc-123');
  });
});
