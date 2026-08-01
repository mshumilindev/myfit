import { describe, expect, it } from 'vitest';
import { EXERCISE_CATALOG, searchCatalog } from './exercises';

describe('exercise catalog', () => {
  it('should have unique ids', () => {
    const ids = EXERCISE_CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should carry five non-empty names for every exercise', () => {
    for (const e of EXERCISE_CATALOG) {
      expect(e.names, e.id).toHaveLength(5);
      for (const n of e.names) expect(n.trim().length, e.id).toBeGreaterThan(0);
    }
  });

  it('should find exercises in every language', () => {
    expect(searchCatalog('bench').some((e) => e.id === 'bench-press')).toBe(true);
    expect(searchCatalog('жим штанги леж').some((e) => e.id === 'bench-press')).toBe(true);
    expect(searchCatalog('przysiad').some((e) => e.id === 'back-squat')).toBe(true);
    expect(searchCatalog('pritūpimai').some((e) => e.id === 'back-squat')).toBe(true);
    expect(searchCatalog('kükk').some((e) => e.id === 'back-squat')).toBe(true);
    expect(searchCatalog('румунська').some((e) => e.id === 'romanian-deadlift')).toBe(true);
  });

  it('should be case-insensitive and rank prefix matches first', () => {
    const res = searchCatalog('DEAD');
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].id).toBe('deadlift');
  });

  it('should return nothing for an empty query', () => {
    expect(searchCatalog('')).toHaveLength(0);
  });
});
