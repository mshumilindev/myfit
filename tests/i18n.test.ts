import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { setOverrideUid } from '../client/src/accountOverrides';
import {
  LOCALES,
  LOCALE_IDS,
  fmtClock,
  fmtDayMonth,
  fmtMonthYear,
  fmtBodyWeightKg,
  fmtDurationHM,
  fmtDurationHuman,
  fmtFullDate,
  fmtKg,
  fmtSessionClock,
  fmtSet,
  fmtSetSnack,
  fmtShortDate,
  fmtTonnes,
  fmtWeekday,
  fmtWeekdayDayMonth,
  setLocale,
  getLocale,
  t,
  useT,
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

function callEveryFunction(value: unknown, key = ''): void {
  if (typeof value === 'function') {
    if (key === 'nuDontSuggestSub') {
      const result = value(['Run', 'Sauna']);
      expect(typeof result).toBe('string');
      expect(result).toContain('Run');
      expect(result).toContain('Sauna');
      return;
    }
    if (key === 'atlasOffWarn') {
      for (const temper of [0, 1, 2]) {
        for (const warning of [1, 2, 3]) {
          const result = value(warning, temper, '12:30');
          expect(typeof result).toBe('string');
          expect(result).toBeTruthy();
          if (warning === 3) expect(result).toContain('12:30');
        }
      }
      return;
    }
    try {
      expect(value(2, 'Squat', '31 July', 'reason')).toBeTruthy();
    } catch {
      // Some helpers take a string first (e.g. noItemHere(item)).
      expect(value('Barbell', 2, 'Squat', '31 July')).toBeTruthy();
    }
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [nestedKey, nested] of Object.entries(value)) callEveryFunction(nested, nestedKey);
}

describe('F-02 i18n', () => {
  it('reacts to account-specific names without changing shared dictionaries', () => {
    const { result, unmount } = renderHook(() => useT());
    try {
      act(() => setOverrideUid('dec4b283-ecd4-4e56-8f14-0a5da352f1a2'));
      expect(result.current.t.actType.badminton).toBe('Table badminton');
      expect(t()).toBe(result.current.t);
      expect(LOCALES.en.actType.badminton).toBe('Badminton');
      act(() => setLocale('uk'));
      expect(result.current.t.actType.badminton).toBe('Настільний бадмінтон');
      act(() => setOverrideUid(null));
      expect(result.current.t).toBe(LOCALES.uk);
    } finally {
      unmount();
      setOverrideUid(null);
    }
  });

  it('formats calendar month headings in the selected locale', () => {
    const september = new Date(2026, 8, 15, 12).getTime();
    expect(fmtMonthYear(september, 'en')).toBe('September 2026');
    expect(fmtMonthYear(september, 'uk')).toContain('Вересень');
    expect(fmtMonthYear(september, 'uk')).toContain('2026');
  });

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
    expect(fmtBodyWeightKg(100.8)).toBe('100.8 kg');
    expect(fmtTonnes(2100)).toBe('2.1 t');
    expect(fmtSet(85, 8)).toBe('85 × 8');
    expect(fmtSetSnack(8, 80)).toBe('8 × 80 kg');
  });

  it('formats weekday kickers used by Today and template rows', () => {
    // 2026-07-31 is a Friday; noon UTC keeps the weekday stable across TZs.
    const friday = Date.UTC(2026, 6, 31, 12, 0);

    setLocale('en');
    expect(fmtWeekday(friday, 'en')).toBe('Friday');
    expect(fmtWeekdayDayMonth(friday, 'en')).toBe('Friday, July 31');

    // Locale-aware: the Ukrainian weekday is a non-empty, different string.
    const uk = fmtWeekday(friday, 'uk');
    expect(uk).toBeTruthy();
    expect(uk).not.toBe('Friday');
    expect(fmtWeekdayDayMonth(friday, 'uk')).toContain('липня');
  });
});
