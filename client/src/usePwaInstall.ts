import { useCallback, useEffect, useState } from 'react';
import {
  detectPwaPlatform,
  isStandaloneDisplay,
  type BeforeInstallPromptEvent,
  type PwaBrand,
  type PwaInstallMode,
} from './pwaInstall';

export type { PwaBrand, PwaInstallMode };

export function usePwaInstall() {
  const [installed, setInstalled] = useState(() => isStandaloneDisplay());
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const base = detectPwaPlatform();

  useEffect(() => {
    const refresh = () => setInstalled(isStandaloneDisplay());
    refresh();
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(display-mode: standalone)');
    mq.addEventListener('change', refresh);
    window.addEventListener('appinstalled', refresh);
    return () => {
      mq.removeEventListener('change', refresh);
      window.removeEventListener('appinstalled', refresh);
    };
  }, []);

  useEffect(() => {
    const onBip = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  const canPrompt = deferred !== null;
  let brand: PwaBrand | null = base.brand;
  let mode: PwaInstallMode | null = base.mode;

  if (canPrompt) {
    mode = 'prompt';
    if (!brand) brand = 'android';
  }

  const guideMode: PwaInstallMode =
    base.mode ?? (brand === 'apple' ? 'mac-guide' : 'android-guide');

  const visible = !installed && brand !== null && mode !== null;

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferred) return 'unavailable';
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      setDeferred(null);
      if (outcome === 'accepted') setInstalled(true);
      return outcome;
    } catch {
      setDeferred(null);
      return 'unavailable';
    }
  }, [deferred]);

  return {
    visible,
    installed,
    brand,
    mode,
    guideMode,
    canPrompt,
    promptInstall,
  };
}
