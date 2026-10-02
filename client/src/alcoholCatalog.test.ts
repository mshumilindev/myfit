import { describe, expect, it } from 'vitest';
import {
  ALCOHOL_CATEGORIES,
  ALCOHOL_ITEMS,
  MAX_SERVINGS_PER_WEEK,
  OCCASIONAL_SERVINGS_PER_WEEK,
  alcoholItem,
  alcoholSummaryText,
  defaultServingMl,
  describeEntry,
  entryGramsPerWeek,
  formatServing,
  gramsPerServing,
  isAlcoholItemId,
  itemsInCategory,
  servingPresets,
  standardDrinks,
  summaryKey,
  weeklyGrams,
} from './alcoholCatalog';
import { ALCOHOL_REGIONS } from './alcoholRegion';
import type { AlcoholEntry } from './types';

const entry = (over: Partial<AlcoholEntry> = {}): AlcoholEntry => ({
  id: 'e1',
  itemId: 'beerRegular',
  servingMl: 500,
  servingsPerWeek: 4,
  active: true,
  ...over,
});

describe('catalog integrity', () => {
  it('has the 25 items of the design, with unique ids', () => {
    expect(ALCOHOL_ITEMS).toHaveLength(25);
    expect(new Set(ALCOHOL_ITEMS.map((i) => i.id)).size).toBe(25);
    expect(new Set(ALCOHOL_ITEMS.map((i) => i.label)).size).toBe(25);
  });

  it('every ABV is plausible and every item is in a known category', () => {
    for (const i of ALCOHOL_ITEMS) {
      expect(i.abv, i.id).toBeGreaterThanOrEqual(0.5);
      expect(i.abv, i.id).toBeLessThanOrEqual(60);
      expect(ALCOHOL_CATEGORIES).toContain(i.category);
    }
    for (const c of ALCOHOL_CATEGORIES) expect(itemsInCategory(c).length).toBeGreaterThan(0);
  });

  it('keeps the ABVs of the design', () => {
    const abv = (id: Parameters<typeof alcoholItem>[0]) => alcoholItem(id).abv;
    expect([abv('beerLight'), abv('beerRegular'), abv('beerStrong'), abv('beerCraft')]).toEqual([
      4.5, 5, 7.5, 6.5,
    ]);
    for (const id of ['spVodka', 'spWhisky', 'spRum', 'spGin', 'spBrandy'] as const)
      expect(abv(id)).toBe(40);
    expect(abv('spTequila')).toBe(38);
    expect(abv('spLiqueur')).toBe(20);
    expect(abv('cocktail')).toBe(15);
    expect(abv('longDrink')).toBe(8);
    expect(abv('hardSeltzer')).toBe(4.5);
    expect(abv('rtd')).toBe(5);
    expect(abv('lowAlcohol')).toBeGreaterThanOrEqual(0.5);
    expect(abv('lowAlcohol')).toBeLessThanOrEqual(1.2);
  });

  it('every item has sorted, positive, distinct serving presets for every measure system', () => {
    for (const i of ALCOHOL_ITEMS)
      for (const list of [i.servings.metric, i.servings.us, i.servings.uk]) {
        expect(list.length).toBeGreaterThan(0);
        expect([...list].sort((a, b) => a - b)).toEqual([...list]);
        expect(new Set(list).size).toBe(list.length);
        for (const ml of list) expect(ml).toBeGreaterThan(0);
      }
  });

  it('a preset serving is a sane amount of alcohol in every region (3 to 40 g)', () => {
    for (const i of ALCOHOL_ITEMS)
      for (const r of ALCOHOL_REGIONS)
        for (const p of servingPresets(i, r)) {
          const g = gramsPerServing(i.id, p.ml);
          expect(g, `${i.id} ${p.ml}`).toBeGreaterThan(0.5);
          expect(g, `${i.id} ${p.ml}`).toBeLessThan(40);
        }
  });

  it('isAlcoholItemId only accepts catalog ids', () => {
    expect(isAlcoholItemId('spGin')).toBe(true);
    expect(isAlcoholItemId('moonshine')).toBe(false);
    expect(isAlcoholItemId(5)).toBe(false);
  });
});

