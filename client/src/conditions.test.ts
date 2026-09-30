import { describe, expect, it } from 'vitest';
import {
  CONDITION_CATALOG,
  catalogCondition,
  conditionName,
  effectsAt,
  searchConditions,
} from './data/conditionCatalog';
import { loadConditionNames } from './data/conditionNames';
import {
  coachView,
  conditionLimits,
  deidentifiedEffects,
  effectLines,
  exerciseFlag,
  exerciseRisk,
  isAutoExcluded,
  isActive,
  isTemporary,
  pregnancyKeyAt,
  suggestedEnd,
  temporaryProgress,
  TEMPORARY,
  isOtherTab,
  resolveShare,
} from './conditions';
import type { ChronicCondition } from './types';

const mk = (
  key: string,
  severity: 1 | 2 | 3 = 2,
  share: ChronicCondition['share'] = 'inherit',
): ChronicCondition => ({
  id: key,
  key,
  severity,
  share,
  note: 'PRIVATE NOTE',
  createdAt: 0,
});

describe('catalog integrity', () => {
  it('has unique keys and a name/icon for each', () => {
    const keys = CONDITION_CATALOG.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of CONDITION_CATALOG) {
      expect(c.name.length).toBeGreaterThan(1);
      expect(c.icon.length).toBeGreaterThan(0);
    }
  });
  it('keeps every effect number in range', () => {
    for (const c of CONDITION_CATALOG)
      for (const sev of [1, 2, 3] as const) {
        const e = effectsAt(c.effects, sev);
        for (const v of Object.values(e.muscleCaps ?? {})) {
          expect(v).toBeGreaterThan(0);
          expect(v).toBeLessThanOrEqual(1);
        }
        for (const v of [e.volumeScale, e.stepScale])
          if (v != null) {
            expect(v).toBeGreaterThan(0);
            expect(v).toBeLessThanOrEqual(1);
          }
        if (e.rpeMax != null) {
          expect(e.rpeMax).toBeGreaterThanOrEqual(5);
          expect(e.rpeMax).toBeLessThanOrEqual(10);
        }
      }
  });
  it('searches by synonym', () => {
    expect(searchConditions('knee').length).toBeGreaterThan(0);
  });
});

describe('severity scaling', () => {
  it.each(CONDITION_CATALOG.slice(0, 40).map((c) => c.key))(
    '%s: severe is never looser than mild',
    (key) => {
      const c = catalogCondition(key)!;
      const mild = effectsAt(c.effects, 1);
      const severe = effectsAt(c.effects, 3);
      for (const [m, v] of Object.entries(severe.muscleCaps ?? {}))
        expect(v).toBeLessThanOrEqual((mild.muscleCaps as Record<string, number>)[m]);
      if (mild.rpeMax != null && severe.rpeMax != null)
        expect(severe.rpeMax).toBeLessThanOrEqual(mild.rpeMax);
    },
  );
});

describe('stacking', () => {
  it('no conditions = no limits', () => {
    const l = conditionLimits([]);
    expect(l.keys).toEqual([]);
    expect(exerciseFlag('Barbell Squat', l).level).toBe('ok');
  });
  it('ignores unknown keys', () => {
    expect(conditionLimits([mk('nope')]).keys).toEqual([]);
  });
  it('stricter value wins across conditions', () => {
    const a = catalogCondition(CONDITION_CATALOG[0].key)!;
    const b = catalogCondition(CONDITION_CATALOG[1].key)!;
    const l = conditionLimits([mk(a.key), mk(b.key)]);
    const ea = effectsAt(a.effects, 2);
    const eb = effectsAt(b.effects, 2);
    if (ea.rpeMax != null && eb.rpeMax != null)
      expect(l.effects.rpeMax).toBe(Math.min(ea.rpeMax, eb.rpeMax));
    expect(l.keys).toHaveLength(2);
  });
});

