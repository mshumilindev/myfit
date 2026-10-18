import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setLocale, type LocaleId } from '../i18n';
import { useTw } from './strings';

const LOCALES: LocaleId[] = ['en', 'uk', 'pl', 'lt', 'et'];

afterEach(() => act(() => setLocale('en')));

describe('useTw', () => {
  it('returns the dictionary of the active locale and follows a locale switch', () => {
    const { result } = renderHook(() => useTw());
    act(() => setLocale('en'));
    expect(result.current.logSleep).toBe('Log sleep');
    act(() => setLocale('et'));
    expect(result.current.openApex).toBe('Ava Apex');
    act(() => setLocale('uk'));
    expect(result.current.groups.training).toBe('Тренування');
  });

  it('every locale has the same keys and the same group ids as English', () => {
    const shape = LOCALES.map((l) => {
      act(() => setLocale(l));
      const { result } = renderHook(() => useTw());
      return {
        keys: Object.keys(result.current).sort(),
        groups: Object.keys(result.current.groups).sort(),
      };
    });
    for (const s of shape.slice(1)) {
      expect(s.keys).toEqual(shape[0].keys);
      expect(s.groups).toEqual(shape[0].groups);
    }
  });

  it('plural/interpolating functions embed their argument in every locale', () => {
    for (const l of LOCALES) {
      act(() => setLocale(l));
      const { result } = renderHook(() => useTw());
      expect(result.current.recovering(3)).toContain('3');
      expect(result.current.readyPct(87)).toContain('87');
      expect(result.current.dayStreak(12)).toContain('12');
      expect(result.current.avg7('7h 05m')).toContain('7h 05m');
      expect(result.current.slept('6h')).toContain('6h');
      expect(result.current.weekDelta('+0.4')).toContain('+0.4');
      expect(result.current.vsAvg('+5%')).toContain('+5%');
      expect(result.current.volumeWeek('12.5')).toContain('12.5');
    }
  });
});
