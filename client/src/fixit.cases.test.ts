import { describe, expect, it } from 'vitest';
import { activeGym, fixCandidates, fixScheme } from './fixit';
import { richExerciseByName } from './data/exercises';
import type { MuscleGroup } from './data/exercises';
import type { Gym, Workout } from './types';

const gym = (id: string, inventory?: string[]): Gym => ({
  id,
  name: `Gym ${id}`,
  lat: 0,
  lng: 0,
  radiusM: 100,
  inventory,
});
const wk = (id: string, startedAt: number, gymId?: string | null): Workout =>
  ({
    id,
    startedAt,
    finishedAt: startedAt + 1,
    autoFinished: false,
    gymId,
    exercises: [],
  }) as Workout;

describe('fixScheme', () => {
  it.each(['calves', 'core', 'forearms', 'abductors', 'adductors', 'traps'] as MuscleGroup[])(
    '%s gets the lighter higher-rep prescription',
    (m) => {
      expect(fixScheme(m)).toEqual({ sets: 3, reps: 13, label: '3 × 12–15' });
    },
  );

  it.each(['chest', 'quads', 'lats', 'biceps'] as MuscleGroup[])(
    '%s gets the standard 3 x 8-12',
    (m) => {
      expect(fixScheme(m)).toEqual({ sets: 3, reps: 10, label: '3 × 8–12' });
    },
  );
});

describe('activeGym', () => {
  const a = gym('a');
  const b = gym('b');

  it('is the gym of the most recently started session, regardless of input order', () => {
    const fin = [wk('1', 1000, 'a'), wk('3', 3000, 'b'), wk('2', 2000, 'a')];
    expect(activeGym([a, b], fin)?.id).toBe('b');
  });

  it('skips sessions without a gym and sessions whose gym no longer exists', () => {
    const fin = [
      wk('4', 4000, null),
      wk('3', 3000, 'deleted'),
      wk('2', 2000, undefined),
      wk('1', 1000, 'b'),
    ];
    expect(activeGym([a, b], fin)?.id).toBe('b');
  });

  it('falls back to the first gym when no session names a known gym', () => {
    expect(activeGym([a, b], [wk('1', 1000, null)])?.id).toBe('a');
    expect(activeGym([a, b], [])?.id).toBe('a');
  });

  it('is null with no gyms at all', () => {
    expect(activeGym([], [wk('1', 1000, 'a')])).toBeNull();
  });

  it('does not mutate the caller array order', () => {
    const fin = [wk('1', 1000, 'a'), wk('2', 2000, 'b')];
    activeGym([a, b], fin);
    expect(fin.map((w) => w.id)).toEqual(['1', '2']);
  });
});

describe('fixCandidates', () => {
  it('returns at most `count` (default 3) uniquely-named exercises', () => {
    expect(fixCandidates('quads', null)).toHaveLength(3);
    const five = fixCandidates('quads', null, 5);
    expect(five).toHaveLength(5);
    expect(new Set(five.map((c) => c.name.toLowerCase())).size).toBe(5);
    expect(fixCandidates('quads', null, 0)).toEqual([]);
  });

  it('every candidate targets the requested muscle directly and carries its scheme', () => {
    for (const m of ['quads', 'calves', 'chest'] as MuscleGroup[]) {
      for (const c of fixCandidates(m, null, 5)) {
        expect(c.primary).toBe(m);
        expect(c.isPrimaryHit).toBe(true);
        expect(c.scheme).toEqual(fixScheme(m));
      }
    }
  });

  it('never proposes stretching / mobility drills', () => {
    for (const m of ['quads', 'hamstrings', 'lower_back', 'chest', 'calves'] as MuscleGroup[]) {
      for (const c of fixCandidates(m, null, 40)) {
        expect(richExerciseByName(c.name)?.category).not.toBe('stretching');
      }
    }
  });

  it('with no gym nothing is missing and everything is available; simplest kit ranks first', () => {
    const c = fixCandidates('quads', null, 5);
    expect(c.every((x) => x.available && x.missing.length === 0)).toBe(true);
    // equipment-count ordering within the same rank: bodyweight lunge leads barbell moves
    expect(c[0].name).toBe('Bodyweight Walking Lunge');
    expect(c[0].equipment).toEqual([]);
    expect(c[0].bodyweight).toBe(true);
    expect(c[1].equipment).toEqual(['barbell']);
    expect(c[1].bodyweight).toBe(false);
  });

  it('flags a body-only exercise as bodyweight', () => {
    const neck = fixCandidates('neck', null, 5);
    const iso = neck.find((c) => c.name === 'Isometric Neck Exercise - Sides')!;
    expect(iso.equipment).toEqual(['body']);
    expect(iso.bodyweight).toBe(true);
    const plate = neck.find((c) => c.name === 'Lying Face Down Plate Neck Resistance')!;
    expect(plate.bodyweight).toBe(false);
  });

  it('ranks what the gym can equip ahead of what it cannot', () => {
    const g = gym('x', ['body']);
    const c = fixCandidates('quads', g, 10);
    const flags = c.map((x) => x.available);
    const firstMissing = flags.indexOf(false);
    expect(firstMissing).toBeGreaterThan(0);
    expect(flags.slice(firstMissing).every((f) => !f)).toBe(true);
    expect(c[0].available).toBe(true);
    const barbell = c.find((x) => x.name === 'Barbell Full Squat')!;
    expect(barbell.missing).toEqual(['barbell']);
    expect(barbell.available).toBe(false);
  });

  it('a gym that equips the barbell makes barbell moves available', () => {
    const g = gym('x', ['barbell', 'body']);
    const squat = fixCandidates('quads', g, 10).find((x) => x.name === 'Barbell Full Squat')!;
    expect(squat.missing).toEqual([]);
    expect(squat.available).toBe(true);
  });

  it('a gym with an unaudited (empty / absent) inventory never reports anything missing', () => {
    for (const g of [gym('e', []), gym('n', undefined)]) {
      expect(fixCandidates('quads', g, 5).every((x) => x.available)).toBe(true);
    }
  });
});
