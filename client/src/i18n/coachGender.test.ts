import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Coach copy never assumes the gender of the person it talks about or to (Polish and Ukrainian
 * verbs and adjectives agree in gender): no "(-a)" / "(-aś)" / "(-ла)" slash forms, no
 * "-łeś" / "-łaś" second-person past tense, no "-łem" / "-łam" first-person past tense.
 */
const files = (lang: string) =>
  readdirSync(__dirname).filter(
    (f) => /^(coach|cyc|sup)\w*\./.test(f) && f.endsWith(`.${lang}.ts`),
  );

const END = '(?![a-ząćęłńóśźż])';
const PL = [
  new RegExp(`[a-ząćęłńóśźż]łeś${END}`),
  new RegExp(`[a-ząćęłńóśźż]łaś${END}`),
  /[a-ząćęłńóśźż]\(-?(a|am|ła|aś|ęła)\)/,
  new RegExp(`[a-ząćęłńóśźż](łem|łam)${END}`),
  /jego\/jej/,
];
const UK = [/\w\(-?(а|ла|лась)\)/u, /\w\((ла|лась)\)/u];

describe('coach copy is gender-neutral', () => {
  it.each(files('pl'))('%s (pl)', (f) => {
    // "sygnałem" is a noun (instrumental), not a verb
    const text = readFileSync(join(__dirname, f), 'utf8').replace(/sygnałem/g, 'sygnalem');
    for (const re of PL) expect(text.match(re)?.[0], `${f} ${re}`).toBeUndefined();
  });
  it.each(files('uk'))('%s (uk)', (f) => {
    const text = readFileSync(join(__dirname, f), 'utf8');
    for (const re of UK) expect(text.match(re)?.[0], `${f} ${re}`).toBeUndefined();
  });
});
