/**
 * The understanding exam (corpus.ts): prints accuracy, the wrong-confident
 * rate, precision at CONFIDENT and every confusion — per language, for the
 * grammar-heavy messages, for the held-out quarter and for the messages the
 * base does not contain word for word — and guards the numbers reached so
 * far: they may only get better.
 *
 *   ATLAS_EVAL_OUT=/tmp/eval.txt npx vitest run src/atlas/eval   → the full report
 *   ATLAS_CALIB_OUT=/tmp/calib.jsonl …                           → features per answer,
 *     to refit the weights in confidence.ts (logistic regression on the rows
 *     with route "main", held-out rows excluded).
 *
 * Baseline (the engine before this exam existed, first corpus, same scoring):
 * accuracy 83.5%, wrong-confident 14.6% — every wrong answer was a confident
 * one (there was no confidence). Held-out: 81.7% / 16.7%.
 * Before the grammar layer (understand.ts), on this five-language corpus:
 * accuracy 92.1%, wrong-confident 1.9%; held-out 92.5% / 1.3%.
 * The blind set (corpusBlind.ts), written after that and scored once before the
 * next round of changes: 81.7%, 6 wrong-confident of 120 (et 90.0, lt 85.0,
 * pl 70.0, grammar-hard en/uk 77.5). Its later numbers are no longer blind.
 * The second blind set (corpusBlind2.ts, 400 messages incl. 50 multi-turn
 * follow-ups), scored once before the round after it: 91.5%, 9 wrong-confident,
 * coverage@confident 79.0% (see its header). After that round: 99.5%, none
 * wrong-confident, coverage 89.0% — no longer blind either.
 */
import { describe as suite, expect, it } from 'vitest';
import { ALL_INTENTS, CONFIDENT } from '../intents';
import { features } from '../confidence';
import { KB } from '../kb';
import { normalize } from '../nlu';
import {
  CORPUS,
  CORPUS_EN,
  CORPUS_ET,
  CORPUS_GRAM,
  CORPUS_LT,
  CORPUS_MIX,
  CORPUS_PL,
  CORPUS_UK,
  HELD_OUT,
} from './corpus';
import { BLIND } from './corpusBlind';
import {
  BLIND2,
  BLIND2_EN,
  BLIND2_ET,
  BLIND2_FOLLOW,
  BLIND2_LT,
  BLIND2_MIX,
  BLIND2_PL,
  BLIND2_UK,
} from './corpusBlind2';
import { describe, evaluate, report } from './run';

type Env = { process?: { env: Record<string, string | undefined> } };
const env = (globalThis as Env).process?.env ?? {};

async function write(path: string, text: string): Promise<void> {
  const fs = (await import(/* @vite-ignore */ String('node:fs'))) as {
    writeFileSync: (path: string, text: string) => void;
  };
  fs.writeFileSync(path, text);
}

/** Messages the base knows word for word — the rest show how far understanding reaches. */
const byHeart = new Set(
  Object.values(KB).flatMap((e) => [...e.ex, ...e.exUk].map((x) => normalize(x))),
);
const NOVEL = CORPUS.filter((c) => !byHeart.has(normalize(c.q)));

