import { describe, expect, it } from 'vitest';
import { rmsLevel } from './useAudioLevel';

describe('rmsLevel', () => {
  it('silence is 0, empty is 0', () => {
    expect(rmsLevel(new Uint8Array(64).fill(128))).toBe(0);
    expect(rmsLevel([])).toBe(0);
  });
  it('grows with amplitude and is capped at 1', () => {
    const quiet = rmsLevel(Uint8Array.from({ length: 64 }, (_, i) => 128 + (i % 2 ? 8 : -8)));
    const loud = rmsLevel(Uint8Array.from({ length: 64 }, (_, i) => 128 + (i % 2 ? 100 : -100)));
    expect(quiet).toBeGreaterThan(0);
    expect(loud).toBeGreaterThan(quiet);
    expect(rmsLevel(Uint8Array.from({ length: 64 }, (_, i) => (i % 2 ? 255 : 0)))).toBe(1);
  });
});
