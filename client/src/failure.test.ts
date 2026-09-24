import { describe, expect, it } from 'vitest';
import { inferFailure, suggestFailure } from './failure';
import { estimateRpe, readinessFactor, type RpeContext } from './rpe';
import { defaultRestSec } from './restTimer';
import type { SetEntry } from './types';

const set = (reps: number, weight: number | null, extra: Partial<SetEntry> = {}): SetEntry => ({
  id: Math.random().toString(36),
  reps,
  weight,
  isWarmup: false,
  position: 0,
  ...extra,
});

describe('inferFailure', () => {
  it('RPE 10 and partials are failure', () => {
    expect(inferFailure({ ...set(8, 80), rpe: 10 }, { before: [] })).toBe('rpe');
    expect(inferFailure({ ...set(8, 80), partials: 2 }, { before: [] })).toBe('partials');
  });
  it('missing the target by 2+ reps at the target load', () => {
    expect(inferFailure(set(6, 80), { target: { reps: 8, weight: 80 }, before: [] })).toBe(
      'missed',
    );
    expect(inferFailure(set(7, 80), { target: { reps: 8, weight: 80 }, before: [] })).toBeNull();
    // lighter than proposed: a choice, not a failure
    expect(inferFailure(set(6, 70), { target: { reps: 8, weight: 80 }, before: [] })).toBeNull();
    // tiny targets are too noisy
    expect(inferFailure(set(1, 120), { target: { reps: 3, weight: 120 }, before: [] })).toBeNull();
  });
  it('a rep collapse at the same load', () => {
    const before = [set(10, 60), set(10, 60)];
    expect(inferFailure(set(6, 60), { before })).toBe('collapse');
    expect(inferFailure(set(8, 60), { before })).toBeNull(); // normal fatigue
    expect(inferFailure(set(6, 65), { before })).toBeNull(); // heavier: expected
  });
  it('never infers warm-ups, holds or explicit marks', () => {
    expect(inferFailure({ ...set(3, 40), type: 'warmup', rpe: 10 }, { before: [] })).toBeNull();
    expect(inferFailure({ ...set(8, 80), rpe: 10, failure: 'no' }, { before: [] })).toBeNull();
  });
  it('drop sets are run to failure', () => {
    expect(inferFailure({ ...set(8, 80), type: 'drop' }, { before: [] })).toBe('drop');
  });
});

describe('suggestFailure', () => {
  it('keeps going after a manual failure set', () => {
    expect(
      suggestFailure({
        type: 'working',
        current: [set(8, 80, { failure: 'manual' })],
        plannedSets: 0,
        past: [],
      }),
    ).toBe('streak');
  });
  it('last planned set when the habit is there', () => {
    const past = [
      { sets: [set(8, 80), set(7, 80, { failure: 'manual' })] },
      { sets: [set(8, 80), set(6, 80, { failure: 'auto' })] },
      { sets: [set(8, 80), set(8, 80)] },
    ];
    const current = [set(8, 80), set(8, 80)];
    expect(suggestFailure({ type: 'working', current, plannedSets: 3, past })).toBe('habit');
    expect(
      suggestFailure({ type: 'working', current: [set(8, 80)], plannedSets: 3, past }),
    ).toBeNull();
  });
});

describe('estimateRpe', () => {
  const ctx: RpeContext = {
    refE1: 100,
    daysSinceLift: 3,
    illnessDaysAgo: null,
    muscleFatigue: 0,
    sleepShortH: 0,
    priorSets: 0,
  };
  it('follows the e1RM model', () => {
    // 100 e1RM → 75 kg max ≈ 10 reps: 10 reps = RPE 10, 8 reps = RPE 8
    expect(estimateRpe(75, 10, ctx)).toBe(10);
    expect(estimateRpe(75, 8, ctx)).toBe(8);
    expect(estimateRpe(75, 2, ctx)).toBe(6);
  });
  it('a worse day makes the same set harder', () => {
    const sick = { ...ctx, illnessDaysAgo: 0, sleepShortH: 2, priorSets: 3 };
    expect(readinessFactor(sick).factor).toBeLessThan(0.9);
    expect(estimateRpe(75, 3, sick)!).toBeGreaterThan(estimateRpe(75, 3, ctx)!);
  });
  it('no estimate without history or for bodyweight', () => {
    expect(estimateRpe(75, 8, { ...ctx, refE1: 0 })).toBeNull();
    expect(estimateRpe(0, 8, ctx)).toBeNull();
  });
});

describe('defaultRestSec', () => {
  it('by set and lift type', () => {
    expect(defaultRestSec({ compound: true, lastType: 'working', midRound: false })).toBe(150);
    expect(defaultRestSec({ compound: false, lastType: 'working', midRound: false })).toBe(90);
    expect(defaultRestSec({ compound: true, lastType: 'warmup', midRound: false })).toBe(60);
    expect(defaultRestSec({ compound: true, lastType: 'working', midRound: true })).toBe(0);
  });
});

import { marginalStimulus, performanceDrops, tiredVerdict, usualNext } from './stimulus';

describe('stimulus', () => {
  it('diminishing returns per extra hard set', () => {
    expect(marginalStimulus(0)).toBe(1);
    expect(marginalStimulus(6)).toBeCloseTo(0.5);
    expect(marginalStimulus(10)).toBeLessThan(0.3);
  });
  it('performance drop vs the best set so far', () => {
    const s = [set(8, 80), set(8, 80), set(6, 80)];
    const d = performanceDrops(s);
    expect(d.get(s[0].id)).toBe(0);
    expect(d.get(s[2].id)!).toBeCloseTo(1 - (80 * (1 + 6 / 30)) / (80 * (1 + 8 / 30)), 3);
  });
  it('enough by drop or volume; a plan only yields to a big drop', () => {
    const sets = [set(8, 80), set(8, 80), set(7, 80), set(6, 80), set(4, 80)];
    expect(tiredVerdict({ sets, muscleSets: 5, plannedLeft: 0 }).enough).toBe(true);
    const mild = [set(8, 80), set(8, 80), set(7, 80)];
    expect(tiredVerdict({ sets: mild, muscleSets: 3, plannedLeft: 0 }).enough).toBe(false);
    expect(tiredVerdict({ sets: mild, muscleSets: 11, plannedLeft: 0 }).enough).toBe(true);
    // a plan with sets left doesn't hide it once the muscle is past its plateau
    expect(tiredVerdict({ sets: mild, muscleSets: 11, plannedLeft: 2 }).enough).toBe(true);
    // a brand-new lift on a muscle that already had enough
    expect(tiredVerdict({ sets: [], muscleSets: 12, plannedLeft: 0 }).enough).toBe(true);
    // a tolerant athlete's higher plateau
    expect(tiredVerdict({ sets: mild, muscleSets: 12, plannedLeft: 0, plateau: 14 }).enough).toBe(
      false,
    );
  });
  it('usual next from history', () => {
    const s = (...n: string[]) => n.map((name, position) => ({ name, position }));
    const hist = [s('Bench', 'Incline'), s('Bench', 'Incline'), s('Bench', 'Fly')];
    expect(usualNext(hist, 'Bench', new Set())).toBe('Incline');
    expect(usualNext(hist, 'Bench', new Set(['incline']))).toBe('Fly');
  });
});
