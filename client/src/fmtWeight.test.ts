/** A working weight reads with the locale's own unit ("до 90.0 кг", not "до 90.0 kg" in uk). */
import { afterEach, describe, expect, it } from 'vitest';
import { LOCALE_IDS, LOCALES, getLocale, setLocale } from './i18n';
import { fmtWeightKg, fmtWeightValue } from './fmtWeight';

const start = getLocale();
afterEach(() => setLocale(start));

describe('fmtWeightKg', () => {
  it('keeps one decimal', () => {
    expect(fmtWeightValue(90)).toBe('90.0');
  });
  it.each(LOCALE_IDS)('%s: uses the locale unit', (id) => {
    setLocale(id);
    expect(fmtWeightKg(90)).toBe(`90.0 ${LOCALES[id].kgCol.toLowerCase()}`);
  });
  it('uk says кг', () => {
    setLocale('uk');
    expect(fmtWeightKg(90)).toBe('90.0 кг');
  });
});
