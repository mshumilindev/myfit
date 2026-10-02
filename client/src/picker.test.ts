import { describe, expect, it } from 'vitest';
import {
  FAMILIES,
  applyFilter,
  buildPickItems,
  dayReference,
  familyFatigueLevel,
  familyReadiness,
  fatigueByGroup,
  fatigueColors,
  sortForBrowse,
  suggest,
} from './picker';
import { FATIGUE_COLOR, muscleFatigue } from './fatigue';
import { personalLandmarks } from './personalize';
import type { Exercise, SetEntry, Workout } from './types';

const DAY = 86400000;
const NOW = Date.UTC(2026, 8, 23, 12);
const set = (reps = 8, weight: number | null = 60): SetEntry => ({
  id: Math.random().toString(36).slice(2),
  reps,
  weight,
  isWarmup: false,
  position: 0,
  loggedAt: NOW,
});
const ex = (name: string, sets: SetEntry[], over: Partial<Exercise> = {}): Exercise => ({
  id: name,
  name,
  position: 0,
  sets,
  ...over,
});
const wk = (id: string, startedAt: number, exercises: Exercise[], done = true): Workout => ({
  id,
  startedAt,
  finishedAt: done ? startedAt + 3600000 : null,
  autoFinished: false,
  exercises,
});

describe('families', () => {
  it('reads readiness from direct work only — spill-over does not load a family', () => {
    const back = FAMILIES.find((f) => f.id === 'back')!;
    // Lats trained 8 days ago; yesterday a leg day with RDLs (lower back = secondary).
    const old = wk('a', NOW - 8 * DAY, [ex('Wide-Grip Lat Pulldown', [set(), set(), set()])]);
    const legs = wk('b', NOW - 1 * DAY, [ex('Romanian Deadlift', [set(), set(), set(), set()])]);
    const r = familyReadiness(back, [old, legs], NOW);
    expect(r.days).toBe(8);
    expect(r.state).not.toBe('recovering');
  });
  it('a family trained yesterday is recovering', () => {
    const back = FAMILIES.find((f) => f.id === 'back')!;
    const y = wk('y', NOW - 0.5 * DAY, [
      ex('Wide-Grip Lat Pulldown', [set(), set(), set(), set()]),
    ]);
    expect(familyReadiness(back, [y], NOW).state).toBe('recovering');
    expect(
      familyReadiness(
        FAMILIES.find((f) => f.id === 'core')!,
        [],
        NOW,
      ).days,
    ).toBeNull();
  });
});

describe('pick items', () => {
  const past = wk('p1', NOW - 5 * DAY, [ex('Wide-Grip Lat Pulldown', [set(10, 60)])]);
  const live = wk('live', NOW, [ex('Pullups', [set(6, null)])], false);
  const items = buildPickItems(live, [past, live], null);

  it('marks history, today and photos', () => {
    const lat = items.find((i) => i.name === 'Wide-Grip Lat Pulldown')!;
    expect(lat.timesDone).toBe(1);
    expect(lat.last).toEqual({ reps: 10, weight: 60 });
    expect(lat.image).toBeTruthy();
    const pull = items.find((i) => i.name === 'Pullups')!;
    expect(pull.doneToday?.sets).toBe(1);
  });

  it('browse order puts your lifts first within a family', () => {
    const lats = sortForBrowse(applyFilter(items, { family: 'back', sub: 'lats' }));
    expect(lats[0].timesDone).toBeGreaterThan(0);
  });

  it('filters by equipment and gym stock', () => {
    const gymItems = buildPickItems(live, [past, live], {
      id: 'g',
      name: 'Gym',
      inventory: ['dumbbell'],
    } as never);
    const onlyGym = applyFilter(gymItems, { onlyGym: true });
    expect(onlyGym.every((i) => i.equipment === null || i.equipment === 'dumbbell')).toBe(true);
    const cable = applyFilter(items, { equipment: ['cable'] });
    expect(cable.every((i) => i.equipment === 'cable')).toBe(true);
  });

  it('suggestions follow the day, never repeat what is done today', () => {
    const day = dayReference(live, [past]);
    expect(day.from).toBe('logged');
    const s = suggest(items, day, [past], new Map(), NOW, { count: 5 });
    expect(s.length).toBeGreaterThan(0);
    expect(s.some((x) => x.item.doneToday)).toBe(false);
    expect(s[0].reason).toBe('usual');
    expect(s[0].item.name).toBe('Wide-Grip Lat Pulldown');
  });
});

describe('picker fatigue colours (the Progress fatigue map scale)', () => {
  const bench = 'Barbell Bench Press - Medium Grip';
  const heavy = wk('h', NOW - DAY, [
    ex(
      bench,
      Array.from({ length: 30 }, () => set()),
    ),
  ]);
  const light = wk('l', NOW - 2 * DAY, [ex(bench, [set(), set()])]);
  const chest = FAMILIES.find((f) => f.id === 'chest')!;
  const legs = FAMILIES.find((f) => f.id === 'legs')!;

  it('fatigueByGroup is exactly muscleFatigue with the personal landmarks', () => {
    const fin = [heavy, light];
    const a = fatigueByGroup(fin, NOW);
    const b = muscleFatigue(fin, NOW, personalLandmarks(fin, NOW));
    for (const [m, f] of b) expect(a.get(m)).toEqual(f);
  });

  it('colours each muscle with FATIGUE_COLOR of its own level: fresh / fatigued / recovering', () => {
    const fresh = fatigueByGroup([], NOW);
    expect(fatigueColors(chest.groups, fresh).chest).toBe(FATIGUE_COLOR.fresh);
    expect(familyFatigueLevel(chest.groups, fresh)).toBe('fresh');

    const fat = fatigueByGroup([heavy], NOW);
    const lvl = fat.get('chest')!.level;
    expect(lvl).not.toBe('fresh');
    expect(fatigueColors(chest.groups, fat).chest).toBe(FATIGUE_COLOR[lvl]);
    expect(familyFatigueLevel(chest.groups, fat)).toBe(lvl);

    // a lightly worked (recovering) muscle reads from its own level, and an
    // untouched family stays fresh next to it
    const mild = fatigueByGroup([light], NOW);
    expect(fatigueColors(chest.groups, mild).chest).toBe(FATIGUE_COLOR[mild.get('chest')!.level]);
    const legsC = fatigueColors(legs.groups, fat);
    for (const g of legs.groups) if (g !== 'cardio') expect(legsC[g]).toBe(FATIGUE_COLOR.fresh);
  });

  it('a family headline is its most fatigued muscle', () => {
    const arms = FAMILIES.find((f) => f.id === 'arms')!;
    const fat = fatigueByGroup([heavy], NOW);
    const levels = arms.groups.map((g) => fat.get(g)?.level ?? 'fresh');
    const rank = ['fresh', 'moderate', 'high', 'fried'];
    const worst = levels.reduce((a, b) => (rank.indexOf(b) > rank.indexOf(a) ? b : a));
    expect(familyFatigueLevel(arms.groups, fat)).toBe(worst);
  });
});
