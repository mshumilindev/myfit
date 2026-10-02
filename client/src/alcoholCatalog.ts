/**
 * Alcohol: the bundled drink catalog and the pure arithmetic around it (no React, no store,
 * no I/O). The user cannot create drinks: every entry points at one of the 25 items here,
 * which carry the strength (ABV) and the serving presets. Region-specific parts (the size of a
 * standard drink, the measures shown) come from `alcoholRegion.ts`.
 */
import { regionInfo } from './alcoholRegion';
import type { AlcoholEntry, AlcoholItemId, AlcoholRegion } from './types';

export type AlcoholCategory =
  'beer' | 'cider' | 'wine' | 'fortified' | 'spirits' | 'cocktails' | 'rtd' | 'low';

/** Row order of the "What I drink" list (board A3). */
export const ALCOHOL_CATEGORIES: readonly AlcoholCategory[] = [
  'beer',
  'cider',
  'wine',
  'fortified',
  'spirits',
  'cocktails',
  'rtd',
  'low',
];

/** English names, the fallback when the UI has no translation. */
export const CATEGORY_LABELS: Record<AlcoholCategory, string> = {
  beer: 'Beer',
  cider: 'Cider',
  wine: 'Wine',
  fortified: 'Fortified wine',
  spirits: 'Spirits',
  cocktails: 'Cocktails & long drinks',
  rtd: 'Seltzers & ready-to-drink',
  low: 'Low-alcohol',
};

export interface AlcoholItem {
  id: AlcoholItemId;
  category: AlcoholCategory;
  /** English name (fallback). */
  label: string;
  /** Typical strength, % alcohol by volume. */
  abv: number;
  /** Serving presets in ml per measure system; the second one (when there are two) is the default. */
  servings: { metric: readonly number[]; us: readonly number[]; uk: readonly number[] };
}

const BEER = { metric: [330, 500], us: [355, 473], uk: [284, 440, 568] } as const;
const CIDER = { metric: [330, 500], us: [355, 473], uk: [284, 568] } as const;
const WINE = { metric: [125, 150, 200], us: [148, 177], uk: [125, 175, 250] } as const;
const FORT = { metric: [50, 75, 100], us: [59, 89], uk: [50, 70] } as const;
const SPIRIT = { metric: [20, 40, 50], us: [30, 44, 59], uk: [25, 35, 50] } as const;
const CAN = { metric: [330, 440], us: [355, 473], uk: [330, 440] } as const;

export const ALCOHOL_ITEMS: readonly AlcoholItem[] = [
  { id: 'beerLight', category: 'beer', label: 'Light beer', abv: 4.5, servings: BEER },
  { id: 'beerRegular', category: 'beer', label: 'Regular beer', abv: 5, servings: BEER },
  { id: 'beerStrong', category: 'beer', label: 'Strong beer', abv: 7.5, servings: BEER },
  { id: 'beerCraft', category: 'beer', label: 'Craft / IPA', abv: 6.5, servings: BEER },
  { id: 'ciderRegular', category: 'cider', label: 'Cider', abv: 4.5, servings: CIDER },
  { id: 'ciderStrong', category: 'cider', label: 'Strong cider', abv: 7, servings: CIDER },
  { id: 'wineRed', category: 'wine', label: 'Red wine', abv: 13, servings: WINE },
  { id: 'wineWhite', category: 'wine', label: 'White wine', abv: 12, servings: WINE },
  { id: 'wineRose', category: 'wine', label: 'Rosé', abv: 12, servings: WINE },
  { id: 'wineSparkling', category: 'wine', label: 'Sparkling wine', abv: 11.5, servings: WINE },
  { id: 'fortPort', category: 'fortified', label: 'Port', abv: 20, servings: FORT },
  { id: 'fortSherry', category: 'fortified', label: 'Sherry', abv: 17, servings: FORT },
  { id: 'fortVermouth', category: 'fortified', label: 'Vermouth', abv: 15, servings: FORT },
  { id: 'spVodka', category: 'spirits', label: 'Vodka', abv: 40, servings: SPIRIT },
  { id: 'spWhisky', category: 'spirits', label: 'Whisky', abv: 40, servings: SPIRIT },
  { id: 'spRum', category: 'spirits', label: 'Rum', abv: 40, servings: SPIRIT },
  { id: 'spGin', category: 'spirits', label: 'Gin', abv: 40, servings: SPIRIT },
  { id: 'spBrandy', category: 'spirits', label: 'Brandy', abv: 40, servings: SPIRIT },
  { id: 'spTequila', category: 'spirits', label: 'Tequila', abv: 38, servings: SPIRIT },
  { id: 'spLiqueur', category: 'spirits', label: 'Liqueur', abv: 20, servings: SPIRIT },
  {
    id: 'cocktail',
    category: 'cocktails',
    label: 'Cocktail',
    abv: 15,
    servings: { metric: [150, 200, 250], us: [118, 177], uk: [150, 200, 250] },
  },
  {
    id: 'longDrink',
    category: 'cocktails',
    label: 'Long drink (G&T, spritz)',
    abv: 8,
    servings: { metric: [250, 330, 440], us: [355, 473], uk: [330, 440] },
  },
  { id: 'hardSeltzer', category: 'rtd', label: 'Hard seltzer', abv: 4.5, servings: CAN },
  { id: 'rtd', category: 'rtd', label: 'Ready-to-drink', abv: 5, servings: CAN },
  {
    id: 'lowAlcohol',
    category: 'low',
    label: 'Low-alcohol beer or wine',
    abv: 1,
    servings: { metric: [330, 500], us: [355, 473], uk: [330, 568] },
  },
];

