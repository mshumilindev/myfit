/**
 * Alcohol: which region's conventions to use (pure, no store). The region decides
 *  - the size of one "standard drink" in grams of pure alcohol (US 14 g, UK unit 8 g, ...),
 *  - which measures are shown (ml / L, US oz, UK pint),
 *  - which low-risk weekly guideline is shown as the reference line.
 *
 * It is resolved WITHOUT any new permission prompt, in this order:
 *  1. the user's manual choice (`settings.regionOverride`);
 *  2. the last position the app already holds (`spotter.lastPos`, written by the gym
 *     feature's single location read; this file only READS it, it never asks for one);
 *  3. the device time zone;
 *  4. the browser language's country (en-US, en-GB, ...);
 *  5. 'eu' (10 g, ml / L, WHO-style default).
 */
import type { AlcoholRegion } from './types';

export const ALCOHOL_REGIONS: readonly AlcoholRegion[] = ['eu', 'us', 'uk', 'au', 'ca'];
export const isAlcoholRegion = (v: unknown): v is AlcoholRegion =>
  typeof v === 'string' && (ALCOHOL_REGIONS as readonly string[]).includes(v);

export type MeasureSystem = 'metric' | 'us' | 'uk';

export interface AlcoholRegionInfo {
  region: AlcoholRegion;
  /** Grams of pure alcohol in one standard drink / unit of this region. */
  gramsPerDrink: number;
  /** What the region calls it: a "standard drink" or a "unit". */
  drinkWord: 'drink' | 'unit';
  measure: MeasureSystem;
}

export const REGION_INFO: Record<AlcoholRegion, AlcoholRegionInfo> = {
  eu: { region: 'eu', gramsPerDrink: 10, drinkWord: 'drink', measure: 'metric' },
  // NIAAA / CDC: 14 g (0.6 fl oz) of pure alcohol.
  us: { region: 'us', gramsPerDrink: 14, drinkWord: 'drink', measure: 'us' },
  // UK unit: 10 ml = 8 g of pure alcohol.
  uk: { region: 'uk', gramsPerDrink: 8, drinkWord: 'unit', measure: 'uk' },
  // Australian standard drink: 10 g.
  au: { region: 'au', gramsPerDrink: 10, drinkWord: 'drink', measure: 'metric' },
  // Canadian standard drink: 17.05 ml = 13.45 g.
  ca: { region: 'ca', gramsPerDrink: 13.45, drinkWord: 'drink', measure: 'metric' },
};

export const regionInfo = (r: AlcoholRegion): AlcoholRegionInfo => REGION_INFO[r];

// --- Detection ----------------------------------------------------------------------------------

/**
 * A very coarse position -> region. Boxes are deliberately loose (borders are not exact);
 * a fix outside every box is 'eu' (the default conventions). Canada is tested before the
 * US so the 49th parallel works, Ireland (about 10 g) is left out of the UK box.
 */
export function regionFromPosition(lat: number, lng: number): AlcoholRegion | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat > 49 && lat < 84 && lng > -141 && lng < -52) return 'ca';
  if (lat > 24 && lat <= 49 && lng > -125 && lng < -66) return 'us';
  if (lat > 51 && lat < 72 && lng > -170 && lng <= -141) return 'us'; // Alaska
  if (lat > 18 && lat < 23 && lng > -161 && lng < -154) return 'us'; // Hawaii
  if (lat > -45 && lat < -9 && lng > 112 && lng < 155) return 'au';
  if (lat > 49.8 && lat < 61 && lng > -6.2 && lng < 2) return 'uk';
  if (lat > 54 && lat < 61 && lng > -8.7 && lng <= -6.2) return 'uk'; // Hebrides, N. Ireland north
  return 'eu';
}

const US_ZONE =
  /^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Honolulu|Detroit|Boise|Juneau|Sitka|Nome|Adak|Metlakatla|Yakutat|Menominee|North_Dakota\/.*|Indiana\/.*|Kentucky\/.*)|US\/.*|Pacific\/Honolulu)$/;
const CA_ZONE =
  /^(America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Montreal|Moncton|Glace_Bay|Goose_Bay|Whitehorse|Dawson|Iqaluit|Yellowknife|Rankin_Inlet|Resolute|Cambridge_Bay|Inuvik|Thunder_Bay|Nipigon|Swift_Current|Atikokan|Blanc-Sablon|Creston|Fort_Nelson|Dawson_Creek|Rainy_River|Pangnirtung)|Canada\/.*)$/;

/** IANA time zone -> region, or null when it says nothing. */
export function regionFromTimeZone(tz: string | null | undefined): AlcoholRegion | null {
  if (!tz) return null;
  if (US_ZONE.test(tz)) return 'us';
  if (CA_ZONE.test(tz)) return 'ca';
  if (tz.startsWith('Australia/')) return 'au';
  if (/^Europe\/(London|Belfast|Jersey|Guernsey|Isle_of_Man)$/.test(tz) || tz === 'GB') return 'uk';
  return null;
}

