/** React side of `data/healthConsentGate.ts`: read a switch, open the prompt, ask once at the first entry. */
import { useEffect, useSyncExternalStore } from 'react';
import {
  healthPromptFeature,
  healthSnapshot,
  openHealthPrompt,
  shouldAutoAskHealth,
  subscribeHealth,
} from '../data/healthConsentGate';
import type { HealthFeature } from './consents';

export interface HealthFeatureState {
  on: boolean;
  /** The records are known: "off" is a real answer, not a cold start. */
  ready: boolean;
}

/** One feature's switch. */
export function useHealthOn(f: HealthFeature): HealthFeatureState {
  const s = useSyncExternalStore(subscribeHealth, healthSnapshot);
  return { on: s.on[f], ready: s.ready };
}

export function useHealthPromptFeature(): HealthFeature | null {
  return useSyncExternalStore(subscribeHealth, healthPromptFeature);
}

/**
 * Put on the first screen of a health feature: for a person who was never asked it opens that feature's consent prompt
 * before anything is collected. After "Not now" or a withdrawal it stays quiet; the screen shows "Turn on".
 */
export function useAskHealthConsent(f: HealthFeature): void {
  const s = useSyncExternalStore(subscribeHealth, healthSnapshot);
  useEffect(() => {
    if (shouldAutoAskHealth(f)) openHealthPrompt(f);
  }, [f, s]);
}
