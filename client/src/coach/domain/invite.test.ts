import { describe, expect, it } from 'vitest';
import { ALL_OFF } from './consent';
import {
  daysLeft,
  defaultRequest,
  effectiveRequest,
  modeAsksConsent,
  nameProblem,
  requestedCategories,
  setLevel,
} from './invite';

describe('invite rules', () => {
  it('program-only requests nothing, whatever the picker held', () => {
    expect(defaultRequest('program')).toEqual(ALL_OFF);
    expect(modeAsksConsent('program')).toBe(false);
    expect(effectiveRequest('program', { ...ALL_OFF, sets: 'full' })).toEqual(ALL_OFF);
    expect(effectiveRequest('app', { ...ALL_OFF, sets: 'full' }).sets).toBe('full');
  });

  it('defaults: app asks totals + sets + check-ins, hybrid asks totals only', () => {
    expect(requestedCategories(defaultRequest('app'))).toEqual(['totals', 'sets', 'checkins']);
    expect(requestedCategories(defaultRequest('hybrid'))).toEqual(['totals']);
    expect(Object.values(defaultRequest('app')).every((l) => l === 'off' || l === 'full')).toBe(
      true,
    );
  });

  it('setLevel is immutable', () => {
    const a = defaultRequest('app');
    const b = setLevel(a, 'sleep', 'effects');
    expect(a.sleep).toBe('off');
    expect(b.sleep).toBe('effects');
  });

  it('name validation', () => {
    expect(nameProblem('')).toBe('empty');
    expect(nameProblem('   ')).toBe('empty');
    expect(nameProblem('A')).toBe('short');
    expect(nameProblem('Ol')).toBeNull();
    expect(nameProblem('x'.repeat(81))).toBe('long');
  });

  it('days left rounds up and never goes negative', () => {
    const now = 1_000_000_000;
    expect(daysLeft(now + 6 * 86_400_000, now)).toBe(6);
    expect(daysLeft(now + 3_600_000, now)).toBe(1);
    expect(daysLeft(now - 5, now)).toBe(0);
  });
});