describe('grams and standard drinks', () => {
  it('gramsPerServing = ml x ABV x 0.789', () => {
    expect(gramsPerServing('beerRegular', 500)).toBeCloseTo(19.725, 3);
    expect(gramsPerServing('spWhisky', 40)).toBeCloseTo(12.624, 3);
    expect(gramsPerServing('wineRed', 150)).toBeCloseTo(15.3855, 3);
    expect(gramsPerServing('beerRegular', 0)).toBe(0);
    expect(gramsPerServing('beerRegular', Number.NaN)).toBe(0);
  });

  it('weekly grams of the design example: beer 0.5 L x 4 + whisky 40 ml x 3 is about 117 g', () => {
    const list = [
      entry(),
      entry({ id: 'e2', itemId: 'spWhisky', servingMl: 40, servingsPerWeek: 3 }),
    ];
    expect(weeklyGrams(list)).toBeCloseTo(116.8, 1);
    expect(weeklyGrams([])).toBe(0);
  });

  it('standard drinks follow the region: 10 g, 14 g (US), 8 g (UK unit), 13.45 g (CA)', () => {
    expect(standardDrinks(117, 'eu')).toBe(11.7);
    expect(standardDrinks(117, 'au')).toBe(11.7);
    expect(standardDrinks(112, 'us')).toBe(8);
    expect(standardDrinks(112, 'uk')).toBe(14);
    expect(standardDrinks(26.9, 'ca')).toBe(2);
  });

  it('region switch changes the standard drinks and the measures, not the grams', () => {
    const e = entry();
    const eu = describeEntry(e, 'eu')!;
    const us = describeEntry(e, 'us')!;
    const uk = describeEntry(e, 'uk')!;
    expect(eu.gramsPerWeek).toBe(us.gramsPerWeek);
    expect(eu.drinksPerServing).toBe(2);
    expect(us.drinksPerServing).toBe(1.4);
    expect(uk.drinksPerServing).toBe(2.5);
    expect(eu.serving.text).toBe('0.5 L');
    expect(us.serving.text).toBe('17 oz');
    expect(uk.serving.text).toBe('500 ml');
  });

  it('inactive, zero and invalid entries add nothing; the count is capped', () => {
    expect(entryGramsPerWeek(entry({ active: false }))).toBe(0);
    expect(entryGramsPerWeek(entry({ servingsPerWeek: 0 }))).toBe(0);
    expect(entryGramsPerWeek(entry({ servingsPerWeek: Number.NaN }))).toBe(0);
    expect(entryGramsPerWeek(entry({ servingsPerWeek: 1e6 }))).toBeCloseTo(
      gramsPerServing('beerRegular', 500) * MAX_SERVINGS_PER_WEEK,
      5,
    );
  });
});

describe('from time to time', () => {
  it('counts as a small fixed background amount, whatever the count holds', () => {
    const a = entry({ occasional: true, servingsPerWeek: 0 });
    const b = entry({ occasional: true, servingsPerWeek: 20 });
    expect(entryGramsPerWeek(a)).toBeCloseTo(
      gramsPerServing('beerRegular', 500) * OCCASIONAL_SERVINGS_PER_WEEK,
      6,
    );
    expect(entryGramsPerWeek(a)).toBe(entryGramsPerWeek(b));
    expect(entryGramsPerWeek(a)).toBeLessThan(entryGramsPerWeek(entry()));
    expect(describeEntry(a, 'eu')!.count).toBeNull();
    expect(describeEntry(a, 'eu')!.occasional).toBe(true);
  });
});

