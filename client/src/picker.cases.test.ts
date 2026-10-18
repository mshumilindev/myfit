import { describe, expect, it } from 'vitest';
import { BUILT_IN_CATALOG, type MuscleGroup } from './data/exercises';
import type { Limits } from './conditions';
import type { FatigueLevel, MuscleFatigue } from './fatigue';
import { FATIGUE_COLOR } from './fatigue';
import {
  FAMILIES,
  applyFilter,
  buildPickItems,
  dayReference,
  daysAgo,
  directReadiness,
  equipmentCounts,
  familyFatigueLevel,
  familyMain,
  familyOf,
  fatigueColors,
  fitsDay,
  groupFatigueLevel,
  gymHas,
  isFocusSub,
  matchesSub,
  plannedGroups,
  readinessByGroup,
  sortForBrowse,
  subFatigueLevel,
  subReadiness,
  suggest,
  weekSets,
  type DayRef,
  type PickItem,
  type Readiness,
} from './picker';
import { describeDay } from './data/daySuggest';
import { LANDMARKS } from './volume';
import type { Exercise, Gym, SetEntry, Workout } from './types';

const DAY = 86_400_000;
// Local noon on a Wednesday: whole-day offsets stay on the same weekday/clock in any timezone.
const NOW = new Date(2026, 8, 23, 12).getTime();
const days = (n: number) => NOW - n * DAY;

const set = (reps = 8, weight: number | null = 60): SetEntry => ({
  id: `s${reps}${weight}`,
  reps,
  weight,
  isWarmup: false,
  position: 0,
  loggedAt: NOW,
});
const sets = (n: number) => Array.from({ length: n }, () => set());
const ex = (name: string, s: SetEntry[], over: Partial<Exercise> = {}): Exercise => ({
  id: `${name}-${over.position ?? 0}`,
  name,
  position: 0,
  sets: s,
  ...over,
});
const wk = (id: string, startedAt: number, exercises: Exercise[], done = true): Workout => ({
  id,
  startedAt,
  finishedAt: done ? startedAt + 3_600_000 : null,
  autoFinished: false,
  exercises,
});

const BENCH = 'Barbell Bench Press - Medium Grip';
const INCLINE = 'Barbell Incline Bench Press - Medium Grip';
const LATS = 'Wide-Grip Lat Pulldown';
const SQUAT = 'Barbell Full Squat';

describe('families and sub-chips', () => {
  it('familyOf maps a muscle to its family; unknown / empty -> null', () => {
    expect(familyOf('lats')).toBe('back');
    expect(familyOf('traps')).toBe('back');
    expect(familyOf('forearms')).toBe('arms');
    expect(familyOf('quads')).toBe('legs');
    expect(familyOf('core')).toBe('core');
    expect(familyOf('neck')).toBeNull();
    expect(familyOf('cardio')).toBeNull();
    expect(familyOf(null)).toBeNull();
    expect(familyOf(undefined)).toBeNull();
  });

  it('every family has a recovery-clock muscle that belongs to it', () => {
    for (const f of FAMILIES) expect(f.groups).toContain(familyMain(f.id));
    expect(familyMain('back')).toBe('lats');
    expect(familyMain('arms')).toBe('biceps');
    expect(familyMain('legs')).toBe('quads');
  });

  it('isFocusSub is true only for the five fine regions', () => {
    for (const s of ['delt-front', 'delt-side', 'delt-rear', 'chest-upper', 'chest-lower'] as const)
      expect(isFocusSub(s)).toBe(true);
    for (const s of ['chest', 'shoulders', 'lats', 'quads'] as const)
      expect(isFocusSub(s)).toBe(false);
  });

  it('subReadiness reads delts as shoulders, chest regions as chest, others as themselves', () => {
    const r = (days: number | null): Readiness => ({ state: 'ready', days });
    const map = new Map<MuscleGroup, Readiness>([
      ['shoulders', r(1)],
      ['chest', r(2)],
      ['lats', r(3)],
    ]);
    expect(subReadiness('delt-rear', map)).toBe(map.get('shoulders'));
    expect(subReadiness('chest-lower', map)).toBe(map.get('chest'));
    expect(subReadiness('lats', map)).toBe(map.get('lats'));
    expect(subReadiness('quads', map)).toBeNull();
    expect(subReadiness('delt-side', new Map())).toBeNull();
  });
});

