import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';
import {
  EMPTY_FILTERS,
  activeCount,
  applyFilters,
  daysBucket,
  facetCounts,
  facetValues,
  gearTier,
  hasAnyFilter,
  missingNeeds,
  sortEntries,
  toggleFacet,
  FACET_GROUPS,
} from './filters';

const all = new Set(['periodization', 'supersets']);
const none = new Set<string>();

describe('filters', () => {
  it('no filter returns the whole catalog', () => {
    expect(applyFilters(CATALOG, EMPTY_FILTERS)).toHaveLength(CATALOG.length);
    expect(hasAnyFilter(EMPTY_FILTERS)).toBe(false);
  });

  it('OR inside a group, AND between groups', () => {
    const a = applyFilters(CATALOG, { ...EMPTY_FILTERS, level: ['beginner'] });
    const b = applyFilters(CATALOG, { ...EMPTY_FILTERS, level: ['beginner', 'elite'] });
    expect(b.length).toBeGreaterThan(a.length);
    const c = applyFilters(CATALOG, { ...EMPTY_FILTERS, level: ['beginner'], days: ['3'] });
    expect(c.length).toBeLessThanOrEqual(a.length);
    for (const e of c) {
      expect(e.levels).toContain('beginner');
      expect(daysBucket(e.daysPerWeek)).toBe('3');
    }
  });

  it('search finds athletes and exercises, ignores case and accents', () => {
    const byAthlete = applyFilters(CATALOG, { ...EMPTY_FILTERS, q: 'WENDLER' });
    expect(byAthlete.length).toBeGreaterThan(0);
    expect(byAthlete.every((e) => e.who.includes('Wendler'))).toBe(true);
    const byLift = applyFilters(CATALOG, { ...EMPTY_FILTERS, q: 'deadlift' });
    expect(byLift.length).toBeGreaterThan(10);
    expect(applyFilters(CATALOG, { ...EMPTY_FILTERS, q: 'müller' }).length).toBe(
      applyFilters(CATALOG, { ...EMPTY_FILTERS, q: 'muller' }).length,
    );
    expect(applyFilters(CATALOG, { ...EMPTY_FILTERS, q: 'zzzz-nothing' })).toEqual([]);
  });

  it('counts never lie: turning on an option with count n gives exactly n entries', () => {
    const base = { ...EMPTY_FILTERS, level: ['advanced'] };
    for (const g of FACET_GROUPS) {
      const counts = facetCounts(CATALOG, base, g);
      for (const [id, n] of Object.entries(counts)) {
        const next = g === 'level' ? { ...base, level: [id] } : { ...base, [g]: [id] };
        expect(applyFilters(CATALOG, next)).toHaveLength(n);
      }
    }
  });

  it('every entry has a value in every facet; days buckets and gear tiers are total', () => {
    for (const e of CATALOG) {
      for (const g of FACET_GROUPS) expect(facetValues(e, g).length).toBeGreaterThan(0);
      expect(['none', 'basic', 'full']).toContain(gearTier(e));
    }
    expect([1, 2, 3, 4, 5, 6, 7].map(daysBucket)).toEqual([
      '1-2',
      '1-2',
      '3',
      '4',
      '5',
      '6-7',
      '6-7',
    ]);
  });

  it('toggle adds and removes; counts of active filters', () => {
    const on = toggleFacet(EMPTY_FILTERS, 'goal', 'mass');
    expect(on.goal).toEqual(['mass']);
    expect(activeCount(on)).toBe(1);
    expect(toggleFacet(on, 'goal', 'mass').goal).toEqual([]);
  });

  it('locks by the add-ons that are not installed', () => {
    const cyc = CATALOG.find((e) => e.needs.includes('periodization'))!;
    expect(missingNeeds(cyc, none)).toContain('periodization');
    expect(missingNeeds(cyc, all)).toEqual([]);
    const plain = CATALOG.find((e) => e.needs.length === 0)!;
    expect(missingNeeds(plain, none)).toEqual([]);
  });

  it('sorts what can be started first, deterministically, without losing entries', () => {
    const a = sortEntries(CATALOG, none);
    const b = sortEntries([...CATALOG].reverse(), none);
    expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id));
    expect(a).toHaveLength(CATALOG.length);
    const firstLocked = a.findIndex((e) => missingNeeds(e, none).length > 0);
    expect(a.slice(firstLocked).every((e) => missingNeeds(e, none).length > 0)).toBe(true);
    expect(sortEntries(CATALOG, all).every((e) => missingNeeds(e, all).length === 0)).toBe(true);
  });
});
