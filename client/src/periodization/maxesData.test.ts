import { describe, expect, it } from 'vitest';
import { EMPTY_MAXES, maxKey, withMax, withoutMax, MAX_KG } from './maxesData';

describe('typed maxes (pure)', () => {
  it('keys by the lower-cased trimmed name and keeps the display name', () => {
    const d = withMax(EMPTY_MAXES, '  Barbell Squat ', 140, 10);
    expect(d.maxes[maxKey('barbell squat')]).toEqual({ name: 'Barbell Squat', kg: 140, at: 10 });
    expect(d.updatedAt).toBe(10);
  });
  it('replaces an earlier max of the same exercise, whatever the letter case', () => {
    const a = withMax(EMPTY_MAXES, 'Barbell Squat', 140, 1);
    const b = withMax(a, 'BARBELL SQUAT', 150, 2);
    expect(Object.keys(b.maxes)).toHaveLength(1);
    expect(Object.values(b.maxes)[0]?.kg).toBe(150);
  });
  it('ignores unusable input and clamps to the limit', () => {
    expect(withMax(EMPTY_MAXES, '', 100, 1)).toBe(EMPTY_MAXES);
    expect(withMax(EMPTY_MAXES, 'x', 0, 1)).toBe(EMPTY_MAXES);
    expect(withMax(EMPTY_MAXES, 'x', -5, 1)).toBe(EMPTY_MAXES);
    expect(withMax(EMPTY_MAXES, 'x', Number.NaN, 1)).toBe(EMPTY_MAXES);
    expect(Object.values(withMax(EMPTY_MAXES, 'x', 9999, 1).maxes)[0]?.kg).toBe(MAX_KG);
  });
  it('clearing removes only that exercise and leaves the document alone when there is none', () => {
    const a = withMax(withMax(EMPTY_MAXES, 'A', 100, 1), 'B', 90, 2);
    const b = withoutMax(a, 'a', 3);
    expect(Object.values(b.maxes).map((m) => m.name)).toEqual(['B']);
    expect(withoutMax(b, 'zzz', 4)).toBe(b);
  });
});
