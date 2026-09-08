import { describe, it, expect } from 'vitest';
import { exerciseDisplay, exerciseNameVariants } from './exerciseNames';
import { setLocale } from '../i18n';
import { searchCatalog } from './exercises';

describe('localized exercise names', () => {
  it('keeps English as-is under the en locale', () => {
    expect(exerciseDisplay('Barbell Squat', 'en')).toEqual({
      primary: 'Barbell Squat',
      secondary: null,
    });
  });
  it('shows a localized primary + English secondary for a non-English locale', () => {
    const d = exerciseDisplay('Barbell Squat', 'uk');
    expect(d.primary).toBe('Присідання зі штангою');
    expect(d.secondary).toBe('Barbell Squat');
  });
  it('falls back to the plain name when no localization exists', () => {
    expect(exerciseDisplay('Atlas Stones', 'uk')).toEqual({
      primary: 'Atlas Stones',
      secondary: null,
    });
  });
  it('exposes English + localized variants for search', () => {
    const v = exerciseNameVariants('Barbell Squat');
    expect(v).toContain('Barbell Squat');
    expect(v.some((x) => x.includes('Присідання'))).toBe(true);
  });
});

describe('cross-language catalog search', () => {
  it('matches by a localized exercise name regardless of the active locale', () => {
    setLocale('en');
    expect(searchCatalog('присідання', 6).map((e) => e.names[0])).toContain('Barbell Squat');
    expect(searchCatalog('martwy', 6).some((e) => /Deadlift/.test(e.names[0]))).toBe(true);
    expect(searchCatalog('pritūpimai', 6).some((e) => /Squat/.test(e.names[0]))).toBe(true);
  });
  it('matches by a muscle name in another language', () => {
    expect(searchCatalog('біцепс', 8).length).toBeGreaterThan(0);
  });
});
