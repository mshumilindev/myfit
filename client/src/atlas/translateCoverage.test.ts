import { describe, expect, it } from 'vitest';
import { answerLocally, type Convo } from './intents';
import { richCtx } from './testCtx';
import { neutralDates } from './dateWords';
import { markFmt, setDict, untranslated, type OtherLocale } from './translate';
import { BLIND2_EN } from './eval/corpusBlind2';
import { CONV_CASES } from './eval/corpusConv';
import { HELD_OUT } from './eval/corpus';

// SPO-35 P13: every sentence Atlas can say in these exams exists in the pl / lt / et dictionaries,
// so a new answer cannot ship in English to a Polish, Lithuanian or Estonian user.
describe('Atlas sentences are in the pl / lt / et dictionaries', () => {
  it.each(['pl', 'lt', 'et'] as const)(
    '%s',
    async (loc: OtherLocale) => {
      const { DICT } = await import(`../i18n/atlasDict.${loc}.ts`);
      setDict(loc, DICT);
      const c0 = richCtx(loc);
      const c = { ...c0, fmt: markFmt(c0.fmt) };
      const missing = new Set<string>();
      const note = (text: string | undefined) => {
        for (const k of untranslated(text ?? '', loc)) missing.add(k);
      };
      for (const k of [...HELD_OUT, ...BLIND2_EN]) note(answerLocally(k.q, c)?.text);
      for (const k of CONV_CASES) {
        let convo: Convo = {};
        for (const q of k.turns) {
          const a = answerLocally(q, c, convo);
          if (a) convo = a.convo;
          note(a?.text);
        }
      }
      expect([...missing], 'add these to src/i18n/atlasDict.' + loc + '.ts').toEqual([]);
    },
    120_000,
  );
});

describe('weekday and month names stay as written, whatever the day', () => {
  it('become placeholders', () => {
    expect(neutralDates('You train most on niedziela, poniedziałek.', 'pl')).toBe(
      'You train most on ⟦Z:niedziela⟧, ⟦Z:poniedziałek⟧.',
    );
    expect(neutralDates('Last weigh-in on 23 wrz.', 'pl')).toContain('⟦Z:wrz⟧');
    // "lip" is only a month right after a number
    expect(neutralDates('Split the lip.', 'pl')).toBe('Split the lip.');
  });
});
