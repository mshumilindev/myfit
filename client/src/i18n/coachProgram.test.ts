import { describe, expect, it } from 'vitest';
import { LOCALE_IDS } from './index';
import { PG_LOCALES } from './coachProgram';
import { pgEn } from './coachProgram.en';

const KEYS = Object.keys(pgEn) as (keyof typeof pgEn)[];

/** Calls every function key with plausible args and returns the strings. */
function sample(d: (typeof PG_LOCALES)['en']): string[] {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'function') {
      const f = v as (...a: unknown[]) => unknown;
      for (const n of [0, 1, 2, 5, 11, 21])
        walk(
          f(...Array.from({ length: f.length }, (_, i) => (i === 0 ? n : i === 1 ? 'Name' : n))),
        );
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(d);
  return out;
}

describe('program dictionary', () => {
  it('registers all five locales', () => {
    expect(Object.keys(PG_LOCALES).sort()).toEqual([...LOCALE_IDS].sort());
  });

  it.each(LOCALE_IDS)('%s has every key with the same shape as en', (id) => {
    const dict = PG_LOCALES[id];
    expect(Object.keys(dict).sort()).toEqual([...KEYS].sort());
    const shape = (v: unknown): unknown =>
      typeof v === 'function'
        ? 'fn'
        : v && typeof v === 'object'
          ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)]))
          : typeof v;
    for (const k of KEYS) expect(shape(dict[k]), `${id}.${k}`).toEqual(shape(pgEn[k]));
  });

  it.each(LOCALE_IDS)('%s: no unfilled placeholders', (id) => {
    for (const s of sample(PG_LOCALES[id])) {
      expect(s).not.toMatch(/\{n\}|undefined|NaN|\[object/);
    }
  });

  it.each(LOCALE_IDS.filter((l) => l !== 'en'))('%s: translated, not copied', (id) => {
    const d = PG_LOCALES[id];
    for (const k of [
      'edTitle',
      'ckTitle',
      'edSaveDraft',
      'ckFixInEditor',
      'edAddExercise',
    ] as const)
      expect(d[k], `${id}.${k}`).not.toBe(pgEn[k]);
  });

  it('weekday letters are the two-letter set in every locale', () => {
    for (const id of LOCALE_IDS) expect(Object.keys(PG_LOCALES[id].dowTwo)).toHaveLength(7);
  });

  it('plural forms agree with the count', () => {
    expect(pgEn.ckBareTitle(1)).toBe('1 exercise has no set targets');
    expect(pgEn.ckBareTitle(3)).toBe('3 exercises have no set targets');
    expect(PG_LOCALES.uk.edActivityN(2)).toBe('2 активності');
    expect(PG_LOCALES.uk.edActivityN(5)).toBe('5 активностей');
    expect(PG_LOCALES.pl.edActivityN(22)).toBe('22 aktywności');
  });
});