describe('fatigue helpers', () => {
  const fat = (level: FatigueLevel): MuscleFatigue => ({
    muscle: 'chest',
    score: 0,
    level,
    sets: 0,
    mrv: 20,
    stalled: false,
  });
  const map = new Map<MuscleGroup, MuscleFatigue>([
    ['chest', fat('high')],
    ['shoulders', fat('moderate')],
    ['biceps', fat('fried')],
    ['cardio', fat('fried')],
  ]);

  it('muscles without volume read fresh', () => {
    expect(groupFatigueLevel('chest', map)).toBe('high');
    expect(groupFatigueLevel('quads', map)).toBe('fresh');
  });
  it('a family reads as its most fatigued muscle and ignores cardio', () => {
    expect(familyFatigueLevel(['biceps', 'triceps', 'forearms'], map)).toBe('fried');
    expect(familyFatigueLevel(['chest'], map)).toBe('high');
    expect(familyFatigueLevel(['quads', 'calves'], map)).toBe('fresh');
    expect(familyFatigueLevel(['cardio'], map)).toBe('fresh');
    expect(familyFatigueLevel([], map)).toBe('fresh');
    expect(familyFatigueLevel(['shoulders', 'chest'], map)).toBe('high');
  });
  it('fine regions read their coarse group', () => {
    expect(subFatigueLevel('chest-upper', map)).toBe('high');
    expect(subFatigueLevel('delt-front', map)).toBe('moderate');
    expect(subFatigueLevel('delt-rear', new Map())).toBe('fresh');
    expect(subFatigueLevel('biceps', map)).toBe('fried');
    expect(subFatigueLevel('calves', map)).toBe('fresh');
  });
  it('fatigueColors colours each muscle by its own level and skips cardio', () => {
    expect(fatigueColors(['chest', 'quads', 'cardio'], map)).toEqual({
      chest: FATIGUE_COLOR.high,
      quads: FATIGUE_COLOR.fresh,
    });
  });
});

describe('readiness', () => {
  it('readinessByGroup has an entry per trainable group; only the trained one has days', () => {
    const legs = wk('l', days(1), [ex(SQUAT, sets(4))]);
    const m = readinessByGroup([legs], NOW);
    const all = new Set(FAMILIES.flatMap((f) => f.groups));
    expect(new Set(m.keys())).toEqual(all);
    expect(m.size).toBe(16);
    expect(m.get('quads')!.days).toBe(1);
    expect(m.get('quads')!.state).toBe('recovering');
    expect(m.get('chest')!.days).toBeNull();
    expect(m.get('chest')!.state).not.toBe('recovering');
  });

  it('only sessions from the last 28 days and not in the future count', () => {
    const old = wk('o', days(29), [ex(BENCH, sets(4))]);
    const future = wk('f', NOW + DAY, [ex(BENCH, sets(4))]);
    expect(directReadiness(['chest'], 'chest', [old, future], NOW).days).toBeNull();
    const edge = wk('e', days(28), [ex(BENCH, sets(4))]);
    expect(directReadiness(['chest'], 'chest', [edge], NOW).days).toBe(28);
  });

  it('uses the most recent session that trained the muscle directly, skipping sets-less entries', () => {
    const newest = wk('n', days(2), [ex(BENCH, [])]); // planned but nothing logged
    const older = wk('o', days(6), [ex(BENCH, sets(3))]);
    expect(directReadiness(['chest'], 'chest', [older, newest], NOW).days).toBe(6);
  });

  it('floors the elapsed time to whole days', () => {
    const w = wk('x', NOW - 2.9 * DAY, [ex(BENCH, sets(3))]);
    expect(directReadiness(['chest'], 'chest', [w], NOW).days).toBe(2);
  });

  it('weekSets counts direct strength sets in the last 7 days against the muscle volume target', () => {
    const inWeek = wk('a', days(7), [ex(BENCH, sets(4)), ex(LATS, sets(5))]); // exactly 7 d: counts
    const tooOld = wk('b', days(7) - 1, [ex(BENCH, sets(9))]);
    const future = wk('c', NOW + 1, [ex(BENCH, sets(9))]);
    const r = weekSets('chest', [inWeek, tooOld, future], NOW);
    expect(r).toEqual({ done: 4, target: LANDMARKS.chest!.mav });
    expect(weekSets('lats', [inWeek], NOW).done).toBe(5);
    expect(weekSets('neck', [inWeek], NOW)).toEqual({ done: 0, target: 12 }); // no landmark -> 12
  });
});

