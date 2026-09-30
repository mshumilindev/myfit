import { describe, expect, it } from 'vitest';
import { dietSensitive, postWorkoutFuel } from './postWorkoutFuel';
import { sessionProfile } from './sessionProfile';
import type { ChronicCondition, Exercise, Gym, Workout } from './types';

const MIN = 60_000;
const T0 = Date.UTC(2026, 8, 28, 17, 0);

const strength = (muscle: string, sets: number, rpe?: number): Exercise => ({
  id: `e-${muscle}`,
  name: muscle,
  position: 0,
  kind: 'strength',
  primaryMuscle: muscle,
  sets: Array.from({ length: sets }, (_, i) => ({
    id: `s${i}`,
    reps: 8,
    weight: 80,
    isWarmup: false,
    rpe: rpe ?? null,
    position: i,
  })),
});
const cardio = (min: number): Exercise => ({
  id: 'c1',
  name: 'Run',
  position: 1,
  kind: 'cardio',
  sets: [{ id: 'cs', reps: 0, weight: null, isWarmup: false, durationMin: min, position: 0 }],
});
const wk = (exercises: Exercise[], minutes = 60): Workout => ({
  id: 'w',
  startedAt: T0,
  finishedAt: T0 + minutes * MIN,
  autoFinished: false,
  exercises,
});
const gym = (amenities: string[]): Gym => ({
  id: 'g',
  name: 'Club',
  lat: 0,
  lng: 0,
  radiusM: 50,
  amenities,
});
const cond = (key: string, extra: Partial<ChronicCondition> = {}): ChronicCondition => ({
  id: key,
  key,
  severity: 2,
  share: 'inherit',
  createdAt: 0,
  ...extra,
});
const fuel = (w: Workout, o: { gym?: Gym; conditions?: ChronicCondition[]; hour?: number } = {}) =>
  postWorkoutFuel({ workout: w, now: T0 + 2 * 60 * MIN, hour: 18, ...o });

describe('sessionProfile', () => {
  it('reads sets, rpe, cardio minutes, day type and level', () => {
    const p = sessionProfile(wk([strength('quads', 12, 8.5), cardio(10)], 75), { hour: 18 });
    expect(p).toMatchObject({
      strengthSets: 12,
      cardioMin: 10,
      avgRpe: 8.5,
      minutes: 75,
      hour: 18,
    });
    expect(p.level).toBe('hard');
  });
  it('a short easy session is light', () => {
    expect(sessionProfile(wk([strength('chest', 4)], 35)).level).toBe('light');
  });
});

describe('postWorkoutFuel', () => {
  it('nothing logged → null', () => {
    expect(fuel(wk([]))).toBeNull();
  });

  it('heavy legs day: protein shake with the facts, plus a meal when it was very hard', () => {
    const r = fuel(wk([strength('quads', 20, 8.5)], 80), { gym: gym(['juiceBar']) });
    expect(r?.mode).toBe('suggest');
    expect(r?.items.map((i) => i.kind)).toEqual(['carbMeal', 'proteinShake']);
    expect(r?.items[1].atGym).toBe(true); // juice bar sells the shake
    expect(r?.items[0].atGym).toBe(false); // no cafe for the meal
    expect(r?.facts).toMatchObject({ strengthSets: 20, avgRpe: 8.5, dayType: 'legs' });
  });

  it('moderate strength → a protein shake', () => {
    const r = fuel(wk([strength('chest', 12, 7)], 55));
    expect(r?.items.map((i) => i.kind)).toEqual(['proteinShake']);
  });

  it('cardio-led → hydration and a smoothie, cafe counts too', () => {
    const r = fuel(wk([cardio(45)], 50), { gym: gym(['cafe']) });
    expect(r?.items.map((i) => i.kind)).toEqual(['hydrate', 'smoothie']);
    expect(r?.items[0].atGym).toBe(false);
    expect(r?.items[1].atGym).toBe(true);
  });

  it('a very late finish swaps the big meal for a light snack', () => {
    const r = fuel(wk([strength('quads', 20, 9)], 95), { hour: 22, gym: gym(['cafe']) });
    const kinds = r?.items.map((i) => i.kind);
    expect(kinds).not.toContain('carbMeal');
    expect(kinds).toContain('snack');
  });

  it('a light session suggests a smoothie / snack, never more than two', () => {
    const r = fuel(wk([strength('chest', 4)], 35));
    expect(r?.items.length).toBeLessThanOrEqual(2);
    expect(r?.items.map((i) => i.kind)).toEqual(['smoothie', 'snack']);
  });

  it('is deterministic', () => {
    const w = wk([strength('quads', 14, 8)], 70);
    expect(fuel(w)).toEqual(fuel(w));
  });

  it('diet-relevant active condition → consult variant, no items', () => {
    const w = wk([strength('quads', 14, 8)], 70);
    for (const key of ['meta_diabetes2', 'other_kidney']) {
      const r = fuel(w, { conditions: [cond(key)] });
      expect(r).toMatchObject({ mode: 'consult', items: [] });
    }
  });

  it('an ended or unrelated condition does not switch it', () => {
    const w = wk([strength('quads', 14, 8)], 70);
    expect(fuel(w, { conditions: [cond('meta_diabetes2', { endsAt: 1 })] })?.mode).toBe('suggest');
    expect(dietSensitive([cond('meta_diabetes2', { endsAt: 1 })], T0)).toBe(false);
  });
});
