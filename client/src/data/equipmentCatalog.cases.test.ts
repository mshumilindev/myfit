import { describe, expect, it } from 'vitest';
import {
  EQUIPMENT_BY_CATEGORY,
  EQUIPMENT_CATALOG,
  enrichedCatalog,
  equipmentById,
  equipmentItemFitsExercise,
  pickerCategoriesForExercise,
  primaryCategoriesForExercise,
  type EquipCategory,
  type EquipmentItem,
} from './equipmentCatalog';
import type { MuscleGroup } from './exercises';
import { EQUIPMENT_ENRICH } from './equipmentEnrich';
import { EQUIPMENT_IMAGES } from './equipmentImages.generated';
import { EQUIPMENT_IDS } from './equipment';

const CATEGORIES: EquipCategory[] = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'plate',
  'rack',
  'bench',
  'machine',
  'plateLoaded',
  'cable',
  'cardio',
  'band',
  'suspension',
  'conditioning',
  'accessory',
  'recovery',
  'aquatic',
  'assessment',
];

const MUSCLES = new Set([
  'chest',
  'back',
  'lats',
  'traps',
  'lower_back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'adductors',
  'hamstrings',
  'glutes',
  'abductors',
  'calves',
  'core',
  'neck',
  'fullbody',
  'cardio',
]);

function item(over: Partial<EquipmentItem> = {}): EquipmentItem {
  return {
    id: 't1',
    name: 'Test item',
    category: 'accessory',
    cls: 'other',
    muscles: [],
    ...over,
  };
}

describe('catalog data integrity', () => {
  it('has unique, non-empty ids and names', () => {
    const ids = EQUIPMENT_CATALOG.map((e) => e.id);
    expect(ids.every((i) => i.trim() !== '')).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(EQUIPMENT_CATALOG.every((e) => e.name.trim() !== '')).toBe(true);
  });

  it('uses only known categories, coarse classes and muscle groups', () => {
    for (const e of EQUIPMENT_CATALOG) {
      expect(CATEGORIES, e.id).toContain(e.category);
      expect(EQUIPMENT_IDS, e.id).toContain(e.cls);
      for (const m of e.muscles) expect(MUSCLES.has(m), `${e.id}:${m}`).toBe(true);
    }
  });

  it('covers every category at least once', () => {
    for (const c of CATEGORIES) expect(EQUIPMENT_BY_CATEGORY[c]?.length, c).toBeGreaterThan(0);
  });

  it('every enrichment and image refers to a catalog item', () => {
    const ids = new Set(EQUIPMENT_CATALOG.map((e) => e.id));
    for (const k of Object.keys(EQUIPMENT_ENRICH)) expect(ids.has(k), `enrich ${k}`).toBe(true);
    for (const k of Object.keys(EQUIPMENT_IMAGES)) expect(ids.has(k), `image ${k}`).toBe(true);
  });
});

describe('EQUIPMENT_BY_CATEGORY', () => {
  it('partitions the catalog: every item appears exactly once, under its own category', () => {
    const total = Object.values(EQUIPMENT_BY_CATEGORY).reduce((n, l) => n + l.length, 0);
    expect(total).toBe(EQUIPMENT_CATALOG.length);
    for (const [cat, list] of Object.entries(EQUIPMENT_BY_CATEGORY)) {
      for (const e of list) expect(e.category).toBe(cat);
    }
  });

  it('keeps the catalog order inside a category', () => {
    const barbells = EQUIPMENT_CATALOG.filter((e) => e.category === 'barbell').map((e) => e.id);
    expect(EQUIPMENT_BY_CATEGORY.barbell.map((e) => e.id)).toEqual(barbells);
  });
});

