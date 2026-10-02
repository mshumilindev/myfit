/** Shared labels, icons and number helpers of the Alcohol screens. */
import { FEATURE_ICON } from '../../../coachEffectIcons';
import { useT } from '../../../i18n';
import {
  alcoholItem,
  alcoholSummaryText,
  describeEntry,
  entriesByLoad,
  entryGramsPerWeek,
  itemsInCategory,
  summaryKey,
  type AlcoholCategory,
  type ServingLabel,
} from '../../../alcoholCatalog';
import { regionInfo } from '../../../alcoholRegion';
import { useAlcoholRegion } from '../../../store';
import type { AlcoholEntry, AlcoholItemId, AlcoholRegion } from '../../../types';

/** Phosphor icon of each category tile. */
export const ALC_ICON: Record<AlcoholCategory, string> = {
  beer: 'beer-stein',
  cider: 'beer-bottle',
  wine: 'wine',
  fortified: 'drop-half',
  spirits: 'drop',
  cocktails: 'martini',
  rtd: 'cheers',
  low: 'leaf',
};

/** The icon of the Alcohol row and hub. */
export const ALC_ROW_ICON = FEATURE_ICON.alcohol;

/** One entry per drink: the id is stable so a type is "saved" or not. */
export const alcEntryId = (itemId: AlcoholItemId): string => `alc-${itemId}`;

/** The type a category sheet opens on when nothing in it is saved yet. */
export function defaultItemOf(category: AlcoholCategory): AlcoholItemId {
  const items = itemsInCategory(category);
  return (category === 'beer' ? 'beerRegular' : items[0].id) as AlcoholItemId;
}

/** Plain number text, no trailing zeros. */
export const numText = (n: number): string => String(Math.round(n * 100) / 100);

/** Grams for display: one decimal under 10, whole above. */
export const roundG = (g: number): number => (g < 10 ? Math.round(g * 10) / 10 : Math.round(g));

export function useAlcoholText() {
  const { t } = useT();
  const region = useAlcoholRegion();
  const info = regionInfo(region);
  const itemName = (id: AlcoholItemId): string => t.alcItem[id];
  const catName = (c: AlcoholCategory): string => t.alcCat[c];
  /** "0.5 L", "12 oz", "1 pint": the region's measure in the locale's words. */
  const servingText = (s: ServingLabel): string => {
    if (s.unit === 'pint') return t.alcPint;
    if (s.unit === 'halfPint') return t.alcHalfPint;
    return `${numText(s.amount)} ${t.alcUnit[s.unit]}`;
  };
  const regionName = (r: AlcoholRegion): string => t.alcRegion[r];
  const regionShort = (r: AlcoholRegion): string => t.alcRegionShort[r];
  const labelOfKey = (key: string): string =>
    (t.alcCatShort as Record<string, string>)[key] ??
    (t.alcItem as Record<string, string>)[key] ??
    key;
  /** "Beer + Whisky · ≈ 117 g a week", or null with nothing active. */
  const summary = (entries: readonly AlcoholEntry[]): string | null =>
    alcoholSummaryText(entries, region, labelOfKey, (a) => t.alcGramsAWeek(a.grams), t.supMore);
  /** "Beer + Whisky": the names alone, biggest first. */
  const summaryNames = (entries: readonly AlcoholEntry[]): string => {
    const names: string[] = [];
    for (const e of entriesByLoad(entries)) {
      const key = summaryKey(alcoholItem(e.itemId));
      const n = labelOfKey(key);
      if (!names.includes(n)) names.push(n);
    }
    return names.join(' + ');
  };
  /** The sub-line of a category row: the one saved drink, or how many types. */
  const categorySub = (entries: readonly AlcoholEntry[]): string | null => {
    if (entries.length === 0) return null;
    if (entries.length > 1) {
      const g = entries.reduce((sum, e) => sum + entryGramsPerWeek(e), 0);
      return t.alcRowMany(entries.length, roundG(g));
    }
    const d = describeEntry(entries[0], region);
    if (!d) return null;
    const name = itemName(d.item.id);
    return d.occasional
      ? t.alcRowSome(name, d.abvText)
      : t.alcRowOne(name, d.abvText, servingText(d.serving), Math.round((d.count ?? 0) * 10) / 10);
  };
  /** "Fri, Sat", or "Not set". */
  const daysText = (days: readonly number[]): string =>
    days.length ? days.map((d) => t.alcDays[d]).join(', ') : t.alcHubDaysNone;
  return {
    t,
    region,
    info,
    itemName,
    catName,
    servingText,
    regionName,
    regionShort,
    summary,
    summaryNames,
    categorySub,
    daysText,
  };
}
