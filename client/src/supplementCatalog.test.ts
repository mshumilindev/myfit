import { describe, expect, it } from 'vitest';
import {
  GROUP_BLURBS,
  GROUP_ICONS,
  GROUP_LABELS,
  GROUP_SHORT_LABELS,
  SUPPLEMENT_DISCLAIMER_EN,
  SUPPLEMENT_GROUPS,
  SUPPLEMENT_ITEMS,
  SUPPLEMENT_SOURCES,
  SUPPLEMENT_WARNING_KEYS,
  activeSupplementEntries,
  caffeineMgOf,
  caffeineMgOfEntries,
  clampDose,
  describeEntry,
  entriesInGroup,
  formatDose,
  groupOf,
  isSupplementId,
  itemsInGroup,
  proteinGramsOf,
  proteinGramsOfEntries,
  scheduleCounts,
  supplementItem,
  supplementSummaryText,
  typicalText,
  validateSupplementCatalog,
  type SupplementItem,
} from './supplementCatalog';
import type { SupplementEntry, SupplementId } from './types';

const entry = (itemId: SupplementId, over: Partial<SupplementEntry> = {}): SupplementEntry => {
  const item = supplementItem(itemId);
  return {
    id: `e-${itemId}`,
    itemId,
    dose: item.defaultDose,
    schedule: item.schedule,
    timing: item.timing,
    startedAt: 1,
    active: true,
    ...over,
  };
};

