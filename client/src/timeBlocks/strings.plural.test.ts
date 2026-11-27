import { describe, expect, it } from 'vitest';
import type { LocaleId } from '../i18n';
import { STRINGS } from './strings';

const tbStrings = (l: LocaleId) => STRINGS[l];

describe('time block strings: plural forms', () => {
  it('declines blocks and rounds by CLDR category', () => {
    expect(tbStrings('en').conditioningLine(1, 7, 1)).toBe('1 block · 7 min · 1 round');
    expect(tbStrings('en').conditioningLine(3, 7, 5)).toBe('3 blocks · 7 min · 5 rounds');
    expect(tbStrings('uk').conditioningLine(3, 7, 5)).toBe('3 блоки · 7 хв · 5 раундів');
    expect(tbStrings('uk').summaryRounds(2, 0)).toBe('2 раунди');
    expect(tbStrings('pl').conditioningLine(3, 7, 5)).toBe('3 bloki · 7 min · 5 rund');
    expect(tbStrings('lt').summaryRounds(3, 0)).toBe('3 ratai');
    expect(tbStrings('lt').conditioningLine(1, 7, 10)).toBe('1 blokas · 7 min · 10 ratų');
    expect(tbStrings('et').summaryRounds(1, 2)).toBe('1 ring + 2');
  });

  it('every locale returns text for every count', () => {
    for (const l of Object.keys(STRINGS) as LocaleId[])
      for (const n of [0, 1, 2, 5, 11, 21]) expect(tbStrings(l).targetN(n)).toContain(String(n));
  });
});
