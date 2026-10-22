/** React side of `data/geoSearchGate.ts`: read the switch, open the prompt, ask once at the first search surface. */
import { useEffect, useSyncExternalStore } from 'react';
import {
  geoSnapshot,
  isGeoPromptOpen,
  openGeoPrompt,
  shouldAutoAskGeo,
  subscribeGeo,
} from '../data/geoSearchGate';

/** Gym search and maps may call outside services (the person consented, at the current version, not withdrawn). */
export function useGeoSearchOn(): boolean {
  return useSyncExternalStore(subscribeGeo, () => geoSnapshot().on);
}

export function useGeoPromptOpen(): boolean {
  return useSyncExternalStore(subscribeGeo, isGeoPromptOpen);
}

/**
 * Put on a screen that is a gym search or map surface: the first time, for a person who was never asked, it opens the
 * consent prompt (before any call). After "Not now" or a withdrawal it stays quiet; the surface shows "Turn on".
 */
export function useAskGeoConsent(): void {
  const { on, ready, answered } = useSyncExternalStore(subscribeGeo, geoSnapshot);
  useEffect(() => {
    if (shouldAutoAskGeo()) openGeoPrompt();
  }, [on, ready, answered]);
}
