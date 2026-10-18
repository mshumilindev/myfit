import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BeforeInstallPromptEvent } from './pwaInstall';
import { usePwaInstall } from './usePwaInstall';

const UA_DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120';
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120 Mobile';
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604';

let standalone = false;
let listeners: Record<string, () => void>;

function env(ua: string, platform = 'Linux x86_64') {
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(ua);
  vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue(platform);
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: 0, configurable: true });
}

function promptEvent(outcome: 'accepted' | 'dismissed' | 'throw') {
  const e = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent;
  Object.assign(e, {
    platforms: ['web'],
    prompt: outcome === 'throw' ? () => Promise.reject(new Error('x')) : () => Promise.resolve(),
    userChoice: Promise.resolve({
      outcome: outcome === 'throw' ? 'dismissed' : outcome,
      platform: 'web',
    }),
  });
  return e;
}

beforeEach(() => {
  standalone = false;
  listeners = {};
  window.matchMedia = vi.fn((q: string) => ({
    matches: standalone && q === '(display-mode: standalone)',
    media: q,
    addEventListener: (_: string, fn: () => void) => (listeners.change = fn),
    removeEventListener: () => delete listeners.change,
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('usePwaInstall', () => {
  it('desktop browser without a prompt event: nothing to show', () => {
    env(UA_DESKTOP);
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current).toMatchObject({
      visible: false,
      installed: false,
      brand: null,
      mode: null,
      canPrompt: false,
      guideMode: 'android-guide',
    });
  });

  it('iOS Safari: guided install, apple brand, mac-guide never chosen', () => {
    env(UA_IPHONE, 'iPhone');
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current).toMatchObject({
      visible: true,
      brand: 'apple',
      mode: 'ios-guide',
      guideMode: 'ios-guide',
      canPrompt: false,
    });
  });

  it('a beforeinstallprompt on desktop turns on the prompt mode with the android brand and is not auto-shown by the browser', () => {
    env(UA_DESKTOP);
    const { result } = renderHook(() => usePwaInstall());
    const e = promptEvent('accepted');
    act(() => void window.dispatchEvent(e));
    expect(e.defaultPrevented).toBe(true);
    expect(result.current).toMatchObject({
      visible: true,
      mode: 'prompt',
      brand: 'android',
      canPrompt: true,
    });
  });

  it('keeps the apple brand when the prompt event arrives on a Mac', () => {
    env(UA_DESKTOP, 'MacIntel');
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current).toMatchObject({ mode: 'mac-guide', brand: 'apple' });
    act(() => void window.dispatchEvent(promptEvent('accepted')));
    expect(result.current).toMatchObject({
      mode: 'prompt',
      brand: 'apple',
      guideMode: 'mac-guide',
    });
  });

  it('promptInstall: unavailable without an event', async () => {
    env(UA_ANDROID);
    const { result } = renderHook(() => usePwaInstall());
    expect(await result.current.promptInstall()).toBe('unavailable');
  });

  it('promptInstall accepted: marks installed and hides the CTA', async () => {
    env(UA_ANDROID);
    const { result } = renderHook(() => usePwaInstall());
    act(() => void window.dispatchEvent(promptEvent('accepted')));
    let out: string | undefined;
    await act(async () => {
      out = await result.current.promptInstall();
    });
    expect(out).toBe('accepted');
    expect(result.current).toMatchObject({ installed: true, visible: false, canPrompt: false });
  });

  it('promptInstall dismissed: event is consumed, not installed', async () => {
    env(UA_ANDROID);
    const { result } = renderHook(() => usePwaInstall());
    act(() => void window.dispatchEvent(promptEvent('dismissed')));
    let out: string | undefined;
    await act(async () => {
      out = await result.current.promptInstall();
    });
    expect(out).toBe('dismissed');
    expect(result.current).toMatchObject({
      installed: false,
      canPrompt: false,
      mode: 'android-guide',
    });
  });

  it('promptInstall that throws resolves to unavailable and drops the event', async () => {
    env(UA_ANDROID);
    const { result } = renderHook(() => usePwaInstall());
    act(() => void window.dispatchEvent(promptEvent('throw')));
    let out: string | undefined;
    await act(async () => {
      out = await result.current.promptInstall();
    });
    expect(out).toBe('unavailable');
    expect(result.current.canPrompt).toBe(false);
  });

  it('already running standalone: installed, never visible', () => {
    env(UA_ANDROID);
    standalone = true;
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current).toMatchObject({ installed: true, visible: false });
  });

  it('reacts to display-mode changes and to appinstalled', () => {
    env(UA_ANDROID);
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.installed).toBe(false);
    standalone = true;
    act(() => listeners.change());
    expect(result.current.installed).toBe(true);
    standalone = false;
    act(() => listeners.change());
    expect(result.current.installed).toBe(false);
    standalone = true;
    act(() => void window.dispatchEvent(new Event('appinstalled')));
    expect(result.current.installed).toBe(true);
  });

  it('unsubscribes on unmount (later events change nothing, no listener left)', () => {
    env(UA_ANDROID);
    const { unmount } = renderHook(() => usePwaInstall());
    unmount();
    expect(listeners.change).toBeUndefined();
    const e = promptEvent('accepted');
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it('works without matchMedia (old WebView): not installed, no crash', () => {
    env(UA_ANDROID);
    (window as { matchMedia?: unknown }).matchMedia = undefined;
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current).toMatchObject({ installed: false, visible: true });
  });
});
