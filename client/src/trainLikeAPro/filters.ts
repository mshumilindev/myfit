/**
 * Train like a pro: pure search, filter, sort and lock logic over the catalog. No React, no storage:
 * the screens feed it a filter state and the set of add-ons that are installed.
 * Within one group options are OR; between groups they are AND (the usual faceted filter).
 */
import type { CatalogEntry, CatalogNeed } from './catalog/types';

export type FacetGroup = 'goal' | 'level' | 'days' | 'gear' | 'era' | 'origin';
export const FACET_GROUPS: readonly FacetGroup[] = [
  'goal',
  'level',
  'days',
  'gear',
  'era',
  'origin',
];

export interface FilterState {
  q: string;
  goal: string[];
  level: string[];
  days: string[];
  gear: string[];
  era: string[];
  origin: string[];
}

export const EMPTY_FILTERS: FilterState = {
  q: '',
  goal: [],
  level: [],
  days: [],
  gear: [],
  era: [],
  origin: [],
};

export type DaysBucket = '1-2' | '3' | '4' | '5' | '6-7';
export type GearTier = 'none' | 'basic' | 'full';

export const DAYS_BUCKETS: readonly DaysBucket[] = ['1-2', '3', '4', '5', '6-7'];
export const GEAR_TIERS: readonly GearTier[] = ['none', 'basic', 'full'];

export function daysBucket(daysPerWeek: number): DaysBucket {
  if (daysPerWeek <= 2) return '1-2';
  if (daysPerWeek >= 6) return '6-7';
  return String(daysPerWeek) as DaysBucket;
}

const BASIC_GEAR = new Set(['barbell', 'dumbbell', 'ezBar', 'kettlebell', 'body']);

/** What the whole program asks for: nothing but the body, a barbell/dumbbell kit, or a full gym. */
export function gearTier(entry: CatalogEntry): GearTier {
  const used = new Set(entry.items.flatMap((r) => r.equipment));
  const outside = [...used].some((e) => !BASIC_GEAR.has(e));
  if (outside) return 'full';
  const heavy = [...used].some((e) => e !== 'body');
  return heavy ? 'basic' : 'none';
}

/** The value of one entry in a facet group (a list: a program can have several goals). */
export function facetValues(entry: CatalogEntry, group: FacetGroup): string[] {
  switch (group) {
    case 'goal':
      return entry.goals;
    case 'level':
      return entry.levels;
    case 'days':
      return [daysBucket(entry.daysPerWeek)];
    case 'gear':
      return [gearTier(entry)];
    case 'era':
      return [entry.era];
    case 'origin':
      return [entry.origin.kind];
  }
}

const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

/** Text a search looks in: athlete, title, source and every exercise name ("where is deadlift"). */
function searchText(entry: CatalogEntry): string {
  const names = new Set(entry.items.map((r) => r.name));
  return norm([entry.who, entry.title, entry.origin.label, ...names].join(' '));
}

function matchesGroups(entry: CatalogEntry, state: FilterState, skip?: FacetGroup): boolean {
  for (const g of FACET_GROUPS) {
    if (g === skip) continue;
    const want = state[g];
    if (want.length && !facetValues(entry, g).some((v) => want.includes(v))) return false;
  }
  return true;
}

function matchesQuery(entry: CatalogEntry, q: string): boolean {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const hay = searchText(entry);
  return terms.every((t) => hay.includes(t));
}

export function applyFilters(entries: readonly CatalogEntry[], state: FilterState): CatalogEntry[] {
  return entries.filter((e) => matchesQuery(e, state.q) && matchesGroups(e, state));
}

/**
 * How many entries each option of one group would give, with every OTHER group (and the search) applied:
 * the number a chip shows, and 0 means turning it on would empty the list.
 */
export function facetCounts(
  entries: readonly CatalogEntry[],
  state: FilterState,
  group: FacetGroup,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    if (!matchesQuery(e, state.q) || !matchesGroups(e, state, group)) continue;
    for (const v of new Set(facetValues(e, group))) out[v] = (out[v] ?? 0) + 1;
  }
  return out;
}

export const toggleFacet = (state: FilterState, group: FacetGroup, id: string): FilterState => ({
  ...state,
  [group]: state[group].includes(id) ? state[group].filter((x) => x !== id) : [...state[group], id],
});

export const activeCount = (state: FilterState): number =>
  FACET_GROUPS.reduce((n, g) => n + state[g].length, 0);

export const hasAnyFilter = (state: FilterState): boolean =>
  activeCount(state) > 0 || state.q.trim() !== '';

/** The add-ons an entry needs that are not installed ("Needs …" and the Get button). Empty = can start. */
export function missingNeeds(entry: CatalogEntry, installed: ReadonlySet<string>): CatalogNeed[] {
  return entry.needs.filter((n) => !installed.has(n));
}

const ERA_ORDER = [
  'pre-1940',
  'golden-age',
  'arnold-era',
  'mass-monsters',
  'modern',
  'current',
  'unknown',
];
const LEVEL_ORDER = ['beginner', 'intermediate', 'advanced', 'elite'];

/**
 * Default order: what a member can start first, easier first, then by era (unknown last), then by name.
 * Stable and total, so the list never jumps between renders.
 */
export function sortEntries(
  entries: readonly CatalogEntry[],
  installed: ReadonlySet<string>,
): CatalogEntry[] {
  const rank = (e: CatalogEntry) => [
    missingNeeds(e, installed).length ? 1 : 0,
    Math.min(...e.levels.map((l) => LEVEL_ORDER.indexOf(l))),
    ERA_ORDER.indexOf(e.era),
  ];
  return [...entries].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return a.who.localeCompare(b.who) || a.title.localeCompare(b.title);
  });
}
