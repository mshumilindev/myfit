import { describe, expect, it } from 'vitest';
import { answerLocally } from './intents';
import { KB_TESTS_OTHER } from './kb/testsOther';
import { richCtx } from './testCtx';

describe('Polish, Lithuanian, Estonian — held out', () => {
  it(
    'each language above 70% right on questions never used for matching',
    { timeout: 300_000 },
    () => {
      for (const l of ['pl', 'lt', 'et'] as const) {
        let ok = 0;
        let total = 0;
        for (const [id, e] of Object.entries(KB_TESTS_OTHER))
          for (const q of e[l]) {
            total++;
            // The chat runs these in English with placeholders, then translates (translate.ts).
            if (answerLocally(q, richCtx('en'))?.intent === id) ok++;
          }
        expect(ok / total).toBeGreaterThan(0.7);
      }
    },
  );
});
