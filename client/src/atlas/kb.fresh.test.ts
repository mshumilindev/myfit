import { describe, expect, it, afterAll, beforeAll } from 'vitest';
import { addonsPref } from '../addons/enabledSet';
import { TOPIC_ADDON } from './addonTopics';
import { KB_FRESH } from './kb/fresh';
import { score } from './kbScore';

// The modules of Advanced training installed: the corpus asks about their topics too.
beforeAll(() => addonsPref.set(Object.values(TOPIC_ADDON)));
afterAll(() => addonsPref.reset());

describe('understanding — held-out phrasings (never used for matching)', () => {
  it('a second set written blind, ~1,860 questions over every topic', { timeout: 300_000 }, () => {
    const r = score(KB_FRESH);
    expect(r.ok).toBeGreaterThan(0.81);
    expect(r.known).toBeGreaterThan(0.83);
  });
});
