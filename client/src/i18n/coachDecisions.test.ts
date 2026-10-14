import { describe, expect, it } from 'vitest';
import { LOCALE_IDS } from './index';
import { DECISIONS_LOCALES } from './coachDecisions';
import { decisionsEn } from './coachDecisions.en';

describe('decisions dictionary', () => {
  it('registers all five locales', () => {
    expect(Object.keys(DECISIONS_LOCALES).sort()).toEqual([...LOCALE_IDS].sort());
  });
  it.each(LOCALE_IDS)('%s has every key, same kind as en, no empty text', (id) => {
    const dict = DECISIONS_LOCALES[id];
    expect(Object.keys(dict).sort()).toEqual(Object.keys(decisionsEn).sort());
    for (const [k, v] of Object.entries(dict)) {
      expect(typeof v, k).toBe(typeof (decisionsEn as Record<string, unknown>)[k]);
      if (typeof v === 'string') expect(v.trim(), k).not.toBe('');
    }
    for (const n of [0, 1, 2, 5, 21]) expect(dict.dcCount(n)).toContain(String(n));
  });
});