describe('serving presets and labels by region', () => {
  const beer = alcoholItem('beerRegular');
  const spirit = alcoholItem('spWhisky');

  it('EU / default: ml and litres', () => {
    expect(servingPresets(beer, 'eu').map((p) => p.text)).toEqual(['0.33 L', '0.5 L']);
    expect(servingPresets(spirit, 'eu').map((p) => p.text)).toEqual(['20 ml', '40 ml', '50 ml']);
    expect(servingPresets(alcoholItem('wineRed'), 'eu').map((p) => p.text)).toEqual([
      '125 ml',
      '150 ml',
      '200 ml',
    ]);
  });

  it('US: ounces, the 12 oz can and the 1.5 oz shot', () => {
    expect(servingPresets(beer, 'us').map((p) => p.text)).toEqual(['12 oz', '16 oz']);
    expect(servingPresets(spirit, 'us').map((p) => p.text)).toEqual(['1 oz', '1.5 oz', '2 oz']);
    // A US shot is one US standard drink (14 g) for a 40 % spirit.
    const shot = servingPresets(spirit, 'us')[1];
    expect(gramsPerServing('spWhisky', shot.ml)).toBeCloseTo(14, 0);
  });

  it('UK: pints and half pints, 25 ml spirit measure = 1 unit', () => {
    const labels = servingPresets(beer, 'uk');
    expect(labels.map((p) => p.text)).toEqual(['½ pint', '440 ml', '1 pint']);
    expect(labels[0].unit).toBe('halfPint');
    expect(labels[2]).toMatchObject({ unit: 'pint', amount: 1 });
    const measure = servingPresets(spirit, 'uk')[0];
    expect(standardDrinks(gramsPerServing('spWhisky', measure.ml), 'uk')).toBe(1);
  });

  it('formats any stored ml in the region units', () => {
    expect(formatServing(330, 'eu').text).toBe('0.33 L');
    expect(formatServing(1000, 'eu').text).toBe('1 L');
    expect(formatServing(568, 'uk').text).toBe('1 pint');
    expect(formatServing(355, 'us').text).toBe('12 oz');
    expect(formatServing(15, 'us').text).toBe('15 ml'); // under an ounce: stays in ml
  });

  it('the default serving is the usual glass', () => {
    expect(defaultServingMl(beer, 'eu')).toBe(500);
    expect(defaultServingMl(spirit, 'eu')).toBe(40);
    expect(defaultServingMl(spirit, 'us')).toBe(44);
    expect(defaultServingMl(alcoholItem('beerStrong'), 'uk')).toBe(440);
  });
});

describe('summary text', () => {
  const list: AlcoholEntry[] = [
    entry({ id: 'a', itemId: 'beerRegular', servingMl: 500, servingsPerWeek: 4 }),
    entry({ id: 'b', itemId: 'spWhisky', servingMl: 40, servingsPerWeek: 3 }),
  ];

  it('builds "Beer + Whisky · ≈ 117 g a week" with the biggest first', () => {
    expect(alcoholSummaryText(list, 'eu')).toBe('Beer + Whisky · ≈ 117 g a week');
    expect(alcoholSummaryText([...list].reverse(), 'eu')).toBe('Beer + Whisky · ≈ 117 g a week');
  });

  it('takes localized labels and a localized tail with region units', () => {
    const text = alcoholSummaryText(
      list,
      'uk',
      (k) => `<${k}>`,
      (a) => `${a.drinks} ${a.drinkWord}s (${a.grams} g)`,
    );
    expect(text).toBe('<beer> + <spWhisky> · ≈ 14.6 units (117 g)');
    expect(
      alcoholSummaryText(
        list,
        'us',
        (k) => k,
        (a) => `${a.drinks} ${a.drinkWord}s`,
      ),
    ).toBe('beer + spWhisky · ≈ 8.3 drinks');
  });

  it('merges drinks that share a name, keeps one decimal for small amounts, skips inactive', () => {
    const two = [
      entry({ id: 'a', itemId: 'beerLight' }),
      entry({ id: 'b', itemId: 'beerCraft', servingsPerWeek: 1 }),
    ];
    expect(alcoholSummaryText(two, 'eu')!.startsWith('Beer · ')).toBe(true);
    const tiny = [entry({ occasional: true, itemId: 'lowAlcohol', servingMl: 330 })];
    expect(alcoholSummaryText(tiny, 'eu')).toBe('Low-alcohol · ≈ 2.6 g a week');
    expect(alcoholSummaryText([entry({ active: false })], 'eu')).toBeNull();
    expect(alcoholSummaryText([], 'eu')).toBeNull();
  });

  it('summaryKey is the drink for spirits and the category otherwise', () => {
    expect(summaryKey(alcoholItem('spGin'))).toBe('spGin');
    expect(summaryKey(alcoholItem('wineRose'))).toBe('wine');
    expect(summaryKey(alcoholItem('longDrink'))).toBe('cocktails');
  });
});