/** BCP-47 language tag -> region from its country part, or null. */
export function regionFromLanguage(lang: string | null | undefined): AlcoholRegion | null {
  const m = /^[a-z]{2,3}[-_]([A-Za-z]{2})\b/.exec(lang ?? '');
  const c = m?.[1].toUpperCase();
  if (c === 'US') return 'us';
  if (c === 'GB') return 'uk';
  if (c === 'AU') return 'au';
  if (c === 'CA') return 'ca';
  return null;
}

export interface RegionSignals {
  /** The last position the app holds. */
  position?: { lat: number; lng: number } | null;
  timeZone?: string | null;
  language?: string | null;
}

/** Pure: the first signal that knows wins. */
export function detectAlcoholRegion(s: RegionSignals): AlcoholRegion {
  if (s.position) {
    const r = regionFromPosition(s.position.lat, s.position.lng);
    if (r) return r;
  }
  return regionFromTimeZone(s.timeZone) ?? regionFromLanguage(s.language) ?? 'eu';
}

/** The key the gym feature caches its single location read under (read-only here). */
export const LAST_POSITION_KEY = 'spotter.lastPos';

/** Reads the signals from this device. Never asks for a permission; every step may fail. */
export function readDeviceSignals(): RegionSignals {
  const out: RegionSignals = {};
  try {
    const raw = localStorage.getItem(LAST_POSITION_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { lat?: unknown; lng?: unknown };
      if (typeof p?.lat === 'number' && typeof p?.lng === 'number')
        out.position = { lat: p.lat, lng: p.lng };
    }
  } catch {
    /* no storage / corrupt */
  }
  try {
    out.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    /* no Intl */
  }
  try {
    out.language = typeof navigator !== 'undefined' ? navigator.language : null;
  } catch {
    /* no navigator */
  }
  return out;
}

let detected: AlcoholRegion | null = null;
/** The detected region of this device, resolved once per page session. */
export function deviceAlcoholRegion(): AlcoholRegion {
  if (detected === null) detected = detectAlcoholRegion(readDeviceSignals());
  return detected;
}
/** Test hook: forget the cached detection. */
export function resetDeviceAlcoholRegion(): void {
  detected = null;
}

/** The region in force: the manual choice, else the detected one. */
export const resolveAlcoholRegion = (override?: AlcoholRegion | null): AlcoholRegion =>
  isAlcoholRegion(override) ? override : deviceAlcoholRegion();

// --- Reference line (informational) -----------------------------------------------------------

export type GuidelineConfidence = 'moderate' | 'weak';

export interface AlcoholGuideline {
  region: AlcoholRegion;
  /** Weekly low-risk guideline, grams of pure alcohol. */
  weeklyGrams: number;
  /** A second official figure where the source gives one (US: men's 14 drinks). */
  weeklyGramsHigher?: number;
  /** Short citation, not translated. */
  source: string;
  confidence: GuidelineConfidence;
}

/**
 * The national low-risk weekly figures, shown as an informational reference line only (never a
 * target, never a diagnosis). WHO sets no safe level; the 'eu' line is a generic round figure.
 */
export const GUIDELINES: Record<AlcoholRegion, AlcoholGuideline> = {
  eu: {
    region: 'eu',
    weeklyGrams: 100,
    source:
      'No single EU figure; a generic reference of about 100 g a week, not an official limit. WHO: no level of alcohol use is without risk',
    confidence: 'weak',
  },
  us: {
    region: 'us',
    weeklyGrams: 98,
    weeklyGramsHigher: 196,
    source:
      'NIAAA low-risk drinking: up to 7 drinks a week for women, 14 for men (1 drink = 14 g); US Dietary Guidelines 2020-2025: 1 (women) / 2 (men) a day or less (figure not re-verified)',
    confidence: 'weak',
  },
  uk: {
    region: 'uk',
    weeklyGrams: 112,
    source:
      'UK Chief Medical Officers 2016: 14 units a week for men and women (1 unit = 8 g) (figure not re-verified)',
    confidence: 'weak',
  },
  au: {
    region: 'au',
    weeklyGrams: 100,
    source:
      'NHMRC 2020: no more than 10 standard drinks a week (1 drink = 10 g) (figure not re-verified)',
    confidence: 'weak',
  },
  ca: {
    region: 'ca',
    weeklyGrams: 26.9,
    source:
      'Canadian Guidance on Alcohol and Health (CCSA 2023): 2 standard drinks a week or less is low risk (1 drink = 13.45 g)',
    confidence: 'moderate',
  },
};

export const guidelineFor = (r: AlcoholRegion): AlcoholGuideline => GUIDELINES[r];

/**
 * "Heavy for this app": the weekly amount above the region's low-risk guideline. It is the
 * one cutoff the UI uses for a "more than the guideline" note (informational, not a diagnosis).
 */
export const heavyThresholdGrams = (r: AlcoholRegion): number => GUIDELINES[r].weeklyGrams;
export const isAboveGuideline = (weeklyGrams: number, r: AlcoholRegion): boolean =>
  weeklyGrams > heavyThresholdGrams(r);
