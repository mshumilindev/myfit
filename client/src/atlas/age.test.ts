import { describe, expect, it } from 'vitest';
import { capTemperForAge, isUnderSavageAge, savageAllowedFor, UNDERAGE_TEMPER } from './age';
import { effectiveTemper } from './guard';
import { COACH_DEFAULT } from './types';

const NOW = new Date('2026-11-04T12:00:00Z').getTime();
const ctx = { injuries: [], restPeriods: [], sleeps: [], finished: [], now: NOW };

describe('Savage is 18+ only (SPO-124)', () => {
  it('under 18 is blocked, the birthday itself unlocks it', () => {
    expect(isUnderSavageAge('2010-01-01', NOW)).toBe(true);
    expect(isUnderSavageAge('2008-11-05', NOW)).toBe(true); // turns 18 tomorrow
    expect(isUnderSavageAge('2008-11-04', NOW)).toBe(false); // 18 today
    expect(isUnderSavageAge('1990-05-05', NOW)).toBe(false);
  });
  it('an unknown or invalid date of birth is allowed (the app is 18+ at registration)', () => {
    for (const d of [null, undefined, '', 'not-a-date']) {
      expect(isUnderSavageAge(d, NOW)).toBe(false);
      expect(savageAllowedFor(d, NOW)).toBe(true);
    }
  });
  it('caps Savage to Neutral under 18 and leaves other tempers alone', () => {
    expect(capTemperForAge(5, '2012-03-03', NOW)).toBe(UNDERAGE_TEMPER);
    expect(capTemperForAge(1, '2012-03-03', NOW)).toBe(1);
    expect(capTemperForAge(3, '2012-03-03', NOW)).toBe(3);
    expect(capTemperForAge(5, '1995-03-03', NOW)).toBe(5);
    expect(capTemperForAge(5, null, NOW)).toBe(5);
  });
  it('effectiveTemper never speaks Savage to an under-18 profile', () => {
    const red = { ...COACH_DEFAULT, temper: 5 as const, keepTemper: true };
    expect(effectiveTemper(red, { ...ctx, dob: '2012-03-03' })).toBe(UNDERAGE_TEMPER);
    expect(effectiveTemper(red, { ...ctx, dob: '1995-03-03' })).toBe(5);
    expect(effectiveTemper(red, ctx)).toBe(5);
  });
});
