import { describe, expect, it } from 'vitest';
import { NEW_TOPICS_TESTS } from './kb/testsNew';
import { score } from './kbScore';

describe('understanding — held-out phrasings (never used for matching)', () => {
  it(
    'newer, narrower topics (bench arch, chalk, Smith…) — deliberately tricky wording',
    { timeout: 120_000 },
    () => {
      const r = score(NEW_TOPICS_TESTS);
      expect(r.ok).toBeGreaterThan(0.7);
      expect(r.known).toBeGreaterThan(0.72);
    },
  );
});