describe('day reference', () => {
  it('program targets win (non-trainable ones dropped)', () => {
    const w = {
      ...wk('w', NOW, [ex(BENCH, sets(1))], false),
      targetMuscles: ['quads', 'neck', 'bogus'],
    };
    const d = dayReference(w, []);
    expect(d.from).toBe('program');
    expect(d.groups).toEqual(['quads']);
    expect(d.readout).toEqual({ kind: 'muscle', groups: ['quads'] });
  });

  it('otherwise what has been logged so far, in exercise order, ignoring empty exercises', () => {
    const w = wk(
      'w',
      NOW,
      [
        ex(LATS, sets(2), { position: 1 }),
        ex(BENCH, sets(3), { position: 0 }),
        ex(SQUAT, [], { position: 2 }),
      ],
      false,
    );
    const d = dayReference(w, []);
    expect(d.from).toBe('logged');
    expect(d.groups).toEqual(['chest', 'lats']);
  });

  it('with nothing logged: the same weekday last time, then the last session, else nothing', () => {
    const live = wk('live', NOW, [], false); // Wednesday
    const sameWd = wk('wd', days(7), [ex(SQUAT, sets(3))]); // Wednesday
    const other = wk('oth', days(1), [ex(BENCH, sets(3))]); // Tuesday, more recent
    const d1 = dayReference(live, [other, sameWd]);
    expect(d1.from).toBe('weekday');
    expect(d1.groups).toEqual(['quads']);
    const d2 = dayReference(live, [other]);
    expect(d2.from).toBe('overall');
    expect(d2.groups).toEqual(['chest']);
    expect(dayReference(live, [])).toEqual({ groups: [], readout: null, from: null });
  });

  it('a same-weekday session with no usable muscles falls through to the latest one', () => {
    const live = wk('live', NOW, [], false);
    const emptyWd = wk('wd', days(7), [ex('Mystery move', sets(2))]); // unknown, no primary
    const last = wk('last', days(2), [ex(BENCH, sets(3))]);
    const d = dayReference(live, [emptyWd, last]);
    expect(d.from).toBe('overall');
    expect(d.groups).toEqual(['chest']);
  });

  it('never uses the session itself as its own history', () => {
    const live = wk('live', NOW, [], false);
    expect(dayReference(live, [{ ...live, exercises: [ex(BENCH, sets(3))] }]).from).toBeNull();
  });

  it('plannedGroups lists primaries in order once each, incl. exercises without sets, skipping untrainable', () => {
    const w = wk('w', NOW, [
      ex(LATS, [], { position: 1 }),
      ex(BENCH, sets(2), { position: 0 }),
      ex('Barbell Bench Press - Medium Grip', sets(1), { position: 2 }),
      ex('Mystery move', sets(1), { position: 3 }),
      ex('Isometric Neck Exercise - Sides', sets(1), { position: 4 }),
    ]);
    expect(plannedGroups(w)).toEqual(['chest', 'lats']);
  });

  it('fitsDay: nothing without a primary or a readout; full fits all; split by training day; else listed groups', () => {
    const mk = (groups: MuscleGroup[]): DayRef => ({
      groups,
      readout: describeDay(groups.map((g) => [g, 3])),
      from: 'logged',
    });
    expect(fitsDay(mk(['chest']), null)).toBe(false);
    expect(fitsDay({ groups: [], readout: null, from: null }, 'chest')).toBe(false);
    expect(fitsDay(mk(['chest', 'lats', 'quads']), 'biceps')).toBe(true); // full body
    expect(fitsDay(mk(['chest', 'shoulders']), 'triceps')).toBe(true); // push split
    expect(fitsDay(mk(['chest', 'shoulders']), 'lats')).toBe(false);
    expect(fitsDay(mk(['chest']), 'chest')).toBe(true);
    expect(fitsDay(mk(['chest']), 'shoulders')).toBe(false);
    expect(fitsDay(mk(['chest', 'quads']), 'quads')).toBe(true); // mixed: only the listed ones
    expect(fitsDay(mk(['chest', 'quads']), 'lats')).toBe(false);
    expect(fitsDay(mk(['chest', 'shoulders']), 'neck')).toBe(false); // neck belongs to no split
  });
});

