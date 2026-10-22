import { describe, expect, it } from 'vitest';
import { KB_FRESH } from './kb/fresh';
import { score } from './kbScore';

describe('understanding — held-out phrasings (never used for matching)', () => {
  it('a second set written blind, ~1,860 questions over every topic', { timeout: 300_000 }, () => {
    const r = score(KB_FRESH);
    expect(r.ok).toBeGreaterThan(0.81);
    expect(r.known).toBeGreaterThan(0.83);
  });
});