describe('equipmentById / enrichedCatalog', () => {
  it('returns undefined for an unknown id', () => {
    expect(equipmentById('nope')).toBeUndefined();
    expect(equipmentById('')).toBeUndefined();
  });

  it('adds only the image to an item that has an image but no enrichment', () => {
    const key = Object.keys(EQUIPMENT_IMAGES).find((k) => !(k in EQUIPMENT_ENRICH))!;
    expect(key).toBeDefined();
    const base = EQUIPMENT_CATALOG.find((e) => e.id === key)!;
    expect(equipmentById(key)).toEqual({ ...base, image: EQUIPMENT_IMAGES[key] });
  });

  it('merges model lines over the base item', () => {
    const id = Object.keys(EQUIPMENT_ENRICH).find(
      (k) => EQUIPMENT_ENRICH[k].models && !(k in EQUIPMENT_IMAGES),
    );
    // not every dataset has an enrich-only item; fall back to any enriched item
    const key = id ?? Object.keys(EQUIPMENT_ENRICH)[0];
    const base = EQUIPMENT_CATALOG.find((e) => e.id === key)!;
    const merged = equipmentById(key)!;
    expect(merged).not.toBe(base);
    expect(merged.id).toBe(base.id);
    expect(merged.name).toBe(base.name);
    expect(merged.models).toEqual(EQUIPMENT_ENRICH[key].models ?? base.models);
  });

  it('attaches the generated image', () => {
    const key = Object.keys(EQUIPMENT_IMAGES)[0];
    expect(equipmentById(key)?.image).toEqual(EQUIPMENT_IMAGES[key]);
  });

  it('a generated image wins over an enrichment image', () => {
    const both = Object.keys(EQUIPMENT_ENRICH).find(
      (k) => EQUIPMENT_ENRICH[k].image && k in EQUIPMENT_IMAGES,
    );
    if (both) expect(equipmentById(both)?.image).toEqual(EQUIPMENT_IMAGES[both]);
    const enrichOnly = Object.keys(EQUIPMENT_ENRICH).find(
      (k) => EQUIPMENT_ENRICH[k].image && !(k in EQUIPMENT_IMAGES),
    );
    if (enrichOnly)
      expect(equipmentById(enrichOnly)?.image).toEqual(EQUIPMENT_ENRICH[enrichOnly].image);
  });

  it('enrichedCatalog keeps size and order and agrees with equipmentById for every item', () => {
    const all = enrichedCatalog();
    expect(all).toHaveLength(EQUIPMENT_CATALOG.length);
    expect(all.map((e) => e.id)).toEqual(EQUIPMENT_CATALOG.map((e) => e.id));
    for (const e of all) expect(e).toEqual(equipmentById(e.id));
  });

  it('does not mutate the source catalog', () => {
    const key = Object.keys(EQUIPMENT_IMAGES)[0];
    const before = EQUIPMENT_CATALOG.find((e) => e.id === key)!;
    const had = 'image' in before;
    enrichedCatalog();
    equipmentById(key);
    expect('image' in before).toBe(had);
  });
});

describe('pickerCategoriesForExercise', () => {
  it('always offers accessories and bands, in display order', () => {
    expect(pickerCategoriesForExercise(['kettlebell'])).toEqual([
      'kettlebell',
      'band',
      'accessory',
    ]);
  });

  it('adds the class-specific categories in display order', () => {
    expect(pickerCategoriesForExercise(['barbell'])).toEqual([
      'barbell',
      'plate',
      'rack',
      'bench',
      'band',
      'accessory',
    ]);
    expect(pickerCategoriesForExercise(['machine'])).toEqual([
      'machine',
      'plateLoaded',
      'band',
      'accessory',
    ]);
  });

  it('unions several classes without duplicates', () => {
    expect(pickerCategoriesForExercise(['barbell', 'dumbbell'])).toEqual([
      'barbell',
      'dumbbell',
      'plate',
      'rack',
      'bench',
      'band',
      'accessory',
    ]);
    expect(pickerCategoriesForExercise(['ezBar', 'barbell'])).toEqual(
      pickerCategoriesForExercise(['barbell']),
    );
  });

  it('falls back to a broad everyday set for no or unknown classes', () => {
    const broad = [
      'barbell',
      'dumbbell',
      'kettlebell',
      'bench',
      'machine',
      'cable',
      'band',
      'accessory',
    ];
    expect(pickerCategoriesForExercise([])).toEqual(broad);
    expect(pickerCategoriesForExercise(['unicorn'])).toEqual(broad);
  });

  it('a band-only exercise gets bands and accessories, not the broad everyday fallback', () => {
    expect(pickerCategoriesForExercise(['bands'])).toEqual(['band', 'accessory']);
  });

  it('bodyweight lifts get rack, suspension and bench, not the broad fallback', () => {
    expect(pickerCategoriesForExercise(['body'])).toEqual([
      'rack',
      'bench',
      'band',
      'suspension',
      'accessory',
    ]);
  });

  it('the generic "other" class opens conditioning, cardio, recovery, aquatic and assessment', () => {
    expect(pickerCategoriesForExercise(['other'])).toEqual([
      'cardio',
      'band',
      'conditioning',
      'aquatic',
      'recovery',
      'accessory',
      'assessment',
    ]);
  });
});

