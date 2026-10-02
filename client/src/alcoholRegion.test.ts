import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ALCOHOL_REGIONS,
  GUIDELINES,
  LAST_POSITION_KEY,
  REGION_INFO,
  detectAlcoholRegion,
  deviceAlcoholRegion,
  guidelineFor,
  isAlcoholRegion,
  readDeviceSignals,
  regionFromLanguage,
  regionFromPosition,
  regionFromTimeZone,
  resetDeviceAlcoholRegion,
  resolveAlcoholRegion,
} from './alcoholRegion';

afterEach(() => {
  resetDeviceAlcoholRegion();
  vi.restoreAllMocks();
  try {
    localStorage.clear();
  } catch {
    /* none */
  }
});

describe('region info', () => {
  it('standard drink sizes: EU 10 g, US 14 g, UK unit 8 g, AU 10 g, CA 13.45 g', () => {
    expect(ALCOHOL_REGIONS.map((r) => REGION_INFO[r].gramsPerDrink)).toEqual([
      10, 14, 8, 10, 13.45,
    ]);
    expect(REGION_INFO.uk.drinkWord).toBe('unit');
    expect(REGION_INFO.us.measure).toBe('us');
    expect(REGION_INFO.eu.measure).toBe('metric');
  });
  it('isAlcoholRegion', () => {
    expect(isAlcoholRegion('us')).toBe(true);
    expect(isAlcoholRegion('de')).toBe(false);
    expect(isAlcoholRegion(undefined)).toBe(false);
  });
});

describe('detection', () => {
  it('position: cities of each region', () => {
    expect(regionFromPosition(40.71, -74.0)).toBe('us'); // New York
    expect(regionFromPosition(34.05, -118.24)).toBe('us');
    expect(regionFromPosition(61.2, -149.9)).toBe('us'); // Anchorage
    expect(regionFromPosition(21.3, -157.86)).toBe('us'); // Honolulu
    expect(regionFromPosition(43.65, -79.38)).toBe('us'); // Toronto is south of the 49th: box is coarse
    expect(regionFromPosition(53.55, -113.49)).toBe('ca'); // Edmonton
    expect(regionFromPosition(51.5, -0.12)).toBe('uk'); // London
    expect(regionFromPosition(55.95, -3.19)).toBe('uk'); // Edinburgh
    expect(regionFromPosition(-33.87, 151.2)).toBe('au'); // Sydney
    expect(regionFromPosition(53.35, -6.26)).toBe('eu'); // Dublin is not the UK
    expect(regionFromPosition(48.85, 2.35)).toBe('eu'); // Paris
    expect(regionFromPosition(59.43, 24.75)).toBe('eu'); // Tallinn
    expect(regionFromPosition(Number.NaN, 0)).toBeNull();
  });

  it('time zone', () => {
    expect(regionFromTimeZone('America/Chicago')).toBe('us');
    expect(regionFromTimeZone('America/Indiana/Knox')).toBe('us');
    expect(regionFromTimeZone('America/Toronto')).toBe('ca');
    expect(regionFromTimeZone('Australia/Perth')).toBe('au');
    expect(regionFromTimeZone('Europe/London')).toBe('uk');
    expect(regionFromTimeZone('Europe/Kyiv')).toBeNull();
    expect(regionFromTimeZone('')).toBeNull();
    expect(regionFromTimeZone(undefined)).toBeNull();
  });

  it('language country', () => {
    expect(regionFromLanguage('en-US')).toBe('us');
    expect(regionFromLanguage('en-GB')).toBe('uk');
    expect(regionFromLanguage('en_AU')).toBe('au');
    expect(regionFromLanguage('fr-CA')).toBe('ca');
    expect(regionFromLanguage('uk')).toBeNull();
    expect(regionFromLanguage('et-EE')).toBeNull();
  });

  it('priority: position, then time zone, then language, then the EU default', () => {
    expect(
      detectAlcoholRegion({ position: { lat: 51.5, lng: -0.1 }, timeZone: 'America/Chicago' }),
    ).toBe('uk');
    expect(
      detectAlcoholRegion({ position: null, timeZone: 'America/Chicago', language: 'en-GB' }),
    ).toBe('us');
    expect(detectAlcoholRegion({ timeZone: 'Europe/Kyiv', language: 'en-GB' })).toBe('uk');
    expect(detectAlcoholRegion({ timeZone: 'Europe/Kyiv', language: 'uk-UA' })).toBe('eu');
    expect(detectAlcoholRegion({})).toBe('eu');
  });

  it('reads the position the gym feature already cached, and never asks for one', () => {
    const geo = vi.fn();
    vi.stubGlobal('navigator', { language: 'de-DE', geolocation: { getCurrentPosition: geo } });
    localStorage.setItem(
      LAST_POSITION_KEY,
      JSON.stringify({ lat: 40.7, lng: -74, accuracy: 9, at: 1 }),
    );
    expect(readDeviceSignals().position).toEqual({ lat: 40.7, lng: -74 });
    expect(deviceAlcoholRegion()).toBe('us');
    expect(geo).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('survives corrupt storage', () => {
    localStorage.setItem(LAST_POSITION_KEY, '{nope');
    expect(() => readDeviceSignals()).not.toThrow();
    expect(readDeviceSignals().position).toBeUndefined();
  });

  it('the manual override beats detection; absent override uses the device', () => {
    vi.stubGlobal('navigator', { language: 'en-GB' });
    expect(resolveAlcoholRegion('au')).toBe('au');
    expect(resolveAlcoholRegion(undefined)).toBe(deviceAlcoholRegion());
    expect(resolveAlcoholRegion('nope' as never)).toBe(deviceAlcoholRegion());
    vi.unstubAllGlobals();
  });
});

describe('reference line', () => {
  it('has a sourced, positive weekly figure for every region', () => {
    for (const r of ALCOHOL_REGIONS) {
      const g = guidelineFor(r);
      expect(g.weeklyGrams).toBeGreaterThan(0);
      expect(g.source.length).toBeGreaterThan(20);
      expect(['moderate', 'weak']).toContain(g.confidence);
    }
  });
  it('matches the official figures', () => {
    expect(GUIDELINES.uk.weeklyGrams).toBe(14 * 8); // 14 units
    expect(GUIDELINES.au.weeklyGrams).toBe(10 * 10); // 10 standard drinks
    expect(GUIDELINES.us.weeklyGrams).toBe(7 * 14);
    expect(GUIDELINES.us.weeklyGramsHigher).toBe(14 * 14);
    expect(GUIDELINES.ca.weeklyGrams).toBeCloseTo(2 * 13.45, 1);
    expect(GUIDELINES.eu.confidence).toBe('weak');
  });
});