describe('catalog integrity', () => {
  it('has the 31 items of the design in 4 groups, with unique ids', () => {
    expect(SUPPLEMENT_ITEMS).toHaveLength(31);
    expect(new Set(SUPPLEMENT_ITEMS.map((i) => i.id)).size).toBe(31);
    expect(SUPPLEMENT_GROUPS).toEqual(['performance', 'protein', 'recovery', 'health']);
    // The canvas lists 7 / 8 / 7 / 8; its "31 in the catalog" needs one more (calcium, health).
    expect(SUPPLEMENT_GROUPS.map((g) => itemsInGroup(g).length)).toEqual([7, 8, 7, 9]);
    for (const i of SUPPLEMENT_ITEMS) expect(SUPPLEMENT_GROUPS).toContain(i.group);
  });

  it('passes every validation (presets within limits, sorted, default among them, ...)', () => {
    expect(validateSupplementCatalog()).toEqual([]);
  });

  it('the validator catches a broken catalog', () => {
    const bad: SupplementItem = {
      ...supplementItem('creatine'),
      presets: [5, 4, 99],
      defaultDose: 7,
      effect: 'protein',
    };
    const problems = validateSupplementCatalog([bad, bad]);
    expect(problems.join('|')).toMatch(/duplicate id/);
    expect(problems.join('|')).toMatch(/not sorted/);
    expect(problems.join('|')).toMatch(/outside min..max/);
    expect(problems.join('|')).toMatch(/default dose is not a preset/);
    expect(problems.join('|')).toMatch(/protein item without grams/);
  });

  it('keeps the canvas ids, presets and defaults', () => {
    const d = (id: SupplementId) => {
      const i = supplementItem(id);
      return [...i.presets, i.defaultDose, i.unit, i.timing, i.schedule];
    };
    expect(d('creatine')).toEqual([3, 4, 5, 5, 'g', 'anytime', 'daily']);
    expect(d('caffeine')).toEqual([100, 200, 300, 400, 200, 'mg', 'preWorkout', 'trainingDays']);
    expect(d('whey')).toEqual([20, 25, 30, 25, 'g', 'postWorkout', 'daily']);
    expect(d('magnesium')).toEqual([200, 300, 400, 300, 'mg', 'evening', 'daily']);
    expect(d('vitaminD')).toEqual([10, 25, 50, 25, 'µg', 'morning', 'daily']);
    expect(d('nitrate')).toEqual([70, 140, 70, 'ml', 'preWorkout', 'trainingDays']);
    expect(d('preWorkout')).toEqual([0.5, 1, 1.5, 1, 'scoop', 'preWorkout', 'trainingDays']);
    expect(d('betaAlanine').slice(0, 3)).toEqual([3.2, 4.8, 6.4]);
  });

  it('every unit is one of g / mg / µg / ml / scoop / serving', () => {
    for (const i of SUPPLEMENT_ITEMS)
      expect(['g', 'mg', 'µg', 'ml', 'scoop', 'serving']).toContain(i.unit);
  });

  it('evidence follows the research: only creatine, caffeine and whey are strong', () => {
    const strong = SUPPLEMENT_ITEMS.filter((i) => i.evidence === 'strong').map((i) => i.id);
    expect(strong.sort()).toEqual(['caffeine', 'creatine', 'whey']);
    for (const id of [
      'preWorkout',
      'betaAlanine',
      'citrulline',
      'nitrate',
      'bicarbonate',
      'casein',
      'plantProtein',
      'melatonin',
    ] as SupplementId[])
      expect(supplementItem(id).evidence).toBe('moderate');
    for (const id of [
      'bcaa',
      'glutamine',
      'hmb',
      'collagen',
      'magnesium',
      'glycine',
      'ashwagandha',
      'omega3',
      'tartCherry',
      'curcumin',
      'multivitamin',
      'zinc',
      'probiotics',
      'vitaminD',
      'iron',
    ] as SupplementId[])
      expect(supplementItem(id).evidence).toBe('weak');
  });

  it('only creatine, caffeine (and the pre-workout blend) and the protein items model an effect', () => {
    const kinds = (k: string) =>
      SUPPLEMENT_ITEMS.filter((i) => i.effect === k)
        .map((i) => i.id)
        .sort();
    expect(kinds('creatine')).toEqual(['creatine']);
    expect(kinds('caffeine')).toEqual(['caffeine', 'preWorkout']);
    expect(kinds('protein')).toEqual(['casein', 'eaa', 'plantProtein', 'whey']);
    expect(SUPPLEMENT_ITEMS.filter((i) => i.effect === 'none')).toHaveLength(31 - 7);
    // Informational labels only: no effect for beta-alanine, bicarbonate, nitrate, citrulline, melatonin.
    for (const id of ['betaAlanine', 'bicarbonate', 'nitrate', 'citrulline', 'melatonin'] as const)
      expect(supplementItem(id).effect).toBe('none');
  });

  it('every source key exists and carries a short citation; unverified ones say so', () => {
    for (const i of SUPPLEMENT_ITEMS)
      if (i.source) expect(SUPPLEMENT_SOURCES[i.source]).toBeDefined();
    expect(SUPPLEMENT_SOURCES.creatine.cite).toBe(
      'Creatine: Kreider 2017, JISSN; Lanhers 2017, Sports Med',
    );
    expect(SUPPLEMENT_SOURCES.caffeine.cite).toBe(
      'Caffeine: Guest 2021, JISSN; Gardiner 2023, Sleep Med Rev',
    );
    expect(SUPPLEMENT_SOURCES.protein.cite).toBe('Protein: Jäger 2017, JISSN; Morton 2018, BJSM');
    expect(SUPPLEMENT_SOURCES.betaAlanine.cite).toBe('Beta-alanine: Saunders 2017, BJSM');
    expect(SUPPLEMENT_SOURCES.bicarbonate.cite).toBe('Bicarbonate: Grgic 2021, JISSN');
    expect(SUPPLEMENT_SOURCES.melatonin.cite).toContain('not re-verified');
    expect(SUPPLEMENT_SOURCES.melatonin.approx).toBe(true);
    expect(SUPPLEMENT_SOURCES.vitaminD.cite).toBe(
      'Vitamin D: Beaudart 2014, JCEM; Tomlinson 2015, JSAMS',
    );
    expect(SUPPLEMENT_SOURCES.antioxidants.cite).toBe('Antioxidants: Paulsen 2014, J Physiol');
    expect(supplementItem('vitaminC').source).toBe('antioxidants');
  });

  it('the disclaimer is the agreed text', () => {
    expect(SUPPLEMENT_DISCLAIMER_EN).toBe(
      'Supplement effects are small, vary between people, and come from studies, not guarantees. This app does not change your training load because of a supplement. Not medical advice. Ask a doctor if you have a condition or take medication.',
    );
  });

  it('safety flags: kidney, hypertension, anticoagulants, WADA, antioxidants, ashwagandha, deficiency', () => {
    const has = (k: (typeof SUPPLEMENT_WARNING_KEYS)[number]) =>
      SUPPLEMENT_ITEMS.filter((i) => i.warnings.includes(k))
        .map((i) => i.id)
        .sort();
    expect(has('kidney')).toEqual(
      ['bicarbonate', 'calcium', 'casein', 'creatine', 'magnesium', 'plantProtein', 'whey'].sort(),
    );
    expect(has('hypertension')).toEqual(['bicarbonate', 'caffeine', 'preWorkout']);
    expect(has('anticoagulants')).toEqual(['curcumin', 'omega3', 'vitaminE']);
    expect(has('wada')).toEqual(['preWorkout']);
    expect(has('antioxidantBlunt')).toEqual(['vitaminC', 'vitaminE']);
    expect(has('ashwagandha')).toEqual(['ashwagandha']);
    expect(has('deficiencyOnly')).toEqual(['iron', 'vitaminD']);
  });

  it('every icon is in the ICONS registry of ui.tsx', async () => {
    const { readFileSync } = await import('node:fs');
    const ui = readFileSync(`${process.cwd()}/src/ui.tsx`, 'utf8');
    const block = ui.slice(
      ui.indexOf('const ICONS'),
      ui.indexOf('\n};', ui.indexOf('const ICONS')),
    );
    const keys = new Set([...block.matchAll(/^\s*'?([a-z0-9-]+)'?:\s*[A-Z]/gm)].map((m) => m[1]));
    const used = [...SUPPLEMENT_ITEMS.map((i) => i.icon), ...Object.values(GROUP_ICONS)];
    expect([...new Set(used.filter((i) => !keys.has(i)))]).toEqual([]);
    for (const k of ['pill', 'flask', 'test-tube', 'coffee']) expect(keys.has(k)).toBe(true);
  });

  it('isSupplementId only accepts catalog ids', () => {
    expect(isSupplementId('creatine')).toBe(true);
    expect(isSupplementId('beerRegular')).toBe(false);
    expect(isSupplementId(5)).toBe(false);
    expect(isSupplementId(undefined)).toBe(false);
  });
});

