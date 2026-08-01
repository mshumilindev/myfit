import { describe, expect, it } from 'vitest';
import {
  LOCALES,
  LOCALE_IDS,
  fmtClock,
  fmtDayMonth,
  fmtDurationHM,
  fmtDurationHuman,
  fmtFullDate,
  fmtKg,
  fmtSessionClock,
  fmtSet,
  fmtSetSnack,
  fmtShortDate,
  fmtTonnes,
  setLocale,
  getLocale,
  t,
} from '../client/src/i18n';

function walkShape(base: unknown, candidate: unknown, path: string[] = []): void {
  expect(typeof candidate, path.join('.')).toBe(typeof base);
  if (!base || typeof base !== 'object') return;
  for (const key of Object.keys(base as Record<string, unknown>)) {
    walkShape((base as Record<string, unknown>)[key], (candidate as Record<string, unknown>)[key], [
      ...path,
      key,
    ]);
  }
}

function callEveryFunction(value: unknown): void {
  if (typeof value === 'function') {
    expect(value(2, 'Squat', '31 July', 'reason')).toBeTruthy();
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const nested of Object.values(value)) callEveryFunction(nested);
}

describe('F-02 i18n', () => {
  it('keeps all locales structurally complete and callable', () => {
    for (const id of LOCALE_IDS) {
      walkShape(LOCALES.en, LOCALES[id]);
      callEveryFunction(LOCALES[id]);
    }
  });

  it('persists selected locale and formats domain values', () => {
    setLocale('uk');
    expect(getLocale()).toBe('uk');
    expect(t().locale).toBe('Українська');
    expect(localStorage.getItem('gym.locale')).toBe('uk');
    expect(document.documentElement.lang).toBe('uk');

    const ts = Date.UTC(2026, 6, 31, 9, 5);
    expect(fmtFullDate(ts)).toBeTruthy();
    expect(fmtDayMonth(ts)).toBeTruthy();
    expect(fmtShortDate(ts)).toBeTruthy();
    expect(fmtClock(ts)).toMatch(/^\d{2}:\d{2}$/);
    expect(fmtDurationHM(65 * 60000)).toBe('1:05');
    expect(fmtSessionClock(65_000)).toBe('1:05');
    expect(fmtDurationHuman(65 * 60000)).toBe('1h 5m');
    expect(fmtKg(4980)).toContain('kg');
    expect(fmtTonnes(2100)).toBe('2.1 t');
    expect(fmtSet(85, 8)).toBe('85 × 8');
    expect(fmtSetSnack(8, 80)).toBe('8 × 80 kg');
  });
});