suite('understanding exam', () => {
  it('corpus covers every app language and the grammar-heavy messages', () => {
    expect(CORPUS.length).toBeGreaterThanOrEqual(2400);
    expect(CORPUS_EN.length).toBeGreaterThanOrEqual(700);
    expect(CORPUS_UK.length + CORPUS_MIX.length).toBeGreaterThanOrEqual(700);
    for (const lang of [CORPUS_PL, CORPUS_LT, CORPUS_ET])
      expect(lang.length).toBeGreaterThanOrEqual(250);
    expect(CORPUS_GRAM.length).toBeGreaterThanOrEqual(150);
    // Every message is new to the base or not — but most must be new.
    expect(NOVEL.length / CORPUS.length).toBeGreaterThan(0.6);
  });

  it('scores — and never slides back', async () => {
    const all = evaluate(CORPUS);
    const part = (cs: typeof CORPUS) => report(all.rows.filter((r) => cs.includes(r.c)));
    const held = part(HELD_OUT);
    const novel = part(NOVEL);
    const blind = evaluate(BLIND);
    const blind2 = evaluate(BLIND2);
    const part2 = (cs: typeof BLIND2) => report(blind2.rows.filter((r) => cs.includes(r.c)));
    const text = [
      describe(all, 'ALL'),
      describe(part(CORPUS_EN), 'EN'),
      describe(part(CORPUS_UK), 'UK'),
      describe(part(CORPUS_MIX), 'MIX'),
      describe(part(CORPUS_PL), 'PL'),
      describe(part(CORPUS_LT), 'LT'),
      describe(part(CORPUS_ET), 'ET'),
      describe(part(CORPUS_GRAM), 'GRAMMAR'),
      describe(novel, 'NOVEL (not in the base word for word)'),
      describe(held, 'HELD-OUT (never tuned on)'),
      describe(blind, 'BLIND (corpusBlind.ts)'),
      describe(blind2, 'BLIND 2 (corpusBlind2.ts)'),
      ...(
        [
          [BLIND2_EN, 'en'],
          [BLIND2_UK, 'uk'],
          [BLIND2_MIX, 'mix'],
          [BLIND2_PL, 'pl'],
          [BLIND2_LT, 'lt'],
          [BLIND2_ET, 'et'],
          [BLIND2_FOLLOW, 'follow-ups'],
        ] as const
      ).map(([cs, name]) => describe(part2(cs), `BLIND 2 ${name}`).split('\n')[0]),
    ].join('\n\n');
    if (env.ATLAS_EVAL_OUT) await write(env.ATLAS_EVAL_OUT, text);
    if (env.ATLAS_CALIB_OUT) {
      const rows = all.rows.map((r) =>
        JSON.stringify({
          q: r.c.q,
          got: r.got,
          ok: r.ok,
          answered: r.answered,
          conf: r.confidence,
          route: r.route ?? 'none',
          test: HELD_OUT.includes(r.c),
          ...features(
            r.c.q,
            ALL_INTENTS().find((x) => x.id === r.got),
            ALL_INTENTS(),
          ),
        }),
      );
      await write(env.ATLAS_CALIB_OUT, rows.join('\n'));
    }
    console.log(text.split('\n')[0]);

    // Where the engine stands now (the report lists what it still gets wrong).
    // With the grammar layer switched off (understand.ts __grammarOff) the same
    // exam gives 95.5% / wrong-confident 0.6%; held-out 94.3% / 0.8%.
    expect(all.accuracy).toBeGreaterThanOrEqual(0.978);
    expect(all.wrongAnswered).toBeLessThanOrEqual(0.021);
    // Never sure and wrong: where the readings disagree, confidence is capped.
    expect(all.wrongConfident).toBe(0);
    expect(all.precisionAtConfident).toBe(1);
    // Answered for sure (no bigger model needed): 83% before the clear-lead
    // rule, topic families and follow-up readings (confidence.ts, topicFamily.ts).
    expect(all.coverageAtConfident).toBeGreaterThanOrEqual(0.885);
    expect(held.coverageAtConfident).toBeGreaterThanOrEqual(0.86);
    for (const lang of [CORPUS_EN, CORPUS_UK, CORPUS_PL, CORPUS_LT, CORPUS_ET])
      expect(part(lang).accuracy).toBeGreaterThanOrEqual(0.97);
    expect(part(CORPUS_GRAM).accuracy).toBeGreaterThanOrEqual(0.93);
    expect(held.accuracy).toBeGreaterThanOrEqual(0.97);
    expect(held.wrongConfident).toBe(0);
    expect(novel.accuracy).toBeGreaterThanOrEqual(0.975);
    expect(blind.accuracy).toBeGreaterThanOrEqual(0.975);
    expect(blind.wrongConfident).toBe(0);
    expect(blind2.accuracy).toBeGreaterThanOrEqual(0.99);
    expect(blind2.wrongConfident).toBe(0);
    expect(blind2.coverageAtConfident).toBeGreaterThanOrEqual(0.885);
    expect(part2(BLIND2_FOLLOW).accuracy).toBeGreaterThanOrEqual(0.98);
    expect(CONFIDENT).toBe(0.75);
  }, 600_000);
});
