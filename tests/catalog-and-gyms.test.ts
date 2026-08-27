import { describe, expect, it } from 'vitest';
import { registerCustomExercises, searchCatalog } from '../client/src/data/exercises';
import { bboxAround, haversineM } from '../client/src/data/gymProviders';

describe('catalog regressions', () => {
  it('does not show a custom alias next to the canonical bench press', () => {
    registerCustomExercises([
      {
        id: 'alias-bench',
        name: 'Bench Press',
        primaryMuscle: 'chest',
        secondaryMuscles: [],
        equipment: ['barbell'],
      },
    ]);

    const names = searchCatalog('bench press', 10).map((e) => e.names[0]);

    expect(names).toContain('Barbell Bench Press - Medium Grip');
    expect(names).not.toContain('Bench Press');
    registerCustomExercises([]);
  });
});

describe('nearby gym search geometry', () => {
  it('builds a bounding box that contains the requested radius', () => {
    const center = { lat: 52.2297, lng: 21.0122 };
    const [south, west, north, east] = bboxAround(center, 2000);

    expect(south).toBeLessThan(center.lat);
    expect(west).toBeLessThan(center.lng);
    expect(north).toBeGreaterThan(center.lat);
    expect(east).toBeGreaterThan(center.lng);
    expect(haversineM(center, { lat: north, lng: center.lng })).toBeGreaterThan(1900);
  });
});