describe('buildPickItems', () => {
  const live = wk('live', NOW, [], false);

  it('adds history-only (custom) lifts, with their latest top set, count and date', () => {
    const a = wk('a', days(10), [ex('My Cable Thing', [set(10, 20), set(8, 30)])]);
    const b = wk('b', days(3), [ex('  my cable thing ', [set(6, 40)])]);
    const older = wk('c', days(20), [ex('My Cable Thing', [set(12, 5)])]); // older than 'a', seen last
    const it = buildPickItems(live, [a, b, older], null).find((i) => i.name === 'My Cable Thing')!;
    expect(it).toMatchObject({
      key: 'my cable thing',
      catalogId: null,
      timesDone: 3,
      lastAt: days(3),
      last: { reps: 6, weight: 40 },
      doneToday: null,
      quality: 10,
      compound: false,
      available: true,
      image: null,
    });
  });

  it('a custom lift done only in this session shows as done today with no history', () => {
    const w = wk('w', NOW, [ex('Home Rig Row', [set(8, 30), set(10, 25)])], false);
    const it = buildPickItems(w, [w], null).find((i) => i.name === 'Home Rig Row')!;
    expect(it.timesDone).toBe(0);
    expect(it.lastAt).toBeNull();
    expect(it.last).toBeNull();
    expect(it.doneToday).toEqual({ sets: 2, reps: 8, weight: 30 });
  });

  it('ignores sets-less, non-strength and current-session history entries', () => {
    const cardio = { ...ex('Odd Timed Thing', [set(1, null)]), kind: 'cardio' as const };
    const w = wk('w', days(4), [ex('Empty Custom', []), cardio]);
    const items = buildPickItems(
      live,
      [w, { ...live, exercises: [ex('Live Only Past', [set()])] }],
      null,
    );
    expect(items.some((i) => i.name === 'Empty Custom')).toBe(false);
    expect(items.some((i) => i.name === 'Odd Timed Thing')).toBe(false);
    expect(items.some((i) => i.name === 'Live Only Past')).toBe(false);
  });

  it('cardio logged as a lift in the past stays out, and the catalog never lists cardio', () => {
    const cardioName = 'Jogging, Treadmill';
    const past = wk('p', days(3), [ex(cardioName, [set(10, null)])]);
    const items = buildPickItems(live, [past], null);
    expect(items.some((i) => i.name.toLowerCase() === cardioName.toLowerCase())).toBe(false);
    // the catalog's own cardio machines never show up as lifts either
    expect(items.some((i) => /treadmill|elliptical/i.test(i.name))).toBe(false);
    expect(BUILT_IN_CATALOG.some((c) => c.names[0] === cardioName)).toBe(true);
  });

  it('stretching moves are pickable only for a warm-up block', () => {
    const plain = buildPickItems(live, [], null);
    const warm = buildPickItems(live, [], null, { stretching: true });
    expect(warm.length).toBeGreaterThan(plain.length);
    expect(new Set(plain.map((i) => i.key)).size).toBe(plain.length);
  });

  it('catalog items carry photos, muscles and annotate gym availability', () => {
    const gym = { id: 'g', name: 'Gym', inventory: ['dumbbell'] } as unknown as Gym;
    const items = buildPickItems(live, [], gym);
    const bench = items.find((i) => i.name === BENCH)!;
    expect(bench).toMatchObject({ primary: 'chest', equipment: 'barbell', available: false });
    expect(bench.images.length).toBeGreaterThan(0);
    expect(bench.image).toBe(bench.images[0]);
    expect(bench.secondary.length).toBeGreaterThan(0);
    expect(items.find((i) => i.name === 'Alternate Hammer Curl')!.available).toBe(true);
  });

  it('the top set of a done-today exercise drives the summary (heaviest, not last)', () => {
    const w = wk('w', NOW, [ex(BENCH, [set(5, 100), set(8, 60)])], false);
    expect(buildPickItems(w, [], null).find((i) => i.name === BENCH)!.doneToday).toEqual({
      sets: 2,
      reps: 5,
      weight: 100,
    });
  });

  it('gymHas: no gym, no inventory or unknown equipment never blocks', () => {
    expect(gymHas(null, 'barbell')).toBe(true);
    expect(gymHas(undefined, 'barbell')).toBe(true);
    expect(gymHas({ inventory: [] } as unknown as Gym, 'barbell')).toBe(true);
    expect(gymHas({ inventory: ['cable'] } as unknown as Gym, null)).toBe(true);
    expect(gymHas({ inventory: ['cable'] } as unknown as Gym, 'barbell')).toBe(false);
    expect(gymHas({ inventory: ['cable'] } as unknown as Gym, 'cable')).toBe(true);
  });
});