describe('groups', () => {
  it('have labels, chips, blurbs and an icon each; items resolve to their group', () => {
    for (const g of SUPPLEMENT_GROUPS) {
      expect(GROUP_LABELS[g]).toBeTruthy();
      expect(GROUP_SHORT_LABELS[g]).toBeTruthy();
      expect(GROUP_BLURBS[g]).toBeTruthy();
    }
    expect(GROUP_LABELS.protein).toBe('Protein and aminos');
    expect(groupOf('creatine')).toBe('performance');
    expect(groupOf('casein')).toBe('protein');
    expect(groupOf('melatonin')).toBe('recovery');
    expect(groupOf('zinc')).toBe('health');
  });

  it('entriesInGroup filters saved entries by their item group', () => {
    const list = [entry('creatine'), entry('whey'), entry('caffeine'), entry('zinc')];
    expect(entriesInGroup(list, 'performance').map((e) => e.itemId)).toEqual([
      'creatine',
      'caffeine',
    ]);
    expect(entriesInGroup(list, 'recovery')).toEqual([]);
  });
});

describe('dose maths', () => {
  it('whey: 25 g of powder is 20 g of protein (assumed 80 %); it scales with the dose', () => {
    expect(proteinGramsOf(entry('whey'))).toBe(20);
    expect(proteinGramsOf(entry('whey', { dose: 30 }))).toBe(24);
    expect(proteinGramsOf(entry('whey', { dose: 20 }))).toBe(16);
    expect(proteinGramsOf(entry('casein'))).toBe(24);
    expect(proteinGramsOf(entry('plantProtein'))).toBe(22);
    expect(proteinGramsOf(entry('eaa'))).toBe(9);
  });

  it('items without a protein effect (BCAA, collagen, creatine) add no protein', () => {
    for (const id of ['bcaa', 'collagen', 'glutamine', 'hmb', 'creatine'] as const)
      expect(proteinGramsOf(entry(id))).toBe(0);
    expect(proteinGramsOf({ itemId: 'whey', dose: Number.NaN })).toBe(0);
    expect(proteinGramsOf({ itemId: 'nope' as never, dose: 5 })).toBe(0);
  });

  it('caffeine mg: caffeine is 1 mg per mg, a pre-workout scoop is an assumed 200 mg', () => {
    expect(caffeineMgOf(entry('caffeine'))).toBe(200);
    expect(caffeineMgOf(entry('preWorkout'))).toBe(200);
    expect(caffeineMgOf(entry('preWorkout', { dose: 1.5 }))).toBe(300);
    expect(caffeineMgOf(entry('magnesium'))).toBe(0);
    expect(caffeineMgOfEntries([entry('caffeine'), entry('preWorkout')])).toBe(400);
    expect(proteinGramsOfEntries([entry('whey'), entry('casein')])).toBe(44);
  });

  it('clampDose keeps a dose inside the item range; typed junk falls back to the default', () => {
    const c = supplementItem('creatine');
    expect(clampDose(c, 99)).toBe(20);
    expect(clampDose(c, 0)).toBe(1);
    expect(clampDose(c, Number.NaN)).toBe(5);
    expect(clampDose(c, 3.456)).toBe(3.46);
  });

  it('formats doses and typical ranges', () => {
    expect(formatDose(5, 'g')).toBe('5 g');
    expect(formatDose(1, 'scoop')).toBe('1 scoop');
    expect(formatDose(1.5, 'scoop')).toBe('1.5 scoops');
    expect(formatDose(25, 'µg')).toBe('25 µg');
    expect(typicalText(supplementItem('creatine'))).toBe('3–5 g');
    expect(typicalText(supplementItem('caffeine'))).toBe('100–400 mg');
    expect(typicalText(supplementItem('bicarbonate'))).toBe('0.2–0.3 g per kg');
    expect(typicalText(supplementItem('nitrate'))).toBe('70 ml');
    expect(typicalText(supplementItem('betaAlanine'))).toBe('3.2–6.4 g');
  });

  it('a counted entry is active, known and has a positive dose', () => {
    const list = [
      entry('creatine'),
      entry('whey', { active: false }),
      entry('casein', { dose: 0 }),
      { ...entry('zinc'), itemId: 'bogus' as never },
    ];
    expect(activeSupplementEntries(list).map((e) => e.itemId)).toEqual(['creatine']);
  });
});

