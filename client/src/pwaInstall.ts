/**
 * PWA install / "Create a shortcut" detection.
 * Android Chrome: beforeinstallprompt → native install sheet.
 * iOS Safari: no programmatic install — guided Share → Add to Home Screen.
 * Already-installed (standalone) hides the CTA.
 */

export type PwaBrand = 'apple' | 'android';
export type PwaInstallMode = 'prompt' | 'ios-guide' | 'android-guide' | 'mac-guide';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  if (typeof window.matchMedia !== 'function') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches
  );
}

export function detectPwaPlatform(): {
  brand: PwaBrand | null;
  mode: PwaInstallMode | null;
  isIos: boolean;
  isAndroid: boolean;
  isMac: boolean;
} {
  if (typeof navigator === 'undefined') {
    return { brand: null, mode: null, isIos: false, isAndroid: false, isMac: false };
  }
  const ua = navigator.userAgent;
  const platform = navigator.platform || '';
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as MacIntel with touch
    (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isMac = /Mac/i.test(platform) && !isIos;

  if (isIos) return { brand: 'apple', mode: 'ios-guide', isIos, isAndroid, isMac };
  if (isAndroid) return { brand: 'android', mode: 'android-guide', isIos, isAndroid, isMac };
  if (isMac) return { brand: 'apple', mode: 'mac-guide', isIos, isAndroid, isMac };
  // Desktop Chromium / other — brand Android only when an install prompt exists
  return { brand: null, mode: null, isIos, isAndroid, isMac };
}