describe('primaryCategoriesForExercise', () => {
  it('drops the universal add-on categories', () => {
    expect(primaryCategoriesForExercise(['barbell'])).toEqual([
      'barbell',
      'plate',
      'rack',
      'bench',
    ]);
  });

  it('keeps the broad fallback primaries for unknown classes', () => {
    expect(primaryCategoriesForExercise(['unicorn'])).toEqual([
      'barbell',
      'dumbbell',
      'kettlebell',
      'bench',
      'machine',
      'cable',
    ]);
  });
});

describe('equipmentItemFitsExercise', () => {
  const squat = {
    classes: ['barbell'],
    muscles: ['quads', 'glutes'] as const,
    primaryCategories: new Set<EquipCategory>(['barbell', 'plate', 'rack', 'bench']),
  };
  const opts = (over: { muscles?: MuscleGroup[] } = {}) => ({
    classes: squat.classes,
    muscles: [...squat.muscles] as MuscleGroup[],
    primaryCategories: squat.primaryCategories,
    ...over,
  });

  it('always fits an item from a primary category, whatever its muscles', () => {
    expect(
      equipmentItemFitsExercise(
        item({ category: 'rack', cls: 'machine', muscles: ['neck'] }),
        opts(),
      ),
    ).toBe(true);
  });

  it('rejects an add-on of a different tool class, even if full-body or muscle-less', () => {
    expect(equipmentItemFitsExercise(item({ cls: 'cable', muscles: ['fullbody'] }), opts())).toBe(
      false,
    );
    expect(equipmentItemFitsExercise(item({ cls: 'dumbbell', muscles: [] }), opts())).toBe(false);
  });

  it('accepts generic support classes (other, body, bands) with no own muscle', () => {
    for (const cls of ['other', 'body', 'bands'] as const) {
      expect(equipmentItemFitsExercise(item({ cls, muscles: [] }), opts()), cls).toBe(true);
    }
  });

  it('accepts an add-on of the exercise tool class', () => {
    expect(equipmentItemFitsExercise(item({ cls: 'barbell', muscles: ['quads'] }), opts())).toBe(
      true,
    );
  });

  it('accepts a full-body add-on whose class is generic', () => {
    expect(equipmentItemFitsExercise(item({ cls: 'other', muscles: ['fullbody'] }), opts())).toBe(
      true,
    );
  });

  it('otherwise needs a muscle overlap with the exercise', () => {
    expect(equipmentItemFitsExercise(item({ cls: 'other', muscles: ['core'] }), opts())).toBe(
      false,
    );
    expect(
      equipmentItemFitsExercise(item({ cls: 'other', muscles: ['core', 'glutes'] }), opts()),
    ).toBe(true);
    expect(
      equipmentItemFitsExercise(item({ cls: 'other', muscles: ['chest'] }), opts({ muscles: [] })),
    ).toBe(false);
  });

  it('works end to end on real catalog data: a squat lists no cable ankle straps', () => {
    const primary = new Set(primaryCategoriesForExercise(['barbell']));
    const fits = EQUIPMENT_CATALOG.filter((e) =>
      equipmentItemFitsExercise(e, {
        classes: ['barbell'],
        muscles: ['quads', 'glutes'],
        primaryCategories: primary,
      }),
    );
    expect(fits.length).toBeGreaterThan(0);
    for (const e of EQUIPMENT_CATALOG.filter((x) => x.category === 'barbell')) {
      expect(fits).toContain(e);
    }
    expect(fits.filter((e) => e.cls === 'cable' || e.cls === 'kettlebell')).toEqual([]);
    // a plain dumbbell is another tool, not an add-on for a barbell squat
    const plainDumbbell = EQUIPMENT_CATALOG.find(
      (e) => e.category === 'dumbbell' && e.cls === 'dumbbell',
    )!;
    expect(fits).not.toContain(plainDumbbell);
  });
});
