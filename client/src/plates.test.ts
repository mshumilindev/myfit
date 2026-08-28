import { describe, expect, it } from 'vitest';
import { solvePlates, totalFromPlates, plateCounts, lbToKg } from './plates';

describe('solvePlates (kg)', () => {
  it('loads an exact total per side, largest first', () => {
    // 100 kg on a 20 kg bar → 40 kg per side → greedy 25 + 15
    const s = solvePlates(100, { barKg: 20, unit: 'kg' });
    expect(s.exact).toBe(true);
    expect(s.achievedKg).toBe(100);
    expect(s.perSide).toEqual([25, 15]);
    expect(s.perSideKg).toBe(40);
  });

  it('just the bar when the target equals the bar', () => {
    const s = solvePlates(20, { barKg: 20, unit: 'kg' });
    expect(s.perSide).toEqual([]);
    expect(s.exact).toBe(true);
  });

  it('undershoots to the closest loadable weight and reports the delta', () => {
    // 101 kg is not loadable with a 1.25 min plate (needs 0.5 per side); with the
    // default rack the closest at/below is 101 (0.5 kg plates exist) → check 100.7
    const s = solvePlates(100.7, { barKg: 20, unit: 'kg', plates: [25, 20, 15, 10, 5, 2.5, 1.25] });
    expect(s.exact).toBe(false);
    expect(s.achievedKg).toBeLessThanOrEqual(100.7);
    expect(s.deltaKg).toBeGreaterThan(0);
  });

  it('accounts for collars', () => {
    // 20 bar + 2×2.5 collars = 25 kg base; 45 total → 20 kg over two sides → 10 per side
    const s = solvePlates(45, { barKg: 20, unit: 'kg', collarKg: 2.5 });
    expect(s.achievedKg).toBe(45);
    expect(s.perSideKg).toBe(10);
  });
});

describe('solvePlates (lb plates, kg storage)', () => {
  it('loads lb plates and reports the kg actually achieved', () => {
    // 45 lb bar + 45 lb per side = 135 lb total → in kg:
    const s = solvePlates(lbToKg(135), { barKg: lbToKg(45), unit: 'lb' });
    expect(s.perSide).toEqual([45]);
    expect(s.exact).toBe(true);
    expect(Math.round(s.achievedKg)).toBe(Math.round(lbToKg(135)));
  });
});

describe('build helpers', () => {
  it('totalFromPlates mirrors solve', () => {
    expect(totalFromPlates([20, 15, 5], { barKg: 20, unit: 'kg' })).toBe(100);
  });
  it('plateCounts groups runs', () => {
    expect(plateCounts([20, 20, 10, 2.5])).toEqual([
      { denom: 20, count: 2 },
      { denom: 10, count: 1 },
      { denom: 2.5, count: 1 },
    ]);
  });
});
