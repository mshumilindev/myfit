import { afterEach, describe, expect, it, vi } from 'vitest';
import { shouldShowLanding } from './landingGate';

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
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('fullscreen') }) as MediaQueryList);
    expect(shouldShowLanding()).toBe(true);
  });
  it('is hidden in an installed PWA (standalone)', () => {
    vi.stubGlobal('matchMedia', matchMedia(true));
    expect(shouldShowLanding()).toBe(false);
  });
  it('is hidden inside the desktop shell', () => {
    vi.stubGlobal('matchMedia', matchMedia(false));
    (window as unknown as Record<string, unknown>).spotterNative = {};
    expect(shouldShowLanding()).toBe(false);
  });
});