const ITEM_BY_ID = new Map<string, AlcoholItem>(ALCOHOL_ITEMS.map((i) => [i.id, i]));
export const isAlcoholItemId = (v: unknown): v is AlcoholItemId =>
  typeof v === 'string' && ITEM_BY_ID.has(v);
export const alcoholItem = (id: AlcoholItemId): AlcoholItem => ITEM_BY_ID.get(id)!;
export const itemsInCategory = (c: AlcoholCategory): AlcoholItem[] =>
  ALCOHOL_ITEMS.filter((i) => i.category === c);

// --- Constants --------------------------------------------------------------------------------

/** Density of ethanol, g per ml. */
export const ETHANOL_G_PER_ML = 0.789;
/** A from-time-to-time drink counts as about one serving a week. PLACEHOLDER. */
export const OCCASIONAL_SERVINGS_PER_WEEK = 1;
/** Sanity ceilings so a typo cannot produce absurd numbers. */
export const MIN_SERVING_ML = 10;
export const MAX_SERVING_ML = 2000;
export const MAX_SERVINGS_PER_WEEK = 150;

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const round = (n: number, d = 1): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

// --- Serving presets and their labels ----------------------------------------------------------

const ML_PER_US_OZ = 29.5735;
const ML_PER_UK_PINT = 568.26;

export interface ServingLabel {
  /** Language-neutral kind: the UI may swap the word ('pint', 'oz') for a translation. */
  unit: 'ml' | 'l' | 'oz' | 'pint' | 'halfPint';
  /** The number in that unit. */
  amount: number;
  /** Default English text: "0.5 L", "150 ml", "12 oz", "1 pint". */
  text: string;
}

const trimNum = (n: number): string => String(round(n, 2));

/** How `ml` reads in a region: metric ml / L, US fluid ounces, UK pints (or ml for small ones). */
export function formatServing(ml: number, region: AlcoholRegion): ServingLabel {
  const measure = regionInfo(region).measure;
  if (measure === 'us') {
    const oz = Math.round((ml / ML_PER_US_OZ) * 2) / 2; // half ounces
    if (oz >= 1) return { unit: 'oz', amount: oz, text: `${trimNum(oz)} oz` };
  } else if (measure === 'uk') {
    if (Math.abs(ml - ML_PER_UK_PINT) <= 12) return { unit: 'pint', amount: 1, text: '1 pint' };
    if (Math.abs(ml - ML_PER_UK_PINT / 2) <= 8)
      return { unit: 'halfPint', amount: 0.5, text: '½ pint' };
  }
  // Metric reads 0.33 L / 0.5 L; the UK keeps cans and small bottles in ml (440 ml).
  if (ml >= 1000 || (ml >= 300 && measure !== 'uk')) {
    const l = round(ml / 1000, 2);
    return { unit: 'l', amount: l, text: `${trimNum(l)} L` };
  }
  const v = Math.round(ml);
  return { unit: 'ml', amount: v, text: `${v} ml` };
}

export interface ServingPreset extends ServingLabel {
  ml: number;
}

/** The serving presets of an item for a region, labelled in that region's measures. */
export function servingPresets(item: AlcoholItem, region: AlcoholRegion): ServingPreset[] {
  const list = item.servings[regionInfo(region).measure];
  return list.map((ml) => ({ ml, ...formatServing(ml, region) }));
}

/** The default serving: the second preset (the usual glass / bottle), or the only one. */
export function defaultServingMl(item: AlcoholItem, region: AlcoholRegion): number {
  const list = item.servings[regionInfo(region).measure];
  return list[Math.min(1, list.length - 1)];
}

// --- Grams --------------------------------------------------------------------------------------

/** Grams of pure alcohol in one serving: ml x ABV x 0.789. */
export function gramsPerServing(itemId: AlcoholItemId, servingMl: number): number {
  const item = ITEM_BY_ID.get(itemId);
  if (!item || !finite(servingMl)) return 0;
  return (clamp(servingMl, 0, MAX_SERVING_ML) * item.abv * ETHANOL_G_PER_ML) / 100;
}

/** Servings counted in an ordinary week (a from-time-to-time entry counts as a small fixed amount). */
export function servingsPerWeek(e: Pick<AlcoholEntry, 'occasional' | 'servingsPerWeek'>): number {
  if (e.occasional) return OCCASIONAL_SERVINGS_PER_WEEK;
  return finite(e.servingsPerWeek) ? clamp(e.servingsPerWeek, 0, MAX_SERVINGS_PER_WEEK) : 0;
}

