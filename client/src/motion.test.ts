import { describe, expect, it } from 'vitest';
import { frameStats, hardNo, isSmooth } from './motion';

describe('motion budget', () => {
  it('a steady 60 fps history is smooth, a 20 fps one is not', () => {
    expect(isSmooth(Array(60).fill(16.7))).toBe(true);
    expect(isSmooth(Array(60).fill(50))).toBe(false);
  });
  it('a few janky frames are tolerated, many are not', () => {
    const ok = [...Array(55).fill(16.7), ...Array(5).fill(90)];
    const bad = [...Array(40).fill(16.7), ...Array(20).fill(90)];
    expect(isSmooth(ok)).toBe(true);
    expect(isSmooth(bad)).toBe(false);
  });
  it('too few samples never pass', () => {
    expect(isSmooth([16, 16, 16])).toBe(false);
    expect(frameStats([]).median).toBe(Infinity);
  });
  it('hard vetoes: reduced motion, save-data, weak hardware', () => {
    const base = { reducedMotion: false, saveData: false };
    expect(hardNo(base)).toBe(false);
    expect(hardNo({ ...base, reducedMotion: true })).toBe(true);
    expect(hardNo({ ...base, saveData: true })).toBe(true);
    expect(hardNo({ ...base, deviceMemory: 2 })).toBe(true);
    expect(hardNo({ ...base, cores: 2 })).toBe(true);
    expect(hardNo({ ...base, deviceMemory: 8, cores: 8 })).toBe(false);
  });
});
