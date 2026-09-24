import { describe, expect, it } from 'vitest';
import { kitEvidence, gymCovers, type EvidenceDeps } from './gymEvidence';
import type { Exercise, Gym, Workout } from './types';

const ex = (name: string, equipment: string[], items?: string[]): Exercise =>
  ({
    id: name,
    name,
    kind: 'strength',
    position: 0,
    equipment,
    equipmentItems: items,
    sets: [{ id: 's', reps: 8, weight: 60, isWarmup: false, position: 0 }],
  }) as unknown as Exercise;
const wk = (id: string, day: number, exs: Exercise[], gymId = 'g'): Workout =>
  ({
    id,
    gymId,
    startedAt: day * 86400000,
    finishedAt: day * 86400000 + 1,
    exercises: exs,
  }) as unknown as Workout;
const deps: EvidenceDeps = {
  classesOf: (e) => e.equipment ?? [],
  clsOfItem: (id) =>
    id.startsWith('barbell-ez')
      ? 'ezBar'
      : id.startsWith('barbell')
        ? 'barbell'
        : id.startsWith('cable')
          ? 'cable'
          : 'machine',
  isLift: () => true,
};
const gym = (over: Partial<Gym> = {}): Gym =>
  ({
    id: 'g',
    name: 'G',
    lat: 0,
    lng: 0,
    radiusM: 50,
    inventory: ['dumbbell'],
    equipmentItems: ['dumbbell-fixed'],
    ...over,
  }) as Gym;

describe('kitEvidence', () => {
  const ws = [
    wk('a', 1, [ex('Bench', ['barbell']), ex('Curl', ['dumbbell'])]),
    wk('b', 3, [ex('Bench', ['barbell']), ex('Skull', ['ezBar'])]),
    wk('c', 5, [ex('Leg press', ['machine'], ['leg-press'])]),
    wk('x', 4, [ex('Bench', ['barbell'])], 'other'),
  ];
  it('finds kit used here but not listed, with medium evidence at 2 sessions', () => {
    const ev = kitEvidence(gym(), ws, 10 * 86400000, deps);
    const bar = ev.find((e) => e.itemId === 'barbell-olympic')!;
    expect(bar.sessions).toBe(2);
    expect(bar.medium).toBe(true);
    expect(bar.used).toEqual([true, true, false]);
    expect(ev.find((e) => e.itemId === 'barbell-ez')!.medium).toBe(false);
    expect(ev.find((e) => e.itemId === 'leg-press')).toBeDefined(); // exact item
    expect(ev.find((e) => e.cls === 'dumbbell')).toBeUndefined(); // already listed
  });
  it('respects "not at this gym" and a gym with no list gets everything', () => {
    const ev = kitEvidence(gym({ equipmentNotHere: ['barbell-olympic'] }), ws, 10 * 86400000, deps);
    expect(ev.find((e) => e.itemId === 'barbell-olympic')).toBeUndefined();
    const all = kitEvidence(gym({ inventory: [], equipmentItems: [] }), ws, 10 * 86400000, deps);
    expect(all.some((e) => e.cls === 'dumbbell')).toBe(true);
  });
  it('a class is covered by any listed item of it', () => {
    expect(
      gymCovers(
        { inventory: ['barbell'], equipmentItems: ['barbell-power'] },
        'barbell-olympic',
        'barbell',
      ),
    ).toBe(true);
    expect(gymCovers({ inventory: ['machine'], equipmentItems: [] }, 'leg-press', 'machine')).toBe(
      false,
    );
  });
});