describe('filtering and ordering', () => {
  const live = wk('live', NOW, [], false);
  const items = buildPickItems(live, [], null);
  const mk = (name: string, over: Partial<PickItem> = {}): PickItem => ({
    key: name.toLowerCase(),
    name,
    catalogId: null,
    primary: 'chest',
    secondary: [],
    equipment: null,
    image: null,
    images: [],
    compound: false,
    timesDone: 0,
    lastAt: null,
    last: null,
    doneToday: null,
    available: true,
    quality: 0,
    ...over,
  });

  it('matchesSub: coarse groups compare the primary; fine regions use the catalog sub-regions', () => {
    const incline = items.find((i) => i.name === INCLINE)!;
    expect(matchesSub(incline, 'chest-upper')).toBe(true);
    expect(matchesSub(incline, 'chest-lower')).toBe(false);
    expect(matchesSub(mk('Custom press'), 'chest-upper')).toBe(false); // no catalog id
    expect(matchesSub(mk('x', { primary: 'lats' }), 'lats')).toBe(true);
    expect(matchesSub(mk('x', { primary: 'lats' }), 'traps')).toBe(false);
  });

  it('applyFilter combines family, sub, equipment and gym with AND', () => {
    expect(applyFilter(items, {})).toHaveLength(items.length);
    const chest = applyFilter(items, { family: 'chest' });
    expect(chest.length).toBeGreaterThan(0);
    expect(chest.every((i) => i.primary === 'chest')).toBe(true);
    const upper = applyFilter(items, { family: 'chest', sub: 'chest-upper' });
    expect(upper.length).toBeGreaterThan(0);
    expect(upper.length).toBeLessThan(chest.length);
    expect(upper.some((i) => i.name === INCLINE)).toBe(true);
    const bb = applyFilter(items, { family: 'chest', equipment: ['barbell', 'cable'] });
    expect(bb.every((i) => i.equipment === 'barbell' || i.equipment === 'cable')).toBe(true);
    const synthetic = [
      mk('a', { primary: null }),
      mk('b', { equipment: null }),
      mk('c', { available: false }),
    ];
    expect(applyFilter(synthetic, { family: 'chest' }).map((i) => i.name)).toEqual(['b', 'c']);
    expect(applyFilter(synthetic, { equipment: ['cable'] })).toEqual([]);
    expect(applyFilter(synthetic, { onlyGym: true }).map((i) => i.name)).toEqual(['a', 'b']);
  });

  it('sortForBrowse: available, then yours (most done), then photo, then quality, then name', () => {
    const list = [
      mk('Zeta', { quality: 5 }),
      mk('Alpha', { quality: 5 }),
      mk('Beta', { quality: 9 }),
      mk('Photo', { image: 'p.jpg', quality: 1 }),
      mk('Twice', { timesDone: 2 }),
      mk('Once', { timesDone: 1 }),
      mk('Gone', { timesDone: 9, available: false }),
    ];
    const names = sortForBrowse(list).map((i) => i.name);
    expect(names).toEqual(['Twice', 'Once', 'Photo', 'Beta', 'Alpha', 'Zeta', 'Gone']);
    expect(list[0].name).toBe('Zeta'); // input untouched
  });

  it('equipmentCounts tallies by equipment, most common first, ignoring unknown', () => {
    const list = [
      mk('a', { equipment: 'cable' }),
      mk('b', { equipment: 'barbell' }),
      mk('c', { equipment: 'cable' }),
      mk('d', { equipment: null }),
      mk('e', { equipment: 'cable' }),
      mk('f', { equipment: 'barbell' }),
    ];
    expect(equipmentCounts(list)).toEqual([
      { id: 'cable', n: 3 },
      { id: 'barbell', n: 2 },
    ]);
    expect(equipmentCounts([])).toEqual([]);
  });

  it('daysAgo floors, clamps future to 0 and passes null through', () => {
    expect(daysAgo(null, NOW)).toBeNull();
    expect(daysAgo(NOW - 2.9 * DAY, NOW)).toBe(2);
    expect(daysAgo(NOW - DAY + 1, NOW)).toBe(0);
    expect(daysAgo(NOW - DAY, NOW)).toBe(1);
    expect(daysAgo(NOW + 5 * DAY, NOW)).toBe(0);
  });
});