describe('exercise risk and flags', () => {
  it.each([
    ['Barbell Deadlift', 'shear'],
    ['Barbell Squat', 'axial'],
    ['Crunches', 'flexion'],
    ['Russian Twist', 'rotation'],
    ['Box Jump', 'impact'],
    ['Pullups', 'hang'],
    ['Back Extension', 'extension'],
  ])('%s carries %s', (name, tag) => {
    expect(exerciseRisk(name, null)).toContain(tag);
  });
  it('stretches carry no risk', () => {
    expect(
      exerciseRisk('Hamstring Stretch', { category: 'stretching', primaryMuscles: [] } as never),
    ).toEqual([]);
  });
  it('flags by the condition that causes it', () => {
    const l = conditionLimits([mk('back_lumbar_disc', 3)]);
    expect(l.keys).toEqual(['back_lumbar_disc']);
    const f = exerciseFlag('Barbell Deadlift', l, null);
    expect(['caution', 'avoid']).toContain(f.level);
    expect(f.because).toContain('back_lumbar_disc');
  });
  it('auto exclusion only for avoid', () => {
    const l = conditionLimits([]);
    expect(isAutoExcluded('Barbell Squat', l)).toBe(false);
  });
});

describe('sharing', () => {
  const list = [
    mk(CONDITION_CATALOG[0].key, 2, 'effects'),
    mk(CONDITION_CATALOG[1].key, 2, 'full'),
    mk(CONDITION_CATALOG[2].key, 2, 'off'),
    mk(CONDITION_CATALOG[3].key),
  ];
  it('inherit follows the general default', () => {
    expect(resolveShare(mk('x'), 'effects')).toBe('effects');
    expect(resolveShare(mk('x', 2, 'off'), 'full')).toBe('off');
  });
  it('default off shares nothing for inherit', () => {
    const v = coachView([mk(CONDITION_CATALOG[3].key)], 'off');
    expect(v.full).toEqual([]);
    expect(v.effects).toEqual([]);
  });
  it('never leaks notes, names or off conditions', () => {
    const v = coachView(list, 'off');
    const json = JSON.stringify(v);
    expect(json).not.toContain('PRIVATE NOTE');
    expect(v.full.map((x) => x.key)).toEqual([CONDITION_CATALOG[1].key]);
    for (const c of CONDITION_CATALOG.slice(0, 4))
      expect(JSON.stringify(v.effects)).not.toContain(c.name);
  });
  it('de-identified effects carry no keys or notes', () => {
    const json = JSON.stringify(deidentifiedEffects(list));
    expect(json).not.toContain('PRIVATE NOTE');
    for (const c of list) expect(json).not.toContain(c.key);
  });
});

const D = 86_400_000;
describe('temporary conditions', () => {
  it('every temporary key exists in the catalogue', () => {
    for (const k of Object.keys(TEMPORARY)) expect(catalogCondition(k)).not.toBeNull();
  });
  it('pregnancy stage follows the start date', () => {
    const t0 = 1_000_000 * D;
    expect(pregnancyKeyAt(t0, t0 + 7 * 7 * D)).toBe('preg_first');
    expect(pregnancyKeyAt(t0, t0 + 20 * 7 * D)).toBe('preg_second');
    expect(pregnancyKeyAt(t0, t0 + 34 * 7 * D)).toBe('preg_third');
    const c = { ...mk('preg_first'), startedAt: t0, endsAt: suggestedEnd('preg_first', t0) };
    expect(conditionLimits([c], t0 + 34 * 7 * D).keys).toEqual(['preg_third']);
  });
  it('is inactive before it starts and after it ends', () => {
    const t0 = 1_000_000 * D;
    const c = { ...mk('postop_knee'), startedAt: t0, endsAt: t0 + 10 * D };
    expect(isActive(c, t0 - D)).toBe(false);
    expect(isActive(c, t0 + 5 * D)).toBe(true);
    expect(conditionLimits([c], t0 + 11 * D).keys).toEqual([]);
    expect(coachView([{ ...c, share: 'full' }], 'off', t0 + 11 * D).full).toEqual([]);
  });
  it('permanent conditions ignore dates', () => {
    expect(isTemporary('back_lumbar_disc')).toBe(false);
    expect(isActive(mk('back_lumbar_disc'), 0)).toBe(true);
  });
  it('reports progress', () => {
    const t0 = 1_000_000 * D;
    const p = temporaryProgress(
      { ...mk('postop_knee'), startedAt: t0, endsAt: t0 + 100 * D },
      t0 + 24 * D,
    )!;
    expect(p.day).toBe(25);
    expect(p.total).toBe(100);
    expect(p.daysLeft).toBe(76);
  });
  it('every condition is reachable from a body layer or the Other tab', () => {
    const regions = new Set([
      'neck',
      'upper_back',
      'lower_back',
      'shoulder',
      'elbow',
      'wrist',
      'hip',
      'knee',
      'ankle',
      'foot',
      'heart',
      'lungs',
      'brain',
      'abdomen',
    ]);
    for (const c of CONDITION_CATALOG) expect(regions.has(c.region) || isOtherTab(c)).toBe(true);
    for (const c of CONDITION_CATALOG.filter((x) => x.region === 'whole'))
      expect(isOtherTab(c)).toBe(true);
  });
});