/** Grams of pure alcohol a week from one entry (0 when inactive or invalid). */
export function entryGramsPerWeek(e: AlcoholEntry): number {
  if (!e.active) return 0;
  return gramsPerServing(e.itemId, e.servingMl) * servingsPerWeek(e);
}

/** The plain sum over the active entries, grams a week (one decimal). */
export function weeklyGrams(entries: readonly AlcoholEntry[]): number {
  let sum = 0;
  for (const e of entries) sum += entryGramsPerWeek(e);
  return round(sum, 1);
}

export const activeAlcoholEntries = (entries: readonly AlcoholEntry[]): AlcoholEntry[] =>
  entries.filter((e) => entryGramsPerWeek(e) > 0);

/** Standard drinks (or UK units) in `grams`, by the region's size of one. */
export function standardDrinks(grams: number, region: AlcoholRegion): number {
  return round(grams / regionInfo(region).gramsPerDrink, 1);
}

// --- Describing ----------------------------------------------------------------------------------

export interface EntryDescription {
  item: AlcoholItem;
  /** "5%" */
  abvText: string;
  serving: ServingLabel;
  occasional: boolean;
  /** Servings a week; null for a from-time-to-time entry. */
  count: number | null;
  /** Grams of pure alcohol in one serving, and standard drinks in one serving. */
  gramsPerServing: number;
  drinksPerServing: number;
  /** Per week (an occasional entry: the small background amount). */
  gramsPerWeek: number;
  drinksPerWeek: number;
}

/** Everything the row / sheet of one entry shows, in the region's units. Null for an unknown drink. */
export function describeEntry(e: AlcoholEntry, region: AlcoholRegion): EntryDescription | null {
  const item = ITEM_BY_ID.get(e.itemId);
  if (!item) return null;
  const perServing = gramsPerServing(e.itemId, e.servingMl);
  const perWeek = perServing * servingsPerWeek(e);
  return {
    item,
    abvText: `${trimNum(item.abv)}%`,
    serving: formatServing(e.servingMl, region),
    occasional: !!e.occasional,
    count: e.occasional ? null : servingsPerWeek(e),
    gramsPerServing: round(perServing, 1),
    drinksPerServing: standardDrinks(perServing, region),
    gramsPerWeek: round(perWeek, 1),
    drinksPerWeek: standardDrinks(perWeek, region),
  };
}

// --- Summary text -----------------------------------------------------------------------------------

/**
 * The name a drink goes by in a summary: spirits by their own name ("Whisky"), everything
 * else by its category ("Beer", "Wine"). The UI maps this key to a translation.
 */
export function summaryKey(item: AlcoholItem): string {
  return item.category === 'spirits' ? item.id : item.category;
}

const SUMMARY_NAMES: Record<string, string> = {
  ...CATEGORY_LABELS,
  ...Object.fromEntries(
    ALCOHOL_ITEMS.filter((i) => i.category === 'spirits').map((i) => [i.id, i.label]),
  ),
};

/** Active entries by size of contribution (grams a week), biggest first (stable on ties). */
export function entriesByLoad(entries: readonly AlcoholEntry[]): AlcoholEntry[] {
  return activeAlcoholEntries(entries)
    .map((e, i) => ({ e, i, g: entryGramsPerWeek(e) }))
    .sort((a, b) => b.g - a.g || a.i - b.i)
    .map((x) => x.e);
}

export interface WeeklyAmount {
  grams: number;
  /** In the region's standard drinks / units. */
  drinks: number;
  drinkWord: 'drink' | 'unit';
}

/**
 * "Beer + Whisky · ≈ 117 g a week". `labelOf` supplies the localized name for a `summaryKey`
 * and `perWeek` the localized "≈ 117 g a week" tail (the UI passes its translations; the
 * defaults are English, in grams). Null when nothing is active.
 */
export function alcoholSummaryText(
  entries: readonly AlcoholEntry[],
  region: AlcoholRegion,
  labelOf: (key: string) => string = (k) => SUMMARY_NAMES[k] ?? k,
  perWeek: (a: WeeklyAmount) => string = (a) => `${a.grams} g a week`,
  more: (n: number) => string = (n) => `${n} more`,
): string | null {
  const list = entriesByLoad(entries);
  if (!list.length) return null;
  const names: string[] = [];
  for (const e of list) {
    const n = labelOf(summaryKey(alcoholItem(e.itemId)));
    if (!names.includes(n)) names.push(n);
  }
  // At most two names, then "N more" (the same rule on all three hubs).
  const shownNames = names.slice(0, 2);
  const rest = names.length - shownNames.length;
  const head = rest > 0 ? `${shownNames.join(' + ')} + ${more(rest)}` : shownNames.join(' + ');
  const grams = weeklyGrams(entries);
  const info = regionInfo(region);
  const shown = grams < 10 ? round(grams, 1) : Math.round(grams);
  return `${head} · ≈ ${perWeek({
    grams: shown,
    drinks: standardDrinks(grams, region),
    drinkWord: info.drinkWord,
  })}`;
}