describe('suggest', () => {
  const mk = (name: string, over: Partial<PickItem> = {}): PickItem => ({
    key: name.toLowerCase(),
    name,
    catalogId: null,
    primary: 'chest',
    secondary: [],
    equipment: null,
    image: 'x.jpg',
    images: ['x.jpg'],
    compound: false,
    timesDone: 0,
    lastAt: null,
    last: null,
    doneToday: null,
    available: true,
    quality: 0,
    ...over,
  });
  const noDay: DayRef = { groups: [], readout: null, from: null };
  const dayOf = (groups: MuscleGroup[]): DayRef => ({
    groups,
    readout: describeDay(groups.map((g) => [g, 3])),
    from: 'logged',
  });
  const ready = (state: Readiness['state'] = 'ready'): Readiness => ({ state, days: 3 });
  const names = (s: ReturnType<typeof suggest>) => s.map((x) => `${x.item.name}:${x.reason}`);

  it('without a day, targets are the muscles that are ready or stale; recovering ones are left out', () => {
    const items = [
      mk('ChestUsual', { timesDone: 3 }),
      mk('LatsUsual', { primary: 'lats', timesDone: 3 }),
      mk('Quads20', { primary: 'quads', quality: 20 }),
      mk('Quads10', { primary: 'quads', quality: 10 }),
      mk('Chest5', { quality: 5 }),
      mk('BicepsNotTarget', { primary: 'biceps', quality: 99 }),
      mk('NoPhotoQuads', { primary: 'quads', quality: 50, image: null }),
    ];
    const readiness = new Map<MuscleGroup, Readiness>([
      ['chest', ready()],
      ['lats', ready('recovering')],
      ['quads', ready('stale')],
      ['biceps', ready('nearly')],
    ]);
    const s = suggest(items, noDay, [], readiness, NOW);
    expect(names(s)).toEqual(['ChestUsual:usual', 'Chest5:fit', 'Quads20:fit', 'Quads10:fit']);
    expect(s[0].muscle).toBe('chest');
  });

  it('never suggests what is done today, what the gym lacks, or lifts without a muscle', () => {
    const items = [
      mk('Done', { timesDone: 4, doneToday: { sets: 1, reps: 5, weight: 50 } }),
      mk('NoGym', { timesDone: 4, available: false }),
      mk('NoMuscle', { primary: null, timesDone: 4 }),
      mk('Ok', { timesDone: 1 }),
    ];
    const s = suggest(items, dayOf(['chest']), [], new Map(), NOW);
    expect(names(s)).toEqual(['Ok:usual']);
  });

  it('usual picks fill at most half of the list (rounded up) and sort by frequency then recency', () => {
    const items = [
      mk('A', { timesDone: 2, lastAt: days(1) }),
      mk('B', { timesDone: 5, lastAt: days(9) }),
      mk('C', { timesDone: 5, lastAt: days(2) }),
      mk('D', { timesDone: 1, image: null }),
    ];
    const s = suggest(items, dayOf(['chest']), [], new Map(), NOW, { count: 4 });
    // two "usual" first (C then B); a lift with a photo then fills as a good fit, the photo-less rest as usual
    expect(names(s)).toEqual(['C:usual', 'B:usual', 'A:fit', 'D:usual']);
    const two = suggest(items, dayOf(['chest']), [], new Map(), NOW, { count: 2 });
    // count 2 -> only one usual slot (ceil(2/2)); the other is a good fit
    expect(names(two)).toEqual(['C:usual', 'A:fit']);
    expect(suggest(items, dayOf(['chest']), [], new Map(), NOW, { count: 0 })).toEqual([]);
  });

  it('a lift that does not fit today (split) or whose muscle is recovering is skipped', () => {
    const items = [
      mk('Squat', { primary: 'quads', timesDone: 9 }),
      mk('Bench', { primary: 'chest', timesDone: 1 }),
      mk('Press', { primary: 'shoulders', timesDone: 1 }),
    ];
    const readiness = new Map<MuscleGroup, Readiness>([['shoulders', ready('recovering')]]);
    const s = suggest(items, dayOf(['chest', 'triceps']), [], readiness, NOW);
    expect(names(s)).toEqual(['Bench:usual']);
  });

  it('scope narrows to a family or a sub-muscle regardless of the day', () => {
    const items = [
      mk('Squat', { primary: 'quads', timesDone: 9 }),
      mk('Row', { primary: 'lats', timesDone: 3 }),
      mk('Curl', { primary: 'biceps', quality: 30 }),
      mk('TricepsPush', { primary: 'triceps', quality: 10 }),
    ];
    const arms = suggest(items, dayOf(['quads']), [], new Map(), NOW, { family: 'arms' });
    expect(arms.map((x) => x.item.name)).toEqual(['Curl', 'TricepsPush']);
    expect(arms.every((x) => x.reason === 'fit')).toBe(true);
    const sub = suggest(items, dayOf(['quads']), [], new Map(), NOW, {
      family: 'arms',
      sub: 'triceps',
    });
    expect(sub.map((x) => x.item.name)).toEqual(['TricepsPush']);
  });

  it('long-term condition limits remove the lifts they rule out', () => {
    const limits: Limits = {
      effects: { avoid: ['axial'] },
      avoidBy: {},
      cautionBy: {},
      capBy: {},
      keys: ['x'],
    };
    const items = [
      mk('Barbell Squat', { primary: 'quads', timesDone: 4 }),
      mk('Leg Extensions', { primary: 'quads', timesDone: 2 }),
    ];
    const without = suggest(items, dayOf(['quads']), [], new Map(), NOW);
    const withLimits = suggest(items, dayOf(['quads']), [], new Map(), NOW, { limits });
    expect(without.map((x) => x.item.name)).toContain('Barbell Squat');
    expect(withLimits.map((x) => x.item.name)).toEqual(['Leg Extensions']);
  });

  it('weak points: a chronically under-trained muscle of the day gets your best move for it', () => {
    // Six weeks of chest-only training -> lats are a chronic gap.
    const history = Array.from({ length: 6 }, (_, k) =>
      wk(`h${k}`, days(k * 7 + 1), [ex(BENCH, sets(12))]),
    );
    const items = [
      mk('Chest Usual', { primary: 'chest', timesDone: 6 }),
      mk('Chest Usual 2', { primary: 'chest', timesDone: 5 }),
      mk('Lat Rare', { primary: 'lats', timesDone: 1, quality: 5 }),
      mk('Lat Favourite', { primary: 'lats', timesDone: 4, quality: 1 }),
      mk('Lat Never', { primary: 'lats', timesDone: 0, quality: 50 }),
    ];
    const readiness = new Map<MuscleGroup, Readiness>([
      ['chest', ready()],
      ['lats', ready()],
    ]);
    const s = suggest(items, noDay, history, readiness, NOW, { count: 3 });
    const weak = s.find((x) => x.reason === 'weak')!;
    expect(weak.item.name).toBe('Lat Favourite'); // most done wins over raw quality
    expect(weak.muscle).toBe('lats');
    expect(s.map((x) => x.reason)).toEqual(['usual', 'usual', 'weak']);
    // weak point on a day that is about a different split: not suggested
    const legDay = suggest(items, dayOf(['quads']), history, readiness, NOW, { count: 3 });
    expect(legDay.some((x) => x.reason === 'weak')).toBe(false);
  });

  it('weak points inside a scoped family only consider that family', () => {
    const history = Array.from({ length: 6 }, (_, k) =>
      wk(`h${k}`, days(k * 7 + 1), [ex(BENCH, sets(12))]),
    );
    const items = [
      mk('Lat Move', { primary: 'lats', timesDone: 2 }),
      mk('Quad Move', { primary: 'quads', timesDone: 2 }),
    ];
    const s = suggest(items, noDay, history, new Map(), NOW, { family: 'back', count: 5 });
    expect(s.map((x) => x.item.name)).toEqual(['Lat Move']);
  });

  it('attaches a progression target for lifts with history, none for new ones', () => {
    const past = wk('p', days(4), [ex(BENCH, [set(8, 60), set(8, 60)])]);
    const items = [
      mk(BENCH, {
        primary: 'chest',
        timesDone: 1,
        equipment: 'barbell',
        last: { reps: 8, weight: 60 },
      }),
      mk('Brand New', { primary: 'chest', timesDone: 0 }),
    ];
    const s = suggest(items, dayOf(['chest']), [past], new Map(), NOW);
    expect(s.find((x) => x.item.name === 'Brand New')!.target).toBeNull();
    expect(s.find((x) => x.item.name === BENCH)!.target).not.toBeNull();
  });
});
