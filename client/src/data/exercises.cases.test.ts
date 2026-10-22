import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RICH from './exercises.rich.json';
import SUBREGIONS from './subregionTags.json';
import {
  BUILT_IN_CATALOG,
  MARKER_IMAGES,
  canonicalExerciseName,
  customExercises,
  exerciseImage,
  exerciseSearchText,
  exercisesForSubRegions,
  isBuiltInExercise,
  isCardioExerciseName,
  loadExerciseInstructions,
  localizedCatalogNames,
  muscleInfoByName,
  registerCustomExercise,
  registerCustomExercises,
  richExerciseById,
  richExerciseByName,
  searchCatalog,
  secondaryMusclesOf,
  subRegionsById,
  subRegionsByName,
  type CustomExercise,
} from './exercises';

const BENCH = 'Barbell Bench Press - Medium Grip';

function custom(over: Partial<CustomExercise> = {}): CustomExercise {
  return {
    id: 'c1',
    name: 'Zottman Curl Deluxe',
    primaryMuscle: 'biceps',
    secondaryMuscles: ['forearms'],
    equipment: ['dumbbell'],
    ...over,
  };
}

beforeEach(() => {
  localStorage.clear();
  registerCustomExercises([]);
});
afterEach(() => {
  registerCustomExercises([]);
  localStorage.clear();
});

describe('built-in catalog', () => {
  it('exposes one entry per rich record, with the English name in all five slots', () => {
    expect(BUILT_IN_CATALOG).toHaveLength(RICH.length);
    const bench = BUILT_IN_CATALOG.find((e) => e.id === 'Barbell_Bench_Press_-_Medium_Grip')!;
    expect(bench).toEqual({
      id: 'Barbell_Bench_Press_-_Medium_Grip',
      muscle: 'chest',
      names: [BENCH, BENCH, BENCH, BENCH, BENCH],
      equipment: 'barbell',
    });
  });

  it('looks rich records up by id and by (any-case, padded) name', () => {
    expect(richExerciseById('Barbell_Deadlift')?.name).toBe('Barbell Deadlift');
    expect(richExerciseById('nope')).toBeNull();
    expect(richExerciseById(null)).toBeNull();
    expect(richExerciseById(undefined)).toBeNull();
    expect(richExerciseByName('  BARBELL deadlift ')?.id).toBe('Barbell_Deadlift');
    expect(richExerciseByName('nope')).toBeNull();
    expect(richExerciseByName('')).toBeNull();
    expect(richExerciseByName(null)).toBeNull();
  });

  it('resolves legacy aliases to the rich record', () => {
    expect(richExerciseByName('deadlift')?.id).toBe('Barbell_Deadlift');
    expect(richExerciseByName('Back Squat')?.id).toBe('Barbell_Full_Squat');
  });
});

describe('names', () => {
  it('canonicalises legacy aliases and trims, leaving unknown names untouched', () => {
    expect(canonicalExerciseName('Back Squat')).toBe('Barbell Full Squat');
    expect(canonicalExerciseName('  bench press ')).toBe(BENCH);
    expect(canonicalExerciseName('розведення гантелей лежачи')).toBe('Dumbbell Flyes');
    expect(canonicalExerciseName('  My Own Move ')).toBe('My Own Move');
    expect(canonicalExerciseName(BENCH.toUpperCase())).toBe(BENCH);
  });

  it('isBuiltInExercise accepts canonical names and aliases, not custom or empty ones', () => {
    expect(isBuiltInExercise(BENCH)).toBe(true);
    expect(isBuiltInExercise('  squat ')).toBe(true);
    expect(isBuiltInExercise('')).toBe(false);
    expect(isBuiltInExercise('Zottman Curl Deluxe')).toBe(false);
    registerCustomExercise(custom());
    expect(isBuiltInExercise('Zottman Curl Deluxe')).toBe(false);
  });

  it('localizedCatalogNames returns the translations, or nothing for an unknown name', () => {
    expect(localizedCatalogNames('3/4 Sit-Up')).toEqual(
      expect.arrayContaining(['Brzuszki 3/4', 'Підйом корпусу 3/4']),
    );
    expect(localizedCatalogNames('3/4 Sit-Up')).toHaveLength(4);
    expect(localizedCatalogNames('No Such Exercise')).toEqual([]);
  });
});

