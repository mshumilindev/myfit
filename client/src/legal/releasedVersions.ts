/**
 * Every released version of each legal document, oldest first. THE source of versions: the current one is the newest
 * (`LEGAL_VERSIONS`). Add a version when a text changes materially: everyone who granted an older one is then asked
 * again (`isStale`). Several kinds share a document, so versions are keyed by document. The server keeps its own copy
 * (`functions/src/consentRecordsPure.ts`, functions cannot import client code); `tests/consentRecords.server.test.ts`
 * fails when the two differ.
 */
export const RELEASED_VERSIONS = {
  terms: ['2026-10-21'],
  policy: ['2026-10-21', '2026-10-28', '2026-10-30', '2026-10-31'],
  age: ['2026-10-21'],
  health: ['2026-10-21'],
  'atlas-ai': ['2026-10-21', '2026-10-22'],
  'atlas-puter': ['2026-10-21', '2026-10-22'],
  'atlas-history': ['2026-10-28'],
  'geo-search': ['2026-10-21', '2026-10-22', '2026-10-27'],
  'trainer-terms': ['2026-10-21', '2026-10-22'],
} as const satisfies Record<string, readonly string[]>;
export type LegalDoc = keyof typeof RELEASED_VERSIONS;
