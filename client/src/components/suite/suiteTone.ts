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

/** The icon of each app (its launcher tile; also the BrandBar switcher chip). */
export const SUITE_ICON: Record<SuiteApp, string> = {
  gym: 'barbell',
  apex: 'trophy',
  roster: 'user-focus',
  nutrition: 'fork-knife',
  learn: 'graduation-cap',
  coach: 'chalkboard-teacher',
};
