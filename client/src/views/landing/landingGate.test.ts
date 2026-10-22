import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAppShell, shouldShowLanding } from './landingGate';

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as unknown as Record<string, unknown>).spotterNative;
});

function matchMedia(standalone: boolean) {
  return (q: string) => ({ matches: standalone && q.includes('standalone') }) as MediaQueryList;
}

describe('shouldShowLanding', () => {
  it('shows in a normal browser tab', () => {
    vi.stubGlobal('matchMedia', matchMedia(false));
    expect(shouldShowLanding()).toBe(true);
  });
  it('still shows in a fullscreen browser window (F11 / macOS full screen)', () => {
    vi.stubGlobal(
      'matchMedia',
      (q: string) => ({ matches: q.includes('fullscreen') }) as MediaQueryList,
    );
    expect(shouldShowLanding()).toBe(true);
  });
  it('shows in an installed PWA and in the desktop shell too', () => {
    vi.stubGlobal('matchMedia', matchMedia(true));
    expect(shouldShowLanding()).toBe(true);
    (window as unknown as Record<string, unknown>).spotterNative = {};
    expect(shouldShowLanding()).toBe(true);
  });
});

describe('isAppShell', () => {
  it('is false in a browser tab, also when fullscreen', () => {
    vi.stubGlobal('matchMedia', matchMedia(false));
    expect(isAppShell()).toBe(false);
    vi.stubGlobal(
      'matchMedia',
      (q: string) => ({ matches: q.includes('fullscreen') }) as MediaQueryList,
    );
    expect(isAppShell()).toBe(false);
  });
  it('is true in an installed PWA (standalone)', () => {
    vi.stubGlobal('matchMedia', matchMedia(true));
    expect(isAppShell()).toBe(true);
  });
  it('is true inside the desktop shell', () => {
    vi.stubGlobal('matchMedia', matchMedia(false));
    (window as unknown as Record<string, unknown>).spotterNative = {};
    expect(isAppShell()).toBe(true);
  });
});
