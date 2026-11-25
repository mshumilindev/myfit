import { describe, expect, it } from 'vitest';
import { STRINGS } from './strings';
import { LOCALE_IDS } from '../i18n';
import { CATALOG } from './catalog';
import { DAYS_BUCKETS, GEAR_TIERS, FACET_GROUPS, facetValues } from './filters';

const shape = (v: unknown): unknown =>
  typeof v === 'function'
    ? 'fn'
    : Array.isArray(v)
      ? v.map(shape)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)]))
        : 'str';

describe('Train like a pro strings', () => {
  it('all five locales have the same keys, and no value is empty', () => {
    const en = shape(STRINGS.en);
    for (const l of LOCALE_IDS) expect(shape(STRINGS[l])).toEqual(en);
    for (const l of LOCALE_IDS) {
      const walk = (v: unknown) => {
        if (typeof v === 'string') expect(v.trim()).not.toBe('');
        else if (typeof v === 'function')
          expect((v as (x: never) => string)(3 as never).trim()).not.toBe('');
        else if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === 'object') Object.values(v).forEach(walk);
      };
      walk(STRINGS[l]);
    }
  });

  it('every facet value of the catalog has a label in every locale', () => {
    for (const l of LOCALE_IDS) {
      const s = STRINGS[l];
      for (const e of CATALOG)
        for (const g of FACET_GROUPS) {
          const table = s[g === 'days' ? 'days' : g] as Record<string, string>;
          for (const v of facetValues(e, g)) expect(table[v], `${l} ${g} ${v}`).toBeTruthy();
        }
      for (const d of DAYS_BUCKETS) expect(s.days[d]).toBeTruthy();
      for (const t of GEAR_TIERS) expect(s.gear[t]).toBeTruthy();
      expect(s.weekdays).toHaveLength(7);
    }
  });
});
