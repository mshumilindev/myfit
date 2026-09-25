/**
 * Atlas knowledge base — per topic (intent id):
 *  - ex / exUk: real ways people ask it (English / Ukrainian incl. colloquial
 *    and surzhyk) — the retrieval layer matches questions against these, so a
 *    question doesn't have to hit exact keywords;
 *  - facets: the answer by question type ("why…", "how…", "when…"),
 *    used when the question asks that specifically;
 *  - test / testUk: held-out phrasings — NOT used for matching, only by tests
 *    to measure understanding honestly.
 */
export type Facet = 'why' | 'how' | 'when' | 'howMuch' | 'should' | 'what' | 'who' | 'where';

export interface KbEntry {
  ex: string[];
  exUk: string[];
  facets?: Partial<Record<Facet, [string, string]>>;
  /** Held-out phrasings live in tests.ts — never here. */
  test?: string[];
  testUk?: string[];
}

export type Kb = Record<string, KbEntry>;
