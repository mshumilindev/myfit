import type { Tone } from '../ui/tones';
import type { SuiteApp } from './useSuiteAccount';

/** The colour family of each app (its launcher tile). The launcher sheet and the phone More sheet
 *  both wear the CURRENT app's family, so the two overlays read as one set. */
export const SUITE_TONE: Record<SuiteApp, Tone> = {
  gym: 'gym',
  apex: 'apex',
  roster: 'people',
  nutrition: 'kcal',
  learn: 'learn',
  coach: 'coach',
};
