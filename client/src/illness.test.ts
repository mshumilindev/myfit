import { describe, expect, it } from 'vitest';
import { illnessState, returnStepCount, stepCaps } from './illness';
import type { RestPeriod, Workout } from './types';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 30, 12);
const day = (off: number) => Math.floor(NOW / DAY) + off;
const period = (p: Partial<RestPeriod>): RestPeriod => ({
  id: 'p',
  startDay: day(-3),
  endDay: day(-3),
  mode: 'illness',
  createdAt: 1,
  ...p,
});
const workout = (off: number): Workout =>
  ({
    id: `w${off}`,
    startedAt: NOW + off * DAY,
    finishedAt: NOW + off * DAY + 3_600_000,
  }) as Workout;

describe('returnStepCount', () => {
  it.each([
    ['cold', 1, 0],
    ['cold', 3, 1],
    ['cold', 5, 2],
    ['virus', 1, 1],
    ['virus', 3, 2],
    ['virus', 6, 4],
    ['virus', 10, 6],
    ['virus', 20, 8],
    ['stomach', 2, 1],
    ['stomach', 4, 2],
    ['stomach', 9, 3],
    ['other', 1, 0],
    ['other', 6, 3],
    ['mental', 30, 0],
  ] as const)('%s, %i days → %i steps', (kind, d, n) => {
    expect(returnStepCount(kind, d)).toBe(n);
  });
});

describe('stepCaps', () => {
  it('starts at ~60% with effort and rest limits, ends near 90% without limits', () => {
    expect(stepCaps(1, 4)).toEqual({ volume: 0.6, rpeMax: 7, restAddSec: 20 });
    const last = stepCaps(4, 4);
    expect(last.volume).toBeGreaterThan(0.85);
    expect(last.rpeMax).toBeNull();
    expect(last.restAddSec).toBe(0);
  });
});

describe('illnessState', () => {
  it('is clear with nothing logged', () => {
    expect(illnessState([], [], NOW).phase).toBe('clear');
  });

  it('is sick while an illness covers today, with the day count', () => {
    const s = illnessState(
      [period({ open: true, startDay: day(-3), endDay: day(-3), illnessKind: 'virus' })],
      [],
      NOW,
    );
    expect(s.phase).toBe('sick');
    expect(s.kind).toBe('virus');
    expect(s.days).toBe(4);
    expect(s.caps.restAddSec).toBe(20);
  });

  it('mental never asks to rest or ramp, and leaves no return plan behind', () => {
    const on = illnessState(
      [period({ open: true, startDay: day(-5), illnessKind: 'mental' })],
      [],
      NOW,
    );
    expect(on.phase).toBe('mental');
    expect(on.caps).toEqual({ volume: 1, rpeMax: null, restAddSec: 0 });
    expect(on.rpeCut).toBe(0);
    const off = illnessState(
      [period({ startDay: day(-9), endDay: day(-3), illnessKind: 'mental' })],
      [],
      NOW,
    );
    expect(off.phase).toBe('clear');
  });

  it('returns over steps after recovery and advances per finished session', () => {
    const p = [period({ startDay: day(-8), endDay: day(-2), illnessKind: 'virus' })];
    const s0 = illnessState(p, [], NOW);
    expect(s0.phase).toBe('returning');
    expect(s0.steps).toBe(4);
    expect(s0.step).toBe(1);
    const s1 = illnessState(p, [workout(-1)], NOW);
    expect(s1.step).toBe(2);
    const done = illnessState(p, [workout(-1), workout(-1), workout(0), workout(0)], NOW);
    expect(done.phase).toBe('clear');
  });

  it('a workout during the illness does not count as a return step', () => {
    const p = [period({ startDay: day(-8), endDay: day(-2), illnessKind: 'virus' })];
    expect(illnessState(p, [workout(-4)], NOW).step).toBe(1);
  });

  it('one cold day leaves nothing behind; the plan lapses after the window', () => {
    expect(
      illnessState([period({ startDay: day(-1), endDay: day(-1), illnessKind: 'cold' })], [], NOW)
        .phase,
    ).toBe('clear');
    expect(
      illnessState(
        [period({ startDay: day(-40), endDay: day(-30), illnessKind: 'virus' })],
        [],
        NOW,
      ).phase,
    ).toBe('clear');
  });

  it('old records without a kind behave as other', () => {
    const s = illnessState([period({ startDay: day(-6), endDay: day(-2) })], [], NOW);
    expect(s.kind).toBe('other');
    expect(s.steps).toBe(3);
  });

  it('flags a long illness for a doctor', () => {
    const s = illnessState([period({ open: true, startDay: day(-30) })], [], NOW);
    expect(s.needsDoctor).toBe(true);
  });
});
