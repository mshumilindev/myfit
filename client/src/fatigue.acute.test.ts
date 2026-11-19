import { describe, expect, it } from 'vitest';
import {
  ACUTE_CAP_FULL,
  ACUTE_CAP_LIGHT,
  ACUTE_MIN_SETS,
  acuteCap,
  acuteFatigueScore,
  deloadSuggestion,
  muscleFatigue,
} from './fatigue';
import type { Exercise, SetEntry, Workout } from './types';

const HOUR = 3600000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 10, 19, 19, 0);
const PRESS = 'Barbell Bench Press - Medium Grip';

const set = (): SetEntry => ({
  id: Math.random().toString(36).slice(2),
  reps: 8,
  weight: 60,
  isWarmup: false,
  position: 0,
  loggedAt: NOW,
});
const press = (n: number): Exercise => ({
  id: `p${n}`,
  name: PRESS,
  position: 0,
  sets: Array.from({ length: n }, set),
});
const session = (agoMs: number, n: number): Workout => ({
  id: `w${agoMs}`,
  startedAt: NOW - agoMs,
  finishedAt: NOW - agoMs + HOUR,
  autoFinished: false,
  exercises: [press(n)],
});
const chest = (agoMs: number, n: number) => muscleFatigue([session(agoMs, n)], NOW).get('chest')!;

