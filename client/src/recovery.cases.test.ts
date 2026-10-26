import { describe, expect, it } from 'vitest';
import {
  carryOverSets,
  muscleGapDays,
  muscleReadiness,
  readinessColors,
  readinessMood,
  readyMuscles,
  recoveringMuscles,
  staleMuscles,
  READINESS_COLOR,
  RECOVERY_DAYS,
} from './recovery';
import type { Exercise, SetEntry, Workout } from './types';

const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 26, 12);
const set = (): SetEntry => ({
  id: Math.random().toString(36).slice(2),
  reps: 8,
  weight: 60,
  isWarmup: false,
  position: 0,
  loggedAt: NOW,
});
const ex = (name: string, n: number): Exercise => ({
  id: name,
  name,
  position: 0,
  sets: Array.from({ length: n }, set),
});
const wk = (startedAt: number, exercises: Exercise[]): Workout => ({
  id: `w${startedAt}`,
  startedAt,
  finishedAt: startedAt + 3600000,
  autoFinished: false,
  exercises,
});
const PRESS = 'Barbell Bench Press - Medium Grip';

describe('muscleReadiness (the time axis)', () => {
  it('right after a session the muscle is recovering; after its window it is ready', () => {
    const h = [wk(NOW - 1 * 3600000, [ex(PRESS, 8)])];
    const now = muscleReadiness(h, NOW).get('chest')!;
    expect(now.state).toBe('recovering');
    expect(now.readiness).toBeLessThan(0.5);
    const later = muscleReadiness(h, NOW + 5 * DAY).get('chest')!;
    expect(later.readiness).toBe(1);
    expect(['ready', 'stale']).toContain(later.state);
  });

  it('SPO-352 scenario: last session 9 days ago -> chest fully ready, not recovering', () => {
    const h = [wk(NOW - 9 * DAY, [ex(PRESS, 6)])];
    const c = muscleReadiness(h, NOW).get('chest')!;
    expect(c.readiness).toBe(1);
    expect(c.state).toBe('stale');
    expect(recoveringMuscles(muscleReadiness(h, NOW))).toHaveLength(0);
  });

  it('readiness never decreases as time passes without training (monotone)', () => {
    const h = [wk(NOW - 2 * 3600000, [ex(PRESS, 10)])];
    let prev = -1;
    for (let d = 0; d <= 20; d += 0.5) {
      const r = muscleReadiness(h, NOW + d * DAY).get('chest')!.readiness;
      expect(r).toBeGreaterThanOrEqual(prev);
      prev = r;
    }
  });

  it('untrained muscles are stale and fully ready; every landmarked muscle is returned', () => {
    const map = muscleReadiness([], NOW);
    expect(map.size).toBeGreaterThan(8);
    for (const r of map.values()) {
      expect(r.daysSince).toBeNull();
      expect(r.readiness).toBe(1);
      expect(r.state).toBe('stale');
    }
    expect(readyMuscles(map)).toHaveLength(map.size);
    expect(staleMuscles(map)).toHaveLength(0); // never-trained is not "stale-trained"
    expect(readinessMood(map)).toBe('fresh');
  });

  it('a recovery boost helps, and sessions older than the lookback are ignored', () => {
    const h = [wk(NOW - 3600000, [ex(PRESS, 8)])];
    const a = muscleReadiness(h, NOW, 0).get('chest')!.readiness;
    const b = muscleReadiness(h, NOW, 1).get('chest')!.readiness;
    expect(b).toBeGreaterThan(a);
    const old = [wk(NOW - 30 * DAY, [ex(PRESS, 8)])];
    expect(muscleReadiness(old, NOW).get('chest')!.daysSince).toBeNull();
  });

  it('recovery windows are per muscle: biceps/calves recover before quads', () => {
    expect(RECOVERY_DAYS.biceps!).toBeLessThan(RECOVERY_DAYS.quads!);
    const h = [wk(NOW - 2 * DAY, [ex('Barbell Curl', 6), ex('Barbell Squat', 6)])];
    const m = muscleReadiness(h, NOW);
    expect(m.get('biceps')!.readiness).toBeGreaterThanOrEqual(m.get('quads')!.readiness);
  });

  it('mood and groupings: many muscles recovering reads cooked', () => {
    const h = [
      wk(NOW - 3600000, [
        ex(PRESS, 8),
        ex('Barbell Squat', 8),
        ex('Pullups', 8),
        ex('Barbell Curl', 8),
        ex('Standing Military Press', 8),
      ]),
    ];
    const map = muscleReadiness(h, NOW);
    expect(readinessMood(map)).toBe('cooked');
    expect(recoveringMuscles(map).length).toBeGreaterThanOrEqual(4);
    // most-fatigued first
    const rs = recoveringMuscles(map).map((r) => r.readiness);
    expect([...rs].sort((a, b) => a - b)).toEqual(rs);
    const colors = readinessColors(map);
    expect(colors.chest).toBe(READINESS_COLOR.recovering);
    expect(Object.keys(colors).length).toBeGreaterThan(0);
    const mixed = muscleReadiness([wk(NOW - 3600000, [ex(PRESS, 8)])], NOW);
    expect(['mixed', 'cooked']).toContain(readinessMood(mixed));
  });

  it('the old stale state: trained long ago (past 2.2 windows) while still in lookback', () => {
    const h = [wk(NOW - 12 * DAY, [ex(PRESS, 4)])];
    expect(staleMuscles(muscleReadiness(h, NOW)).map((r) => r.muscle)).toContain('chest');
  });
});

describe('carryOverSets', () => {
  it('fades linearly to 0 by the end of the muscle window, per muscle and dose', () => {
    const h = [wk(NOW - 1 * DAY, [ex(PRESS, 10)])];
    const day1 = carryOverSets(h, NOW).get('chest') ?? 0;
    const day2 = carryOverSets(h, NOW + 1 * DAY).get('chest') ?? 0;
    const day9 = carryOverSets(h, NOW + 8 * DAY).get('chest') ?? 0;
    expect(day1).toBeGreaterThan(day2);
    expect(day9).toBe(0);
  });

  it('uses a custom MAV when given (bigger tolerance -> shorter window -> less carry)', () => {
    const h = [wk(NOW - 1 * DAY, [ex(PRESS, 10)])];
    const small = carryOverSets(h, NOW, () => 6).get('chest') ?? 0;
    const large = carryOverSets(h, NOW, () => 30).get('chest') ?? 0;
    expect(large).toBeLessThanOrEqual(small);
  });
});

describe('muscleGapDays', () => {
  it('counts calendar days since the muscle last took work; null when never', () => {
    const h = [wk(NOW - 9 * DAY, [ex(PRESS, 3)]), wk(NOW - 20 * DAY, [ex(PRESS, 3)])];
    expect(muscleGapDays(h, 'chest', NOW)).toBe(9);
    expect(muscleGapDays(h, 'quads', NOW)).toBeNull();
    expect(muscleGapDays([], 'chest', NOW)).toBeNull();
  });

  it('ignores sessions after `now` and picks the newest session regardless of order', () => {
    const h = [
      wk(NOW + 2 * DAY, [ex(PRESS, 3)]),
      wk(NOW - 5 * DAY, [ex(PRESS, 3)]),
      wk(NOW - 2 * DAY, [ex(PRESS, 3)]),
    ];
    expect(muscleGapDays(h, 'chest', NOW)).toBe(2);
  });
});