describe('muscleInfoByName', () => {
  it('reads primary, secondary and equipment from the rich record', () => {
    expect(muscleInfoByName(BENCH)).toEqual({
      primary: 'chest',
      secondary: ['shoulders', 'triceps'],
      equipment: 'barbell',
    });
    expect(muscleInfoByName('barbell deadlift')?.primary).toBe('lower_back');
  });

  it('gives an alias the same info as its canonical exercise', () => {
    expect(muscleInfoByName('bench press')).toEqual(muscleInfoByName(BENCH));
    expect(muscleInfoByName('Squat')).toEqual(muscleInfoByName('Barbell Full Squat'));
  });

  it('is null for unknown or empty names', () => {
    expect(muscleInfoByName('definitely not a lift')).toBeNull();
    expect(muscleInfoByName('   ')).toBeNull();
  });

  it('a built-in with no equipment reports null equipment', () => {
    const noEquip = RICH.find((e) => e.equipment === null)!;
    expect(muscleInfoByName(noEquip.name)?.equipment).toBeNull();
  });

  it('custom exercises resolve their own muscles and first equipment', () => {
    registerCustomExercise(custom({ equipment: ['cable', 'body'] }));
    expect(muscleInfoByName('  zottman curl deluxe ')).toEqual({
      primary: 'biceps',
      secondary: ['forearms'],
      equipment: 'cable',
    });
    registerCustomExercise(custom({ equipment: [] }));
    expect(muscleInfoByName('Zottman Curl Deluxe')?.equipment).toBeNull();
  });

  it('a custom exercise without a primary muscle does not resolve', () => {
    registerCustomExercise(custom({ primaryMuscle: null }));
    expect(muscleInfoByName('Zottman Curl Deluxe')).toBeNull();
  });

  it('a custom exercise reusing a built-in name overrides it; reusing an alias does not', () => {
    registerCustomExercise(custom({ id: 'x', name: 'Barbell Deadlift', primaryMuscle: 'glutes' }));
    expect(muscleInfoByName('Barbell Deadlift')?.primary).toBe('glutes');
    registerCustomExercise(custom({ id: 'y', name: 'deadlift', primaryMuscle: 'neck' }));
    expect(muscleInfoByName('deadlift')?.primary).toBe('lower_back');
  });
});

