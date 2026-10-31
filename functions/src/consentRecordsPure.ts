/**
 * Legal consent records (SPO-296): strict input validation for `recordConsent`. Pure (no firebase-admin), so it is unit-testable.
 * Mirrors `client/src/legal/consents.ts`; `tests/consentRecords.server.test.ts` fails if the two drift.
 */

export const CONSENT_KINDS: readonly string[] = [
  'terms',
  'policy-ack',
  'age-18',
  'health:injuries',
  'health:chronic',
  'health:cycle',
  'health:nicotine',
  'health:alcohol',
  'health:supplements',
  'health:nutrition',
  'atlas-ai',
  'atlas-puter',
  'atlas-history',
  'geo-search',
  'trainer-terms',
];

export const VERSION_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Every released version of each legal document, oldest first. The server never trusts the client's idea of "current":
 * a `grant` must carry the newest entry (the max), a `withdraw` any released one. Add a version here (and in
 * `client/src/legal/consents.ts`, which `tests/consentRecords.server.test.ts` keeps in step) when a text changes.
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

/** Several kinds share one document (and so one version line). */
export function documentOf(kind: string): LegalDoc {
  if (kind === 'policy-ack') return 'policy';
  if (kind === 'age-18') return 'age';
  if (kind.startsWith('health:')) return 'health';
  return kind as LegalDoc;
}

export function releasedVersions(kind: string): readonly string[] {
  return RELEASED_VERSIONS[documentOf(kind)];
}

/** The newest released version of the kind's document. */
export function currentVersionOf(kind: string): string {
  return [...releasedVersions(kind)].sort().at(-1) as string;
}

/** Grants of these must carry the SHA-256 of the exact text shown (evidence of what was agreed). */
export const HASH_REQUIRED_KINDS: readonly string[] = ['terms', 'policy-ack', 'trainer-terms'];
const HASH_RE = /^[0-9a-f]{64}$/;
const LIST_MAX = 20;
const ITEM_RE = /^[a-z0-9][a-z0-9:_-]{0,63}$/;

export interface ConsentInput {
  kind: string;
  action: 'grant' | 'withdraw';
  version: string;
  textHash?: string;
  categories?: string[];
  engines?: string[];
}

export interface ConsentRecordDoc extends ConsentInput {
  id: string;
  at: number;
}

const ALLOWED = new Set(['kind', 'action', 'version', 'textHash', 'categories', 'engines']);

function list(v: unknown, field: string): string[] {
  if (!Array.isArray(v) || v.length > LIST_MAX) throw new Error(`bad-${field}`);
  const out = v.map((x) => {
    if (typeof x !== 'string' || !ITEM_RE.test(x)) throw new Error(`bad-${field}`);
    return x;
  });
  return [...new Set(out)];
}

/**
 * Throws `Error(<code>)` (`bad-input`, `bad-kind`, `bad-action`, `bad-version`, `stale-version`, `bad-textHash`,
 * `bad-categories`, `bad-engines`). A grant must be for the CURRENT version; a withdrawal for any released one.
 */
export function parseConsentInput(data: unknown): ConsentInput {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('bad-input');
  const d = data as Record<string, unknown>;
  for (const k of Object.keys(d)) if (!ALLOWED.has(k)) throw new Error('bad-input');
  if (typeof d.kind !== 'string' || !CONSENT_KINDS.includes(d.kind)) throw new Error('bad-kind');
  if (d.action !== 'grant' && d.action !== 'withdraw') throw new Error('bad-action');
  if (typeof d.version !== 'string' || !VERSION_RE.test(d.version)) throw new Error('bad-version');
  if (d.action === 'grant') {
    if (d.version !== currentVersionOf(d.kind)) throw new Error('stale-version');
  } else if (!releasedVersions(d.kind).includes(d.version)) throw new Error('bad-version');
  const out: ConsentInput = { kind: d.kind, action: d.action, version: d.version };
  if (d.textHash !== undefined) {
    if (typeof d.textHash !== 'string' || !HASH_RE.test(d.textHash))
      throw new Error('bad-textHash');
    out.textHash = d.textHash;
  }
  if (d.action === 'grant' && HASH_REQUIRED_KINDS.includes(d.kind) && !out.textHash)
    throw new Error('bad-textHash');
  if (d.categories !== undefined) out.categories = list(d.categories, 'categories');
  if (d.engines !== undefined) out.engines = list(d.engines, 'engines');
  return out;
}

/**
 * The stored doc. The id is time + random and carries NO kind (a health consent's existence must not show in a document
 * id); the kind lives inside the doc. `at` is the server time, strictly after the previous record of the same kind.
 */
export function buildConsentRecord(
  input: ConsentInput,
  at: number,
  rand: string,
): ConsentRecordDoc {
  return { id: `${at}-${rand}`, ...input, at };
}

const sameSet = (a: readonly string[] = [], b: readonly string[] = []) =>
  a.length === b.length && [...a].sort().join('\u0000') === [...b].sort().join('\u0000');

/** A write that would not change the person's standing: same action, version, categories and engines as the latest. */
export function isNoOp(
  latest: { action?: unknown; version?: unknown; categories?: string[]; engines?: string[] } | null,
  input: ConsentInput,
): boolean {
  return (
    !!latest &&
    latest.action === input.action &&
    latest.version === input.version &&
    sameSet(latest.categories, input.categories) &&
    sameSet(latest.engines, input.engines)
  );
}
