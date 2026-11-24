import { describe, expect, it, afterAll, beforeAll } from 'vitest';
import { addonsPref } from '../addons/enabledSet';
import { TOPIC_ADDON } from './addonTopics';
import { KB_TESTS } from './kb/tests';
import { score } from './kbScore';

// The modules of Advanced training installed: the corpus asks about their topics too.
beforeAll(() => addonsPref.set(Object.values(TOPIC_ADDON)));
afterAll(() => addonsPref.reset());

describe('understanding — held-out phrasings (never used for matching)', () => {
  it('gets most of ~1,350 unseen questions right, en + uk', { timeout: 300_000 }, () => {
    const r = score(KB_TESTS);
    // Right answer, or an honest "did you mean…" — never below these.
    expect(r.ok).toBeGreaterThan(0.75);
    expect(r.known).toBeGreaterThan(0.8);
  });
});
