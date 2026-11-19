import { describe, expect, it } from 'vitest';
import { FATIGUE_COLOR } from './fatigue';
import { READINESS_COLOR } from './recovery';

// SPO-601: the load scale must not borrow the theme accent (white in titan, brass in Brass Glass...),
// otherwise "tired" is not warm in some themes. Fresh green -> amber -> orange -> red.
describe('fatigue and readiness colours', () => {
  it('four distinct fatigue colours, none of them the theme accent', () => {
    const all = Object.values(FATIGUE_COLOR);
    expect(new Set(all).size).toBe(4);
    for (const c of all) expect(c).not.toMatch(/accent/);
    expect(FATIGUE_COLOR.fresh).toBe('var(--color-ok)');
    expect(FATIGUE_COLOR.moderate).toBe('var(--color-warn)');
    expect(FATIGUE_COLOR.high).toBe('var(--color-warn-strong)');
    expect(FATIGUE_COLOR.fried).toBe('var(--color-danger)');
  });

  it('readiness states are distinct and none uses the accent', () => {
    const all = Object.values(READINESS_COLOR);
    expect(new Set(all).size).toBe(all.length);
    for (const c of all) expect(c).not.toMatch(/accent/);
  });
});
