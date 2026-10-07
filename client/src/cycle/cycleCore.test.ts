import { describe, expect, it } from 'vitest';
import {
  MENOPAUSE_KEY,
  calendarPhase,
  cycleSuppressedBy,
  estimate,
  isStale,
  loggedMenses,
  normalizeSettings,
  outOfNorm,
  phaseOfDay,
  projectedStart,
  sigma,
  type CycleSettings,
} from './cycleCore';
import type { ChronicCondition } from '../types';

const reg: CycleSettings = { mode: 'regular', length: 28, period: 5, anchor: 1000 };
const irr: CycleSettings = {
  mode: 'irregular',
  length: 30,
  period: 5,
  anchor: 1000,
  min: 24,
  max: 40,
};
const cond = (p: Partial<ChronicCondition>): ChronicCondition => ({
  id: 'x',
  key: 'preg_first',
  severity: 2,
  share: 'off' as ChronicCondition['share'],
  createdAt: 0,
  ...p,
});
const DAY = 86_400_000;

describe('projection', () => {
  it('start of cycle k and growing 80% interval', () => {
    expect(projectedStart(reg, 0)).toEqual({ day: 1000, half: 0 });
    expect(projectedStart(reg, 1)).toEqual({ day: 1028, half: Math.ceil(1.2816 * 2.9) });
    expect(projectedStart(reg, 2).half).toBeGreaterThan(projectedStart(reg, 1).half);
  });
  it('irregular sigma is a quarter of the range, never below the regular one', () => {
    expect(sigma(irr)).toBe(4);
    expect(sigma({ ...irr, min: 29, max: 31 })).toBe(2.9);
  });
  it('stale after two projected cycles', () => {
    expect(isStale(reg, 1000 + 3 * 28 - 1)).toBe(false);
    expect(isStale(reg, 1000 + 3 * 28)).toBe(true);
  });
});

describe('phases', () => {
  it('four coarse buckets for 28 days', () => {
    const p = (d: number) => phaseOfDay(d, 28, 5);
    expect([p(0), p(4), p(5), p(11), p(12), p(15), p(16), p(27)]).toEqual([
      'menses',
      'menses',
      'early',
      'early',
      'mid',
      'mid',
      'late',
      'late',
    ]);
  });
  it('estimate: none before the anchor, in log mode and when stale', () => {
    expect(estimate(reg, 999)).toBeNull();
    expect(estimate({ ...reg, mode: 'log' }, 1005)).toBeNull();
    expect(estimate(reg, 1000 + 3 * 28)).toBeNull();
  });
  it('estimate on day 10 of the first cycle', () => {
    const e = estimate(reg, 1009)!;
    expect(e).toMatchObject({ phase: 'early', dayOfCycle: 10, k: 0, approximate: false });
    expect(e.next.day).toBe(1028);
  });
  it('irregular mode is always approximate', () => {
    expect(estimate(irr, 1009)!.approximate).toBe(true);
  });
  it('log mode tints only past bleeding days, never the future', () => {
    const log: CycleSettings = { ...reg, mode: 'log' };
    expect(loggedMenses(log, 1002, 1009)).toBe(true);
    expect(loggedMenses(log, 1010, 1009)).toBe(false);
    expect(loggedMenses(log, 1030, 1100)).toBe(true);
    expect(calendarPhase(log, 1008, 1009)).toBeNull();
    expect(calendarPhase(reg, 1008, 1009)).toBe('early');
    expect(calendarPhase(reg, 1000 + 3 * 28, 1009)).toBeNull();
  });
});

describe('input', () => {
  it('clamps and orders irregular bounds', () => {
    expect(normalizeSettings({ ...irr, length: 99, min: 50, max: 10 })).toMatchObject({
      length: 60,
    });
    const n = normalizeSettings({ ...irr, min: 35, max: 20 });
    expect(n.min).toBeLessThanOrEqual(n.length);
    expect(n.max).toBeGreaterThanOrEqual(n.length);
  });
  it('flags values outside the usual range only', () => {
    expect(outOfNorm(reg)).toBe(false);
    expect(outOfNorm({ ...reg, length: 45 })).toBe(true);
    expect(outOfNorm({ ...reg, period: 9 })).toBe(true);
    expect(outOfNorm(irr)).toBe(true);
  });
});

describe('suppression by conditions', () => {
  const now = 400 * DAY;
  it('no conditions, other conditions, postpartum: off switch is not triggered', () => {
    expect(cycleSuppressedBy([], now)).toBeNull();
    expect(
      cycleSuppressedBy([cond({ key: 'knee_pain' }), cond({ key: 'preg_postpartum' })], now),
    ).toBeNull();
  });
  it('active pregnancy in any trimester', () => {
    for (const weeks of [2, 20, 35])
      expect(
        cycleSuppressedBy(
          [cond({ startedAt: now - weeks * 7 * DAY, endsAt: now + 100 * DAY })],
          now,
        ),
      ).toBe('pregnancy');
  });
  it('ended or future pregnancy does not suppress', () => {
    expect(
      cycleSuppressedBy([cond({ startedAt: now - 300 * DAY, endsAt: now - DAY })], now),
    ).toBeNull();
    expect(cycleSuppressedBy([cond({ startedAt: now + 5 * DAY })], now)).toBeNull();
  });
  it('menopause is permanent and wins', () => {
    expect(cycleSuppressedBy([cond({ key: MENOPAUSE_KEY })], now)).toBe('menopause');
    expect(
      cycleSuppressedBy([cond({ startedAt: now - DAY }), cond({ key: MENOPAUSE_KEY })], now),
    ).toBe('menopause');
  });
});
