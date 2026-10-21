import { describe, expect, it } from 'vitest';
import { KB_TESTS } from './kb/tests';
import { score } from './kbScore';

describe('understanding — held-out phrasings (never used for matching)', () => {
  it('gets most of ~1,350 unseen questions right, en + uk', { timeout: 300_000 }, () => {
    const r = score(KB_TESTS);
    // Right answer, or an honest "did you mean…" — never below these.
    expect(r.ok).toBeGreaterThan(0.75);
    expect(r.known).toBeGreaterThan(0.8);
  });
});