describe('custom exercise registry', () => {
  it('registers a list, persists it and exposes it', () => {
    const list = [custom(), custom({ id: 'c2', name: 'Other' })];
    registerCustomExercises(list);
    expect(customExercises()).toBe(list);
    expect(JSON.parse(localStorage.getItem('gym.catalog')!)).toEqual(list);
  });

  it('registerCustomExercise adds or replaces by id', () => {
    registerCustomExercise(custom());
    registerCustomExercise(custom({ id: 'c2', name: 'Second' }));
    registerCustomExercise(custom({ name: 'Renamed' }));
    expect(customExercises().map((e) => [e.id, e.name])).toEqual([
      ['c2', 'Second'],
      ['c1', 'Renamed'],
    ]);
    expect(muscleInfoByName('Zottman Curl Deluxe')).toBeNull();
    expect(muscleInfoByName('Renamed')?.primary).toBe('biceps');
  });

  it('replacing the list drops names that are no longer present', () => {
    registerCustomExercises([custom()]);
    registerCustomExercises([]);
    expect(muscleInfoByName('Zottman Curl Deluxe')).toBeNull();
  });

  it('ignores blank names in the lookup but keeps the entry', () => {
    registerCustomExercises([custom({ name: '   ' })]);
    expect(customExercises()).toHaveLength(1);
    expect(muscleInfoByName('   ')).toBeNull();
  });

  it('survives a full localStorage', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    try {
      expect(() => registerCustomExercises([custom()])).not.toThrow();
      expect(customExercises()).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('secondaryMusclesOf prefers a custom entry, then the rich record, else none', () => {
    registerCustomExercise(custom({ secondaryMuscles: ['forearms', 'core'] }));
    const entry = searchCatalog('Zottman')[0];
    expect(entry.id).toBe('custom-c1');
    expect(secondaryMusclesOf(entry)).toEqual(['forearms', 'core']);
    const bench = BUILT_IN_CATALOG.find((e) => e.names[0] === BENCH)!;
    expect(secondaryMusclesOf(bench)).toEqual(['shoulders', 'triceps']);
    expect(
      secondaryMusclesOf({ id: 'unknown', muscle: 'chest', names: ['q', 'q', 'q', 'q', 'q'] }),
    ).toEqual([]);
    // a "custom-" id that is not registered falls through to the name lookup
    expect(
      secondaryMusclesOf({
        id: 'custom-zzz',
        muscle: 'chest',
        names: [BENCH, BENCH, BENCH, BENCH, BENCH],
      }),
    ).toEqual(['shoulders', 'triceps']);
  });
});

describe('isCardioExerciseName', () => {
  it('uses the rich category for built-ins', () => {
    expect(isCardioExerciseName('Jogging, Treadmill')).toBe(true);
    expect(isCardioExerciseName(BENCH)).toBe(false);
  });

  it('is false for empty or unknown names', () => {
    expect(isCardioExerciseName(null)).toBe(false);
    expect(isCardioExerciseName(undefined)).toBe(false);
    expect(isCardioExerciseName('')).toBe(false);
    expect(isCardioExerciseName('totally unknown')).toBe(false);
  });

  it('treats a custom exercise whose primary muscle is cardio as cardio', () => {
    registerCustomExercise(custom({ name: 'Sled Drag Zone', primaryMuscle: 'cardio' }));
    expect(isCardioExerciseName('Sled Drag Zone')).toBe(true);
    registerCustomExercise(custom({ name: 'Sled Drag Zone', primaryMuscle: 'quads' }));
    expect(isCardioExerciseName('Sled Drag Zone')).toBe(false);
  });
});

describe('exerciseImage', () => {
  it('returns the dedicated photo for warm-up and cool-down markers whatever the name', () => {
    expect(exerciseImage('anything', 'warmup')).toBe('/markers/warmup.jpg');
    expect(exerciseImage(null, 'cooldown')).toBe('/markers/cooldown.jpg');
    expect(MARKER_IMAGES).toEqual({
      warmup: '/markers/warmup.jpg',
      cooldown: '/markers/cooldown.jpg',
    });
  });

  it('returns the first catalog photo for a lift, nothing for unknown names', () => {
    expect(exerciseImage(BENCH)).toBe('/exercise-img/Barbell_Bench_Press_-_Medium_Grip/0.webp');
    expect(exerciseImage(BENCH, 'strength')).toBe(
      '/exercise-img/Barbell_Bench_Press_-_Medium_Grip/0.webp',
    );
    expect(exerciseImage('nope')).toBeUndefined();
    expect(exerciseImage(undefined)).toBeUndefined();
  });
});

describe('loadExerciseInstructions', () => {
  it('returns [] without an id or for an unknown id', async () => {
    expect(await loadExerciseInstructions(null)).toEqual([]);
    expect(await loadExerciseInstructions(undefined)).toEqual([]);
    expect(await loadExerciseInstructions('')).toEqual([]);
    expect(await loadExerciseInstructions('No_Such_Id')).toEqual([]);
  });

  it('lazy-loads the steps for a known id, and keeps working on repeat calls', async () => {
    const first = await loadExerciseInstructions('3_4_Sit-Up');
    expect(first).toHaveLength(5);
    expect(first[0]).toMatch(/^Lie down on the floor/);
    expect(await loadExerciseInstructions('3_4_Sit-Up')).toEqual(first);
  });
});

describe('sub-regions', () => {
  it('looks an id up in the curated overlay', () => {
    expect(subRegionsById('Alternating_Cable_Shoulder_Press')).toEqual({ primary: ['delt-front'] });
    expect(subRegionsById('Ab_Roller')).toEqual({ primary: [], secondary: ['delt-front'] });
    expect(subRegionsById('nope')).toBeNull();
  });

  it('looks a name up through the rich record', () => {
    expect(subRegionsByName(' alternating CABLE shoulder press ')).toEqual({
      primary: ['delt-front'],
    });
    expect(subRegionsByName('Barbell Deadlift')).toBeNull();
    expect(subRegionsByName('nope')).toBeNull();
  });

  it('a custom exercise with sub-regions wins over the overlay, by id and by name', () => {
    const sub = { primary: ['delt-rear' as const] };
    registerCustomExercise(
      custom({ id: 'Alternating_Cable_Shoulder_Press', name: 'Rear Delt Thing', subRegions: sub }),
    );
    expect(subRegionsById('Alternating_Cable_Shoulder_Press')).toBe(sub);
    expect(subRegionsByName('rear delt thing')).toBe(sub);
    registerCustomExercise(custom({ id: 'plain', name: 'No Sub Regions' }));
    expect(subRegionsById('plain')).toBeNull();
    expect(subRegionsByName('No Sub Regions')).toBeNull();
  });

  it('exercisesForSubRegions returns real strength moves for each requested region', () => {
    const regions = ['delt-front', 'chest-upper'] as const;
    const out = exercisesForSubRegions([...regions], 2, 6);
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThanOrEqual(4);
    expect(new Set(out.map((o) => o.name)).size).toBe(out.length);
    for (const o of out) {
      const rich = RICH.find((r) => r.name === o.name)!;
      expect(rich.category).toBe('strength');
      expect((SUBREGIONS as Record<string, { primary: string[] }>)[rich.id].primary).toContain(
        o.region,
      );
      expect(o.name).not.toMatch(/stretch|circle|warm|mobility|drill/i);
    }
    expect(out.filter((o) => o.region === 'delt-front')).toHaveLength(2);
  });

  it('honours perRegion and cap, and returns nothing for no regions', () => {
    expect(exercisesForSubRegions([])).toEqual([]);
    expect(exercisesForSubRegions(['delt-front'], 1)).toHaveLength(1);
    expect(exercisesForSubRegions(['delt-front', 'chest-upper'], 5, 3)).toHaveLength(3);
  });
});

describe('exerciseSearchText', () => {
  it('joins the English and localized names with muscle and equipment words, lower-cased', () => {
    const hay = exerciseSearchText('3/4 Sit-Up', ['core'], 'body');
    expect(hay).toContain('3/4 sit-up');
    expect(hay).toContain('brzuszki 3/4');
    expect(hay).toContain('підйом корпусу 3/4');
    expect(hay).toBe(hay.toLowerCase());
  });

  it('adds muscle names for every locale', () => {
    const hay = exerciseSearchText('Zzz Unlisted Move', ['chest'], null);
    expect(hay.startsWith('zzz unlisted move')).toBe(true);
    // chest in en and in at least one other locale
    expect(hay).toContain('chest');
    expect(hay.split(' ').length).toBeGreaterThan(4);
  });

  it('is memoized per English name', () => {
    const a = exerciseSearchText('Zzz Memo Move', ['chest'], null);
    const b = exerciseSearchText('Zzz Memo Move', ['chest'], null);
    expect(b).toBe(a);
  });
});

describe('searchCatalog', () => {
  it('returns nothing for a blank query with no filter', () => {
    expect(searchCatalog('')).toEqual([]);
    expect(searchCatalog('   ')).toEqual([]);
  });

  it('puts prefix matches before contained matches and respects the limit', () => {
    expect(searchCatalog('bench', 3)).toHaveLength(3);
    const res = searchCatalog('barbell bench', 60);
    const isPrefix = (e: { names: string[] }) =>
      e.names[0].toLowerCase().startsWith('barbell bench');
    const prefixCount = res.filter(isPrefix).length;
    expect(prefixCount).toBeGreaterThan(0);
    expect(prefixCount).toBeLessThan(res.length);
    expect(res.slice(0, prefixCount).every(isPrefix)).toBe(true);
    expect(res.slice(prefixCount).some(isPrefix)).toBe(false);
  });

  it('matches names typed in another language', () => {
    const res = searchCatalog('brzuszki 3/4');
    expect(res.map((e) => e.names[0])).toContain('3/4 Sit-Up');
  });

  it('matches across words in any order (contains)', () => {
    const res = searchCatalog('press bench barbell', 50);
    expect(res.map((e) => e.names[0])).toContain(BENCH);
  });

  it('browses by equipment and/or muscle without a query', () => {
    const cable = searchCatalog('', 10, 'cable');
    expect(cable).toHaveLength(10);
    expect(cable.every((e) => e.equipment === 'cable')).toBe(true);
    const chestOnly = searchCatalog('', 10, undefined, 'chest');
    expect(chestOnly).toHaveLength(10);
    const both = searchCatalog('', 500, 'barbell', 'triceps');
    expect(both.length).toBeGreaterThan(0);
    expect(both.every((e) => e.equipment === 'barbell')).toBe(true);
    expect(
      both.every((e) => e.muscle === 'triceps' || secondaryMusclesOf(e).includes('triceps')),
    ).toBe(true);
  });

  it('a null equipment filter selects the entries with no equipment', () => {
    const res = searchCatalog('', 5, null);
    expect(res).toHaveLength(5);
    expect(res.every((e) => (e.equipment ?? null) === null)).toBe(true);
  });

  it('combines a query with the filters', () => {
    const res = searchCatalog('curl', 20, 'dumbbell');
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((e) => e.equipment === 'dumbbell')).toBe(true);
    expect(searchCatalog('bench', 20, 'foamRoll')).toEqual([]);
  });

  it('lists custom exercises first, as custom-<id> entries, unless they alias a built-in', () => {
    registerCustomExercises([
      custom({ id: 'k1', name: 'Barbell Curl Zed' }),
      custom({ id: 'k2', name: 'bench press' }), // legacy alias of a built-in
    ]);
    const res = searchCatalog('barbell curl zed');
    expect(res[0]).toEqual({
      id: 'custom-k1',
      muscle: 'biceps',
      names: [
        'Barbell Curl Zed',
        'Barbell Curl Zed',
        'Barbell Curl Zed',
        'Barbell Curl Zed',
        'Barbell Curl Zed',
      ],
      equipment: 'dumbbell',
    });
    expect(searchCatalog('bench press', 50).some((e) => e.id === 'custom-k2')).toBe(false);
  });

  it('a custom entry with no muscle or equipment becomes fullbody / null', () => {
    registerCustomExercise(
      custom({ id: 'k3', name: 'Qwertyuiop', primaryMuscle: null, equipment: [] }),
    );
    expect(searchCatalog('qwertyuiop')[0]).toMatchObject({
      id: 'custom-k3',
      muscle: 'fullbody',
      equipment: null,
    });
  });
});

describe('with synthetic source data', () => {
  type Mod = typeof import('./exercises');

  async function loadWith(opts: {
    rich: unknown[];
    db?: unknown[];
    sub?: Record<string, unknown>;
    overrides?: Record<string, string[]>;
    cache?: string;
  }): Promise<Mod> {
    vi.resetModules();
    vi.doMock('./exercises.rich.json', () => ({ default: opts.rich }));
    vi.doMock('./exercises.db.json', () => ({ default: opts.db ?? [] }));
    vi.doMock('./subregionTags.json', () => ({ default: opts.sub ?? {} }));
    vi.doMock('./exerciseImageOverrides.json', () => ({ default: opts.overrides ?? {} }));
    if (opts.cache !== undefined) localStorage.setItem('gym.catalog', opts.cache);
    return import('./exercises');
  }

  afterEach(() => {
    vi.doUnmock('./exercises.rich.json');
    vi.doUnmock('./exercises.db.json');
    vi.doUnmock('./subregionTags.json');
    vi.doUnmock('./exerciseImageOverrides.json');
    vi.resetModules();
  });

  const rich = (
    id: string,
    name: string,
    equipment: string | null,
    primary: string[],
    over: Record<string, unknown> = {},
  ) => ({
    id,
    name,
    force: null,
    level: null,
    mechanic: null,
    category: 'strength',
    equipment,
    primaryMuscles: primary,
    secondaryMuscles: [],
    images: [`/img/${id}/0.jpg`],
    ...over,
  });

  it('falls back to fullbody / cardio when a rich record has no primary muscle', async () => {
    const mod = await loadWith({
      rich: [
        rich('a', 'Mystery Move', null, []),
        rich('b', 'Bike Thing', null, [], { category: 'cardio' }),
      ],
    });
    expect(mod.BUILT_IN_CATALOG.map((e) => e.muscle)).toEqual(['fullbody', 'cardio']);
    expect(mod.muscleInfoByName('Mystery Move')?.primary).toBe('fullbody');
    expect(mod.isCardioExerciseName('Bike Thing')).toBe(true);
  });

  it('keeps compact DB rows the rich import lacks, as back-compat db-N entries', async () => {
    const mod = await loadWith({
      rich: [rich('a', 'Known Move', 'barbell', ['chest'])],
      db: [
        ['Known Move', 'barbell', 'chest'], // already rich -> dropped
        ['Legacy Row', 'cable', 'back'],
        ['Legacy Free', null, 'core'],
      ],
    });
    expect(mod.BUILT_IN_CATALOG.map((e) => e.id)).toEqual(['a', 'db-0', 'db-1']);
    expect(mod.BUILT_IN_CATALOG[1]).toEqual({
      id: 'db-0',
      muscle: 'back',
      names: ['Legacy Row', 'Legacy Row', 'Legacy Row', 'Legacy Row', 'Legacy Row'],
      equipment: 'cable',
    });
    expect(mod.muscleInfoByName('legacy row')).toEqual({
      primary: 'back',
      secondary: [],
      equipment: 'cable',
    });
    expect(mod.muscleInfoByName('Legacy Free')?.equipment).toBeNull();
    expect(mod.isBuiltInExercise('Legacy Row')).toBe(true);
    expect(mod.richExerciseByName('Legacy Row')).toBeNull();
    expect(mod.exerciseImage('Legacy Row')).toBeUndefined();
  });

  it('applies approved image overrides, ignoring empty ones', async () => {
    const mod = await loadWith({
      rich: [
        rich('a', 'Overridden', null, ['chest']),
        rich('b', 'Empty Override', null, ['chest']),
        rich('c', 'Untouched', null, ['chest']),
      ],
      overrides: { a: ['/new/a0.jpg', '/new/a1.jpg'], b: [] },
    });
    expect(mod.richExerciseById('a')?.images).toEqual(['/new/a0.jpg', '/new/a1.jpg']);
    expect(mod.exerciseImage('Overridden')).toBe('/new/a0.jpg');
    expect(mod.richExerciseById('b')?.images).toEqual(['/img/b/0.jpg']);
    expect(mod.exerciseImage('Untouched')).toBe('/img/c/0.jpg');
  });

  it('restores custom exercises from the cached list at start-up', async () => {
    const list = [custom({ id: 'persisted', name: 'Persisted Move' })];
    const mod = await loadWith({ rich: [], cache: JSON.stringify(list) });
    expect(mod.customExercises()).toEqual(list);
    expect(mod.muscleInfoByName('persisted move')?.primary).toBe('biceps');
  });

  it('ignores a corrupted or non-array cache', async () => {
    expect((await loadWith({ rich: [], cache: '{oops' })).customExercises()).toEqual([]);
    expect((await loadWith({ rich: [], cache: '{"a":1}' })).customExercises()).toEqual([]);
  });

  describe('sub-region suggestions', () => {
    const data = {
      rich: [
        rich('A', 'Cable Fly', 'cable', ['chest']),
        rich('B', 'Dumbbell Press', 'dumbbell', ['chest']),
        rich('C', 'Chest Stretch', 'dumbbell', ['chest']),
        rich('D', 'Machine Press', 'machine', ['chest']),
        rich('E', 'Bike Thing', 'machine', ['chest'], { category: 'cardio' }),
        rich('G', 'Body Dip', 'body', ['chest']),
        rich('H', 'Barbell Press', 'barbell', ['chest']),
        rich('I', 'Odd Tool Press', 'other', ['chest']),
        rich('J', 'Band Row', 'bands', ['chest']),
      ],
      sub: {
        A: { primary: ['chest-upper'] },
        B: { primary: ['chest-upper'] },
        C: { primary: ['chest-upper'] },
        D: { primary: ['chest-upper'] },
        E: { primary: ['chest-lower'] },
        G: { primary: ['chest-lower'] },
        H: { primary: ['chest-upper', 'chest-lower'] },
        I: { primary: ['chest-lower'] },
        J: { primary: ['chest-lower'] },
        Z: { primary: ['chest-lower'] }, // no catalog entry behind it
      },
    };

    it('ranks by specificity, then tool realism, then name; skips stretches and non-strength', async () => {
      const mod = await loadWith(data);
      const names = (n: number) =>
        mod.exercisesForSubRegions(['chest-upper'], n, 10).map((o) => o.name);
      expect(names(2)).toEqual(['Cable Fly', 'Dumbbell Press']);
      expect(names(3)).toEqual(['Cable Fly', 'Dumbbell Press', 'Machine Press']);
      // H hits two regions (less specific) so it comes last; the stretch never appears
      expect(names(10)).toEqual(['Cable Fly', 'Dumbbell Press', 'Machine Press', 'Barbell Press']);
    });

    it('ranks body before unknown tools and drops cardio-category moves', async () => {
      const mod = await loadWith(data);
      const lower = mod.exercisesForSubRegions(['chest-lower'], 10, 10).map((o) => o.name);
      // specific first: Body Dip (body=3), Odd Tool Press (other=4), Band Row (bands=4) by name; then multi-region H
      expect(lower).toEqual(['Body Dip', 'Band Row', 'Odd Tool Press', 'Barbell Press']);
      expect(lower).not.toContain('Bike Thing');
    });

    it('does not repeat a move across regions and stops exactly at the cap', async () => {
      const mod = await loadWith(data);
      const both = mod.exercisesForSubRegions(['chest-upper', 'chest-lower'], 4, 20);
      expect(both.map((o) => [o.name, o.region])).toEqual([
        ['Cable Fly', 'chest-upper'],
        ['Dumbbell Press', 'chest-upper'],
        ['Machine Press', 'chest-upper'],
        ['Barbell Press', 'chest-upper'],
        ['Body Dip', 'chest-lower'],
        ['Band Row', 'chest-lower'],
        ['Odd Tool Press', 'chest-lower'],
      ]);
      expect(mod.exercisesForSubRegions(['chest-upper', 'chest-lower'], 4, 3)).toHaveLength(3);
      expect(
        mod
          .exercisesForSubRegions(['chest-upper', 'chest-lower'], 4, 5)
          .map((o) => o.name)
          .at(-1),
      ).toBe('Body Dip');
    });

    it('returns nothing for a region no move targets', async () => {
      const mod = await loadWith(data);
      expect(mod.exercisesForSubRegions(['delt-rear'])).toEqual([]);
    });
  });
});