describe('SPO-601: acute fatigue from the last direct session', () => {
  it('11 chest sets an hour ago read tired ("high"), not fresh (owner case)', () => {
    const c = chest(HOUR, 11);
    expect(c.level).toBe('high');
    expect(c.weeklyLevel).toBe('fresh');
    expect(c.acuteDays).toBeCloseTo(1 / 24, 5);
    expect(c.score).toBeLessThanOrEqual(ACUTE_CAP_FULL);
  });

  it('a light session (3 sets) tops out at moderate', () => {
    const c = chest(HOUR, 3);
    expect(c.level).toBe('moderate');
    expect(c.score).toBeLessThanOrEqual(ACUTE_CAP_LIGHT + 1e-9);
  });

  it('the same 11 sets read fresh again once the muscle has recovered', () => {
    expect(chest(5 * DAY, 11).level).toBe('fresh');
    expect(chest(9 * DAY, 11).level).toBe('fresh');
  });

  it('high fades to moderate within a day, then fresh once recovered', () => {
    expect(chest(1 * DAY, 11).level).toBe('moderate');
    expect(chest(3 * DAY, 11).level).toBe('fresh');
  });

  it('fewer than the minimum direct sets (a warm-up or two) do not tire the muscle', () => {
    expect(ACUTE_MIN_SETS).toBe(3);
    expect(chest(HOUR, 2).level).toBe('fresh');
    expect(chest(HOUR, 2).score).toBe(0);
  });

  it('never reaches fried from the acute term alone, at any age or size', () => {
    for (const n of [3, 6, 11, 15]) {
      for (let h = 0; h <= 20 * 24; h += 6) {
        const c = chest(h * HOUR, n);
        expect(c.level).not.toBe('fried');
        expect(c.weeklyLevel).toBe('fresh');
        expect(c.score).toBeLessThanOrEqual(ACUTE_CAP_FULL + 1e-9);
      }
    }
  });

  it('the score never rises as time passes', () => {
    let prev = Infinity;
    for (let h = 0; h <= 10 * 24; h += 3) {
      const s = chest(h * HOUR, 11).score;
      expect(s).toBeLessThanOrEqual(prev + 1e-9);
      prev = s;
    }
  });

  it('the full cap stays below the lowest possible "fried" threshold', () => {
    // fried = 0.7 * deloadMult; nicotine (-10 %) and alcohol (-6 %) at their caps give >= 0.84
    expect(ACUTE_CAP_FULL).toBeLessThan(0.7 * 0.84);
  });

  it('the cap ramps with the dose share of MAV: light below 30 %, full from 50 %', () => {
    expect(acuteCap(3, 14)).toBeCloseTo(ACUTE_CAP_LIGHT, 5);
    expect(acuteCap(7, 14)).toBeCloseTo(ACUTE_CAP_FULL, 5);
    expect(acuteCap(5.6, 14)).toBeGreaterThan(ACUTE_CAP_LIGHT);
    expect(acuteCap(5.6, 14)).toBeLessThan(ACUTE_CAP_FULL);
  });

  it('deload ignores the acute term: six freshly trained muscles at "high" suggest nothing', () => {
    const day: Workout = {
      id: 'many',
      startedAt: NOW - HOUR,
      finishedAt: NOW,
      autoFinished: false,
      exercises: [
        'Barbell Bench Press - Medium Grip',
        'Barbell Squat',
        'Bent Over Barbell Row',
      ].map((name, i) => ({
        id: `x${i}`,
        name,
        position: i,
        sets: Array.from({ length: 12 }, set),
      })),
    };
    const fat = muscleFatigue([day], NOW);
    expect([...fat.values()].filter((f) => f.level === 'high').length).toBeGreaterThanOrEqual(2);
    expect(deloadSuggestion(fat, 0).kind).toBe('none');
  });

  it('acuteFatigueScore: pure, bounded, zero when untrained or tiny', () => {
    expect(acuteFatigueScore(null, 11, 2.5, 14)).toBe(0);
    expect(acuteFatigueScore(0.1, 2, 2.5, 14)).toBe(0);
    expect(acuteFatigueScore(0, 11, 2.5, 14, NOW)).toBeCloseTo(ACUTE_CAP_FULL, 5);
    expect(acuteFatigueScore(30, 11, 2.5, 14, NOW)).toBe(0);
  });

  it('a heavy week still wins: the acute term is a max, never added on top', () => {
    const heavy = [session(HOUR, 11), session(2 * DAY, 12), session(4 * DAY, 12)];
    const weekly = muscleFatigue(heavy, NOW, undefined, { acute: false }).get('chest')!;
    const both = muscleFatigue(heavy, NOW).get('chest')!;
    expect(weekly.level).toMatch(/high|fried/);
    expect(both.score).toBe(weekly.score);
    expect(both.acuteDays).toBeUndefined();
  });

  it('max, not sum: 20 sets an hour ago (weekly ~0.35, acute up to 0.5) never add up', () => {
    const one = [session(HOUR, 20)];
    const weekly = muscleFatigue(one, NOW, undefined, { acute: false }).get('chest')!;
    const both = muscleFatigue(one, NOW).get('chest')!;
    expect(both.score).toBeGreaterThanOrEqual(weekly.score);
    expect(both.score).toBeLessThanOrEqual(ACUTE_CAP_FULL + 1e-9); // a sum would be ~0.8
  });

  it('acute: false is the pure weekly read (rpe / rest timer / Today index use it)', () => {
    const c = muscleFatigue([session(HOUR, 11)], NOW, undefined, { acute: false }).get('chest')!;
    expect(c.level).toBe('fresh');
    expect(c.score).toBe(0);
  });

  it("a couple of warm-up sets today do not hide yesterday's real session", () => {
    const history = [session(DAY, 12), session(HOUR, 2)];
    expect(muscleFatigue(history, NOW).get('chest')!.level).toBe('moderate');
  });

  it('a session that starts after "now" is ignored', () => {
    expect(chest(-HOUR, 11).level).toBe('fresh');
  });

  it('a higher personal MAV shortens the window (less acute fatigue at the same time)', () => {
    const base = muscleFatigue([session(DAY, 11)], NOW).get('chest')!;
    const tolerant = new Map([['chest' as const, { mev: 10, mav: 30, mrv: 40 }]]);
    const t = muscleFatigue([session(DAY, 11)], NOW, tolerant).get('chest')!;
    expect(t.score).toBeLessThan(base.score);
  });

  it('acute fatigue does not leak to other muscles', () => {
    const m = muscleFatigue([session(HOUR, 11)], NOW);
    expect(m.get('quads')!.level).toBe('fresh');
    expect(m.get('biceps')!.score).toBeLessThan(0.15);
  });

  it('acuteDays is set only when the acute term changes the level (else the week is the reason)', () => {
    const heavy = [session(HOUR, 11), session(2 * DAY, 12), session(4 * DAY, 12)];
    expect(muscleFatigue(heavy, NOW).get('chest')!.acuteDays).toBeUndefined();
    expect(chest(HOUR, 11).acuteDays).toBeDefined();
  });
});
