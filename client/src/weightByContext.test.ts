import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addExercise,
  crossGymHint,
  finishWorkout,
  gymTransferRatio,
  historicalWorkingKg,
  liftVariant,
  normalizedProgress,
  prevLift,
  recordWeight,
  recordsByVariant,
  resetLocalData,
  startWorkout,
  upsertGym,
  upsertSet,
  toggleFavorite,
  getStoreState,
} from './store';

const DAY = 86400000;
let clock = Date.now();
function session(gymId: string, name: string, kg: number, daysAgo: number, live = false) {
  clock += 60000;
  vi.setSystemTime(clock);
  const w = startWorkout(gymId)!;
  const ex = addExercise(w.id, name, 'strength', {} as never);
  for (let i = 0; i < 3; i++)
    upsertSet(w.id, ex.id, { reps: 8, weight: kg, type: 'working', isWarmup: false } as never);
  if (!live) finishWorkout(w.id, Date.now() - daysAgo * DAY + 3600000);
  return { w, ex };
}

describe('weight by machine / gym', () => {
  let A: string;
  let B: string;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    clock = Date.now();
    resetLocalData();
    A = upsertGym({ name: 'A', lat: 1, lng: 1, radiusM: 100 }).id;
    B = upsertGym({ name: 'B', lat: 2, lng: 2, radiusM: 100, favorite: false }).id;
  });

  it('keeps machine lifts apart per gym, free weights absolute', () => {
    const a = session(A, 'Leg Press', 140, 5);
    session(B, 'Leg Press', 120, 3);
    const st = getStoreState();
    const wa = st.workouts.find((w) => w.id === a.w.id)!;
    expect(liftVariant(wa, wa.exercises[0])).toBe(`gym:${A}`);
    expect(prevLift('Leg Press', undefined, `gym:${A}`)?.weight).toBe(140);
    expect(prevLift('Leg Press', undefined, `gym:${B}`)?.weight).toBe(120);
    expect(recordWeight('Leg Press', undefined, `gym:${B}`)).toBe(120);
    expect(historicalWorkingKg('Leg Press', undefined, `gym:${A}`)).toBe(140);
    session(A, 'Barbell Squat', 100, 2);
    session(B, 'Barbell Squat', 100, 1);
    const sq = getStoreState().workouts.find((w) => w.exercises[0].name === 'Barbell Squat')!;
    expect(liftVariant(sq, sq.exercises[0])).toBe('');
  });

  it('records by variant and a curve that never reads a switch as a drop', () => {
    session(A, 'Leg Press', 130, 10);
    session(A, 'Leg Press', 140, 7);
    session(B, 'Leg Press', 100, 3);
    expect(
      recordsByVariant('Leg Press')
        .map((r) => r.weight)
        .sort(),
    ).toEqual([100, 140]);
    const pts = normalizedProgress('Leg Press');
    expect(pts).toHaveLength(3);
    expect(pts[2].switched).toBe(true);
    expect(pts[2].value).toBe(pts[1].value);
  });

  it('main gym hint: estimate only with 3+ shared lifts, never otherwise', () => {
    toggleFavorite(A);
    session(A, 'Leg Press', 140, 9);
    const cur = session(B, 'Leg Press', 0, 0, true);
    let h = crossGymHint(cur.w.id, cur.ex);
    expect(h?.weight).toBe(140);
    expect(h?.estimate).toBeNull();
    for (const [n, a, b] of [
      ['Leg Extensions', 60, 50],
      ['Lying Leg Curls', 50, 40],
      ['Wide-Grip Lat Pulldown', 80, 64],
    ] as const) {
      session(A, n, a, 8);
      session(B, n, b, 4);
    }
    expect(gymTransferRatio(A, B)).toBeCloseTo(0.8, 1);
    const fresh = getStoreState().workouts.find((w) => w.id === cur.w.id)!.exercises[0];
    h = crossGymHint(cur.w.id, fresh);
    expect(h?.estimate).toBe(112.5);
  });
});
