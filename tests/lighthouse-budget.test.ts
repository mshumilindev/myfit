import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { verdict } from '../scripts/check-lighthouse.mjs';

describe('lighthouse floor', () => {
  it('passes at the floor and fails below it', () => {
    expect(verdict(0.25, 0.25).ok).toBe(true);
    expect(verdict(0.24, 0.25).ok).toBe(false);
  });
  it('the floor never exceeds the recorded baseline (it is a ratchet, not a wish)', () => {
    const b = JSON.parse(readFileSync('lighthouse-budget.json', 'utf8'));
    expect(b.performanceFloor).toBeLessThanOrEqual(b.baseline.performance);
  });
});
