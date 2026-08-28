import { describe, expect, it } from 'vitest';
import {
  deriveLoadType,
  bandForKg,
  nextBand,
  assistStack,
  countsAsTonnage,
  BAND_DEFAULTS,
} from './loads';

describe('deriveLoadType', () => {
  it('bands equipment → band', () => {
    expect(deriveLoadType('Band Pull-apart', ['bands'])).toBe('band');
  });
  it('assisted name → assist', () => {
    expect(deriveLoadType('Assisted Pull-up', ['machine'])).toBe('assist');
    expect(deriveLoadType('Assisted Dip', [])).toBe('assist');
  });
  it('plain loaded lift → weight', () => {
    expect(deriveLoadType('Barbell Squat', ['barbell'])).toBe('weight');
    expect(deriveLoadType('Dumbbell Curl', ['dumbbell'])).toBe('weight');
  });
  it('bands win over an assisted-sounding name', () => {
    expect(deriveLoadType('Assisted band row', ['bands'])).toBe('band');
  });
});

describe('bandForKg', () => {
  it('maps a stored estimate back to the nearest colour', () => {
    expect(bandForKg(15, BAND_DEFAULTS)?.color).toBe('red');
    expect(bandForKg(12, BAND_DEFAULTS)?.color).toBe('green'); // 11 closer than 15
    expect(bandForKg(100, BAND_DEFAULTS)?.color).toBe('black'); // clamps to heaviest
  });
  it('empty library → null', () => {
    expect(bandForKg(15, [])).toBe(null);
  });
});

describe('nextBand', () => {
  it('steps up to the next heavier band', () => {
    expect(nextBand('green', BAND_DEFAULTS)?.color).toBe('red');
    expect(nextBand('red', BAND_DEFAULTS)?.color).toBe('black');
  });
  it('null past the heaviest', () => {
    expect(nextBand('black', BAND_DEFAULTS)).toBe(null);
  });
});

describe('assistStack', () => {
  it('gives negative counter-weights, heaviest help first', () => {
    const s = assistStack(0, 8, 5);
    expect(s).toEqual([-40, -32, -24, -16, -8]);
    expect(s.every((v) => v < 0)).toBe(true);
  });
  it('covers the current value even when it exceeds the default range', () => {
    const s = assistStack(-60, 8, 6);
    expect(Math.min(...s)).toBeLessThanOrEqual(-60);
  });
});

describe('countsAsTonnage', () => {
  it('only plain weight counts', () => {
    expect(countsAsTonnage('weight')).toBe(true);
    expect(countsAsTonnage('assist')).toBe(false);
    expect(countsAsTonnage('band')).toBe(false);
  });
});
