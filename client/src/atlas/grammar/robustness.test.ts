import { describe, expect, it } from 'vitest';
import { CORPUS } from '../eval/corpus';
import { analyze, focus } from './index';

/** Never throw, always return a well-formed analysis — on the whole Atlas exam corpus and edge cases. */
const EDGE = [
  '',
  '   ',
  '???',
  '💪💪💪',
  '5км',
  '3x10 100kg',
  'а',
  'I',
  'lol) ну ок',
  'ok. so. what now?',
  "з'їв 2 банани і п’ю каву",
  'vchora ne trenuvavsia a sohodni vzhe mozhna?',
  'squat squat squat squat squat squat squat squat squat squat squat squat squat squat squat',
  'Mul on vaja 2 liitrit vett. Kas see on palju?',
  'Man reikia 8 valandų miego!',
  'https://example.com is my plan',
  'a'.repeat(300),
  'чи чи чи',
  'if if if when because',
];

describe('robustness', () => {
  it(`analyses all ${CORPUS.length} Atlas exam messages without errors`, () => {
    for (const c of CORPUS) {
      const a = analyze(c.q);
      expect(a.sentences.length).toBeGreaterThanOrEqual(/[\p{L}\d]/u.test(c.q) ? 1 : 0);
      for (const s of a.sentences) {
        expect(s.clauses.length).toBeGreaterThan(0);
        expect(s.clauses[s.mainClause]).toBeDefined();
      }
      focus(a);
    }
  });
  it.each(EDGE)('edge case %j', (text) => {
    const a = analyze(text);
    expect(Array.isArray(a.sentences)).toBe(true);
    expect(() => focus(a)).not.toThrow();
  });
});
