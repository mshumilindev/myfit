import { describe, expect, it } from 'vitest';
import {
  AMENITY_CATALOG,
  detectAmenities,
  detectedAmenities,
  effectiveAmenities,
  hasAmenity,
  unionAmenities,
} from './gymAmenities';

describe('detectAmenities', () => {
  it('reads OSM tags', () => {
    expect(detectAmenities({ tags: { swimming_pool: 'yes', sauna: 'yes' } })).toEqual([
      'pool',
      'sauna',
    ]);
    expect(detectAmenities({ tags: { sport: 'fitness;swimming' } })).toEqual(['pool']);
    expect(detectAmenities({ tags: { leisure: 'swimming_pool' } })).toEqual(['pool']);
    expect(
      detectAmenities({ tags: { steam_room: 'yes', massage: 'yes', amenity: 'cafe' } }),
    ).toEqual(['steam', 'cafe', 'massage']);
    expect(detectAmenities({ tags: { sauna: 'no', swimming_pool: 'no' } })).toEqual([]);
  });
  it('reads multilingual names', () => {
    expect(detectAmenities({ name: 'Fitness & Pool Club' })).toEqual(['pool']);
    for (const n of ['Бассейн Олимп', 'Басейн Динамо', 'Basen Miejski', 'Baseinas Žalgiris'])
      expect(detectAmenities({ name: n })).toContain('pool');
    expect(detectAmenities({ name: 'Сауна Фітнес' })).toEqual(['sauna']);
    expect(detectAmenities({ name: 'Zen Spa & Gym' })).toEqual(['sauna']);
    expect(detectAmenities({ name: 'Smoothie Bar Gym' })).toEqual(['juiceBar']);
    expect(detectAmenities({ name: 'Kohvik Gym' })).toEqual(['cafe']);
  });
  it('does not match inside words and handles empty', () => {
    expect(detectAmenities({ name: 'Spartan Gym' })).toEqual([]);
    expect(detectAmenities({})).toEqual([]);
  });
});

describe('effectiveAmenities', () => {
  it('confirmed wins, then auto, then name fallback', () => {
    expect(
      effectiveAmenities({ name: 'Pool Gym', amenities: [], amenitiesAuto: ['pool'] }),
    ).toEqual([]);
    expect(effectiveAmenities({ name: 'X', amenitiesAuto: ['sauna'] })).toEqual(['sauna']);
    expect(effectiveAmenities({ name: 'Pool Gym' })).toEqual(['pool']);
    expect(hasAmenity({ name: 'X', amenities: ['cafe'] }, 'cafe')).toBe(true);
    expect(detectedAmenities({ name: 'Sauna Gym' })).toEqual(['sauna']);
  });
});

describe('helpers', () => {
  it('unions in catalog order', () => {
    expect(unionAmenities(['cafe'], ['pool'], undefined, ['bogus'])).toEqual(['pool', 'cafe']);
    expect(AMENITY_CATALOG).toHaveLength(9);
  });
});
