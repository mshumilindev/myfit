import { describe, expect, it } from 'vitest';
import {
  haversineM,
  levenshtein,
  mergeResults,
  normalizeName,
  sameVenue,
  type PlaceResult,
} from './gymProviders';

const place = (over: Partial<PlaceResult>): PlaceResult => ({
  key: over.key ?? 'k',
  name: over.name ?? 'Gym',
  lat: over.lat ?? 50.45,
  lng: over.lng ?? 30.52,
  sources: over.sources ?? ['osm'],
  ...over,
});

describe('levenshtein', () => {
  it('should measure edit distance', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('smartass', 'smartas')).toBe(1);
  });
});

describe('normalizeName', () => {
  it('should drop noise words, case and punctuation', () => {
    expect(normalizeName('SmartAss Gym!')).toBe('smartass');
    expect(normalizeName('Sport-Life Fitness Center')).toBe('sportlife');
  });
});

describe('sameVenue (AC-SEARCH-05)', () => {
  it('should merge when within 60 m and names within 2 edits', () => {
    const a = place({ name: 'Smartass Gym', lat: 50.45, lng: 30.52 });
    const b = place({ name: 'Smartass', lat: 50.4501, lng: 30.5201, sources: ['google'] });
    expect(sameVenue(a, b)).toBe(true);
  });
  it('should not merge distant venues with same name', () => {
    const a = place({ name: 'Smartass', lat: 50.45, lng: 30.52 });
    const b = place({ name: 'Smartass', lat: 50.9, lng: 30.9, sources: ['google'] });
    expect(sameVenue(a, b)).toBe(false);
  });
  it('should merge on shared external id regardless of distance', () => {
    const a = place({ name: 'A', externalId: 'x:1', lat: 0, lng: 0 });
    const b = place({ name: 'B', externalId: 'x:1', lat: 40, lng: 40, sources: ['foursquare'] });
    expect(sameVenue(a, b)).toBe(true);
  });
});

describe('mergeResults', () => {
  it('should union sources and keep one row per venue, appending new ones', () => {
    const acc: PlaceResult[] = [];
    mergeResults(acc, [place({ name: 'Smartass Gym', sources: ['osm'] })]);
    mergeResults(acc, [
      place({ name: 'Smartass', lat: 50.4501, lng: 30.5201, sources: ['google'] }),
      place({ name: 'Other Gym', lat: 51, lng: 31, sources: ['google'] }),
    ]);
    expect(acc).toHaveLength(2);
    expect(acc[0].sources.sort()).toEqual(['google', 'osm']);
  });
  it('should fill a missing photo from the merged duplicate', () => {
    const acc = [place({ name: 'Smartass', sources: ['osm'] })];
    mergeResults(acc, [place({ name: 'Smartass', photoUrl: 'p.jpg', sources: ['google'] })]);
    expect(acc[0].photoUrl).toBe('p.jpg');
  });
});

describe('haversineM', () => {
  it('should be ~0 for the same point and grow with distance', () => {
    expect(haversineM({ lat: 50, lng: 30 }, { lat: 50, lng: 30 })).toBeCloseTo(0, 5);
    expect(haversineM({ lat: 50, lng: 30 }, { lat: 50.01, lng: 30 })).toBeGreaterThan(1000);
  });
});
