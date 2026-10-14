import { describe, expect, it } from 'vitest';
import { LOCALE_IDS } from './index';
import { ROSTER_LOCALES, rosterStrings } from './coachRoster';
import { rosterEn } from './coachRoster.en';

const KEYS = Object.keys(rosterEn) as (keyof typeof rosterEn)[];

/** Calls every function key with plausible args and returns the strings. */
function sample(d: (typeof ROSTER_LOCALES)['en']): string[] {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'function') {
      const f = v as (...a: unknown[]) => unknown;
      for (const n of [0, 1, 2, 5, 11, 21])
        walk(
          f(
            ...Array.from({ length: f.length }, (_, i) =>
              i === 0 && f.length === 1 ? n : i === 0 ? 'Name' : n,
            ),
          ),
        );
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(d);
  return out;
}

describe('roster dictionary', () => {
  it('registers all five locales', () => {
    expect(Object.keys(ROSTER_LOCALES).sort()).toEqual([...LOCALE_IDS].sort());
    expect(rosterStrings('en')).toBe(rosterEn);
  });

  it.each(LOCALE_IDS)('%s has every key with the same shape as en', (id) => {
    const dict = ROSTER_LOCALES[id];
    expect(Object.keys(dict).sort()).toEqual([...KEYS].sort());
    const shape = (v: unknown): unknown =>
      typeof v === 'function'
        ? 'fn'
        : Array.isArray(v)
          ? v.map(shape)
          : v && typeof v === 'object'
            ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)]))
            : typeof v;
    for (const k of KEYS) expect(shape(dict[k]), `${id}.${k}`).toEqual(shape(rosterEn[k]));
  });

  it.each(LOCALE_IDS)('%s: no empty, untrimmed or unfilled strings', (id) => {
    for (const s of sample(ROSTER_LOCALES[id])) {
      expect(s.length).toBeGreaterThan(0);
      expect(s).toBe(s.trim());
      expect(s).not.toMatch(/\{n\}|undefined|NaN/);
    }
  });

  it.each(LOCALE_IDS.filter((l) => l !== 'en'))('%s: translated, not copied', (id) => {
    const d = ROSTER_LOCALES[id];
    for (const k of ['roTitle', 'roInvite', 'sgTitle', 'ivSubmitProgram', 'c3RestDay'] as const)
      expect(d[k], `${id}.${k}`).not.toBe(rosterEn[k]);
  });

  it('the three consent levels and every category exist in all locales', () => {
    for (const id of LOCALE_IDS) {
      const d = ROSTER_LOCALES[id];
      expect(Object.keys(d.c3Level).sort()).toEqual(['effects', 'full', 'off']);
      expect(Object.keys(d.c3Cat)).toHaveLength(7);
      expect(Object.keys(d.c3Tabs)).toHaveLength(6);
    }
  });

  it('subtitle reconciles with the counts', () => {
    expect(rosterEn.roSubtitle(14, 5)).toBe('14 clients, 5 need attention');
    expect(rosterEn.roSubtitle(1, 1)).toBe('1 client, 1 needs attention');
  });
});