describe('describing and summaries', () => {
  it('describeEntry gives the row text, labels and the numbers it feeds', () => {
    const d = describeEntry(entry('whey'))!;
    expect(d.doseText).toBe('25 g');
    expect(d.rowText).toBe('25 g · Post-workout');
    expect(d.scheduleLabel).toBe('Daily');
    expect(d.evidenceLabel).toBe('Strong');
    expect(d.proteinGrams).toBe(20);
    expect(describeEntry(entry('caffeine'))!.caffeineMg).toBe(200);
    expect(describeEntry(entry('caffeine'))!.scheduleLabel).toBe('Training days');
    expect(describeEntry({ ...entry('zinc'), itemId: 'bogus' as never })).toBeNull();
  });

  it('counts schedules: "3 daily · 1 on training days"', () => {
    const list = [
      entry('creatine'),
      entry('whey'),
      entry('magnesium'),
      entry('caffeine'),
      entry('zinc', { active: false }),
    ];
    expect(scheduleCounts(list)).toEqual({ daily: 3, trainingDays: 1 });
    expect(scheduleCounts([])).toEqual({ daily: 0, trainingDays: 0 });
  });

  it('summary: "Creatine + Whey · 2 items", more than two names collapse', () => {
    expect(supplementSummaryText([entry('creatine'), entry('whey')])).toBe(
      'Creatine + Whey · 2 items',
    );
    expect(supplementSummaryText([entry('creatine')])).toBe('Creatine · 1 item');
    expect(
      supplementSummaryText([
        entry('creatine'),
        entry('caffeine'),
        entry('whey'),
        entry('magnesium'),
      ]),
    ).toBe('Creatine + Caffeine + 2 more · 4 items');
    expect(supplementSummaryText([])).toBeNull();
    expect(supplementSummaryText([entry('creatine', { active: false })])).toBeNull();
  });

  it('summary takes localized names, tail and "more"', () => {
    expect(
      supplementSummaryText(
        [entry('creatine'), entry('whey'), entry('zinc')],
        (id) => id.toUpperCase(),
        (n) => `${n} шт.`,
        (n) => `ще ${n}`,
      ),
    ).toBe('CREATINE + WHEY + ще 1 · 3 шт.');
  });
});
