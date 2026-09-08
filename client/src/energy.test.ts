import { describe, it, expect } from 'vitest';
import { ageFromDob, bmrKcal, overnightKcal } from './energy';
import type { BodyMetrics } from './types';

const now = new Date(2025, 5, 1).getTime();

describe('energy', () => {
  it('computes age from dob', () => {
    expect(ageFromDob('1995-01-01', now)).toBe(30);
    expect(ageFromDob(null, now)).toBeNull();
  });
  it('uses Mifflin–St Jeor when body fat is unknown', () => {
    const bm: BodyMetrics = { sex: 'male', dob: '1995-06-01', heightCm: 180, weights: [] };
    // 10*80 + 6.25*180 - 5*30 + 5 = 1780
    expect(bmrKcal(bm, 80, now)).toBe(1780);
  });
  it('uses Katch–McArdle when body fat is known', () => {
    const bm: BodyMetrics = { bodyFatPct: 20, weights: [] };
    // 370 + 21.6 * (80*0.8=64) = 1752
    expect(bmrKcal(bm, 80, now)).toBe(1752);
  });
  it('returns null without enough data', () => {
    expect(bmrKcal({ weights: [] }, 80, now)).toBeNull();
    expect(bmrKcal({ sex: 'male', heightCm: 180, weights: [] }, null, now)).toBeNull();
  });
  it('prorates overnight burn from BMR', () => {
    expect(overnightKcal(480, 1780)).toBe(564);
    expect(overnightKcal(480, null)).toBeNull();
  });
});