describe('catalogue icons', () => {
  it('every condition and category icon exists in the icon registry', async () => {
    const { readFileSync } = await import('node:fs');
    const ui = readFileSync(`${process.cwd()}/src/ui.tsx`, 'utf8');
    const block = ui.slice(
      ui.indexOf('const ICONS'),
      ui.indexOf('\n};', ui.indexOf('const ICONS')),
    );
    const keys = new Set([...block.matchAll(/^\s*'?([a-z0-9-]+)'?:\s*[A-Z]/gm)].map((m) => m[1]));
    const { CONDITION_CATALOG, CONDITION_CATEGORIES } = await import('./data/conditionCatalog');
    const used = [
      ...CONDITION_CATALOG.map((c) => c.icon),
      ...CONDITION_CATEGORIES.map((c) => c.icon),
    ];
    expect([...new Set(used.filter((i) => !keys.has(i)))]).toEqual([]);
  });
});

describe('body map reachability', () => {
  it('every catalogue condition is reachable from a body area or the Other tab', async () => {
    const { AREAS } = await import('./views/health/BodyMapPicker');
    const { isOtherTab } = await import('./conditions');
    const regions = new Set(Object.values(AREAS).flatMap((l) => l.flatMap((a) => a.regions)));
    const missing = CONDITION_CATALOG.filter((c) => !regions.has(c.region) && !isOtherTab(c));
    expect(missing.map((c) => c.key)).toEqual([]);
  });
});

describe('restScale', () => {
  it('is only set as a multiplier of at least 1 and never shrinks with severity', () => {
    let any = false;
    for (const c of CONDITION_CATALOG) {
      const v = [1, 2, 3].map((sev) => effectsAt(c.effects, sev as 1 | 2 | 3).restScale ?? 1);
      for (const x of v) {
        expect(x).toBeGreaterThanOrEqual(1);
        expect(x).toBeLessThanOrEqual(2);
      }
      expect(v[0]).toBeLessThanOrEqual(v[1]);
      expect(v[1]).toBeLessThanOrEqual(v[2]);
      if (c.effects.restScale) any = true;
    }
    expect(any).toBe(true);
  });
  it('appears as an effect line for affected conditions', () => {
    const c = CONDITION_CATALOG.find((x) => x.effects.restScale);
    expect(c).toBeTruthy();
    expect(effectLines(effectsAt(c!.effects, 2)).some((l) => l.id === 'restScale')).toBe(true);
  });
});

describe('body map highlights', () => {
  it('every body area highlights something', async () => {
    const { AREAS } = await import('./views/health/BodyMapPicker');
    const empty = Object.values(AREAS).flatMap((l) =>
      l.filter((a) => a.marks.length === 0 && !a.organs?.length),
    );
    expect(empty.map((a) => a.id)).toEqual([]);
  });
});

describe('condition name localisation', () => {
  it.each(['uk', 'pl', 'lt', 'et'] as const)('%s has exactly the catalogue keys', async (loc) => {
    const { default: table } = await import(`./data/conditionNames/${loc}.ts`);
    const keys = CONDITION_CATALOG.map((c) => c.key).sort();
    expect(Object.keys(table).sort()).toEqual(keys);
    for (const k of keys) expect(table[k].name.trim().length).toBeGreaterThan(1);
  });

  it('falls back to English and searches localised names once loaded', async () => {
    expect(conditionName('knee_pain', 'uk')).toBe('Chronic knee pain');
    await loadConditionNames('uk');
    expect(conditionName('knee_pain', 'uk')).toBe('Хронічний біль у коліні');
    expect(searchConditions('ішіас', 'uk').map((c) => c.key)).toContain('back_sciatica');
    expect(searchConditions('sciatica', 'uk').map((c) => c.key)).toContain('back_sciatica');
  });
});
