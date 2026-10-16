/**
 * Translation length guard (SPO-28). The English strings come from the mock-ups; pl / lt / et (and uk) run 1.5-2.5x longer
 * and are what breaks chips, buttons, tabs and rows. This does not replace looking at a screen in every locale, but it
 * stops a NEW over-long label from landing unnoticed: add a string, and if it blows the budget below this test fails
 * with the key, the locale and the text, so the translation is shortened (or the component given room) before merge.
 *
 * Budgets (plain string entries only; functions and placeholder strings are skipped):
 *  1. Short labels (English 2..24 chars): the translation may be at most max(30, 2.2 x English) chars.
 *  2. No unbreakable word longer than 22 letters in a label of up to 40 chars (it cannot wrap and pushes the row wide).
 * Do NOT raise a budget or add an exemption to get green: shorten the translation (.claude/rules/tests.md).
 */
import { describe, expect, it } from 'vitest';
import { LOCALES, LOCALE_IDS, type LocaleId } from '../client/src/i18n';

function flat(o: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return out;
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[path] = v;
    else flat(v, path, out);
  }
  return out;
}

const SHORT_MAX_EN = 24;
const budget = (en: number) => Math.max(30, Math.ceil(en * 2.2));
const MAX_WORD = 22;
const LABEL_MAX = 40;
const longestWord = (s: string) =>
  Math.max(0, ...s.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, '').length));

const en = flat(LOCALES.en);
const others = LOCALE_IDS.filter((id): id is Exclude<LocaleId, 'en'> => id !== 'en');

describe('translation length budgets', () => {
  it('has strings to check (the guard is not vacuous)', () => {
    expect(Object.keys(en).length).toBeGreaterThan(1000);
  });

  for (const id of others) {
    const loc = flat(LOCALES[id]);

    it(`${id}: short labels stay within ${'max(30, 2.2 x English)'} chars`, () => {
      const over: string[] = [];
      for (const [key, base] of Object.entries(en)) {
        const v = loc[key];
        if (v == null || /[{}%]/.test(base)) continue;
        if (base.length < 2 || base.length > SHORT_MAX_EN) continue;
        if (v.length > budget(base.length)) {
          over.push(`${key} (${v.length} > ${budget(base.length)}): "${base}" -> "${v}"`);
        }
      }
      expect(over).toEqual([]);
    });

    it(`${id}: no unbreakable word over ${MAX_WORD} letters in a label`, () => {
      const bad = Object.entries(loc)
        .filter(([, v]) => v.length <= LABEL_MAX && longestWord(v) > MAX_WORD)
        .map(([k, v]) => `${k}: "${v}"`);
      expect(bad).toEqual([]);
    });
  }
});
