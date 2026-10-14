import { describe, expect, it } from 'vitest';
import { LOCALE_IDS } from './index';
import { C360_LOCALES } from './coachClient360';
import { c360En } from './coachClient360.en';

describe('client 360 dictionary', () => {
  it('registers all five locales', () => {
    expect(Object.keys(C360_LOCALES).sort()).toEqual([...LOCALE_IDS].sort());
  });
  it.each(LOCALE_IDS)('%s has every key, same kind as en, no empty text', (id) => {
    const dict = C360_LOCALES[id] as Record<string, unknown>;
    expect(Object.keys(dict).sort()).toEqual(Object.keys(c360En).sort());
    for (const [k, v] of Object.entries(dict)) {
      const en = (c360En as Record<string, unknown>)[k];
      expect(typeof v, k).toBe(typeof en);
      if (typeof v === 'string') expect(v.trim(), k).not.toBe('');
      if (v && typeof v === 'object') {
        expect(Object.keys(v).sort(), k).toEqual(Object.keys(en as object).sort());
      }
    }
  });
  it.each(LOCALE_IDS)('%s counts carry the number', (id) => {
    const c = C360_LOCALES[id];
    for (const n of [0, 1, 2, 5, 21, 41]) {
      expect(c.wkSetsN(n)).toContain(String(n));
      expect(c.exRows(n)).toContain(String(n));
      expect(c.wkSessionsIn(n, 12)).toContain(String(n));
    }
  });
});
