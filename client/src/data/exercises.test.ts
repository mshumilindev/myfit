import { describe, expect, it } from 'vitest';
import { BUILT_IN_CATALOG, searchCatalog } from './exercises';

describe('exercise catalog', () => {
  it('should have unique ids', () => {
    const ids = BUILT_IN_CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should carry five non-empty names for every exercise', () => {
    for (const e of BUILT_IN_CATALOG) {
      expect(e.names, e.id).toHaveLength(5);
      for (const n of e.names) expect(n.trim().length, e.id).toBeGreaterThan(0);
    }
  });

  it('should find imported free-exercise-db names', () => {
    expect(
      searchCatalog('bench').some((e) => e.names[0] === 'Barbell Bench Press - Medium Grip'),
    ).toBe(true);
    expect(searchCatalog('deadlift').some((e) => e.names[0] === 'Barbell Deadlift')).toBe(true);
  });

  it('should be case-insensitive and rank prefix matches first', () => {
    const res = searchCatalog('DEAD');
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].names[0].toLowerCase().startsWith('dead')).toBe(true);
  });

  it('should return nothing for an empty query', () => {
    expect(searchCatalog('')).toHaveLength(0);
  });
});
