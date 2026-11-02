/**
 * SPO-35: typo repair for the words a log question hangs on ("wieght", "lsat", "pullps", "tiem").
 * Only a small vocabulary is repaired, so ordinary words are never "corrected" into something else:
 * a longer word within one edit (two from 8 letters), a four-letter word only when it is the same letters swapped.
 */
import { editDistance } from './nlu';

const VOCAB = [
  'weight',
  'heaviest',
  'latest',
  'previous',
  'recently',
  'repetitions',
  'record',
  'pullups',
  'pullup',
  'chinups',
  'deadlift',
  'squats',
  'bench',
  'press',
  'last',
  'time',
  'reps',
  'sets',
  'squat',
];
// Real words that sit one edit away from an anchor ("lats"→"last", "least"→"last") — never "repaired".
const REAL_WORDS = new Set([
  'lats',
  'lat',
  'least',
  'slat',
  'salt',
  'sets',
  'rest',
  'rows',
  'reps',
]);

const sameLetters = (a: string, b: string) => [...a].sort().join('') === [...b].sort().join('');

/** The question with misspelt anchor words fixed (other words untouched). */
export function repairTypos(text: string): string {
  return text
    .replace(
      /\b(pul|pull|chin)\s?-?\s?ups?\b/giu,
      (m, p) =>
        `${p.toLowerCase().startsWith('chin') ? 'chinup' : 'pullup'}${/s$/i.test(m) ? 's' : ''}`,
    )
    .replace(/\bhowmany\b/giu, 'how many')
    .replace(/\bbench\s?press\b/giu, 'bench press')
    .replace(/[a-z]{4,}/giu, (w) => {
      const lw = w.toLowerCase();
      // (a real word that merely extends or shortens an anchor — weigh, times, pressed — is left alone)
      if (REAL_WORDS.has(lw)) return w;
      if (VOCAB.some((v) => lw.startsWith(v) || v.startsWith(lw))) return w;
      const best = VOCAB.find((v) => {
        if (Math.abs(v.length - lw.length) > 1) return false;
        if (lw.length === 4) return sameLetters(lw, v);
        return editDistance(lw, v, lw.length >= 8 ? 2 : 1) <= (lw.length >= 8 ? 2 : 1);
      });
      return best ?? w;
    });
}
