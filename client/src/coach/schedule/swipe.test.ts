import { describe, expect, it } from 'vitest';
import { swipeDir } from './swipe';

describe('swipeDir', () => {
  it('a long mostly horizontal drag pages: left = forward, right = back', () => {
    expect(swipeDir(-120, 10)).toBe(1);
    expect(swipeDir(120, -10)).toBe(-1);
  });
  it('a short drag, or a vertical scroll, is not a swipe', () => {
    expect(swipeDir(-40, 0)).toBe(0);
    expect(swipeDir(-100, 80)).toBe(0);
    expect(swipeDir(0, 300)).toBe(0);
  });
});
