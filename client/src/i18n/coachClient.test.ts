import { describe, expect, it } from 'vitest';
import { LOCALE_IDS } from './index';
import { CLIENT_LOCALES } from './coachClient';
import { clientEn } from './coachClient.en';

type Dict = Record<string, unknown>;

describe('client trainer dictionary', () => {
  it('registers all five locales', () => {
    expect(Object.keys(CLIENT_LOCALES).sort()).toEqual([...LOCALE_IDS].sort());
  });
  it.each(LOCALE_IDS)('%s has every key, same kind as en, no empty text', (id) => {
    const dict = CLIENT_LOCALES[id] as unknown as Dict;
    expect(Object.keys(dict).sort()).toEqual(Object.keys(clientEn).sort());
    for (const [k, v] of Object.entries(dict)) {
      expect(typeof v, k).toBe(typeof (clientEn as Dict)[k]);
      if (typeof v === 'string') expect(v.trim(), k).not.toBe('');
    }
  });
  it.each(LOCALE_IDS)('%s functions return text carrying their argument', (id) => {
    const dict = CLIENT_LOCALES[id] as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(dict)) {
      if (typeof v !== 'function') continue;
      const en = (clientEn as Record<string, unknown>)[k] as (a: never) => string;
      const numeric = /\{n\}|\$\{n\}/.test(String(en)) || /\(n[,)]/.test(String(en));
      const fn = v as (a: unknown) => string;
      if (numeric) {
        for (const n of [0, 1, 2, 5, 21, 22, 25]) {
          const out = fn(n);
          expect(typeof out, k).toBe('string');
          expect(out, `${k}(${n})`).toContain(String(n));
          expect(out, `${k}(${n})`).not.toContain('{n}');
        }
      } else {
        const out = fn('Oleh');
        expect(typeof out, k).toBe('string');
        expect(out.trim(), k).not.toBe('');
      }
    }
  });
});
