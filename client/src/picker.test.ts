import { describe, expect, it } from 'vitest';
import {
  FAMILIES,
  applyFilter,
  buildPickItems,
  dayReference,
  familyReadiness,
  sortForBrowse,
  suggest,
} from './picker';
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
