import { describe, expect, it } from 'vitest';
import { WAVE_BARS, waveSteps } from './waveSteps';

describe('waveSteps', () => {
  it('draws one step per bar, each 1..10', () => {
    const s = waveSteps(0.7, 3);
    expect(s).toHaveLength(WAVE_BARS);
    for (const v of s) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(10);
    }
  });
  it('silence is the lowest step on every bar', () => {
    expect(waveSteps(0, 5).every((v) => v === 1)).toBe(true);
  });
  it('a louder voice never draws a quieter bar than a softer one (same phase)', () => {
    const quiet = waveSteps(0.2, 1);
    const loud = waveSteps(0.9, 1);
    quiet.forEach((q, i) => expect(loud[i]).toBeGreaterThanOrEqual(q));
  });
  it('the middle bars rise highest', () => {
    const s = waveSteps(1, 0.4);
    expect(Math.max(...s.slice(3, 6))).toBeGreaterThanOrEqual(Math.max(s[0], s[8]));
  });
  it('treats a broken level as silence and clamps over-range', () => {
    expect(waveSteps(Number.NaN, 0).every((v) => v === 1)).toBe(true);
    expect(waveSteps(5, 0).every((v) => v <= 10)).toBe(true);
  });
});
