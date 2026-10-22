/**
 * Legal consent model (SPO-296). Pure: no React, no Firestore.
 *
 * Records are append-only (`users/{uid}/consentRecords/{id}`, written by the `recordConsent` function only); the state of a
 * kind is its LATEST record. This is separate from `users/{uid}/consentLog`, which logs coaching-sharing category changes.
 * Server-side validation lives in `functions/src/consentRecordsPure.ts`; `tests/consentRecords.server.test.ts` keeps the
 * two kind lists and the version format in step.
 */

import {
  LEGAL_CHANGELOG,
  UPDATE_KIND,
  updateLevel,
  type LegalChangelogEntry,
  type UpdateDoc,
} from './changelog';

export const HEALTH_FEATURES = [
  'injuries',
  'chronic',
  'cycle',
  'nicotine',
  'alcohol',
  'supplements',
  'nutrition',
] as const;
export type HealthFeature = (typeof HEALTH_FEATURES)[number];

export type HealthConsentKind = `health:${HealthFeature}`;
export type ConsentKind =
  | 'terms'
  | 'policy-ack'
  | 'age-18'
  | HealthConsentKind
  | 'atlas-ai'
  | 'atlas-puter'
  | 'geo-search'
  | 'trainer-terms';

export const CONSENT_KINDS: readonly ConsentKind[] = [
  'terms',
  'policy-ack',
  'age-18',
  ...HEALTH_FEATURES.map((f): HealthConsentKind => `health:${f}`),
  'atlas-ai',
  'atlas-puter',
  'geo-search',
  'trainer-terms',
];

/** Withdrawing one of these means deleting the account; withdrawing any other kind only turns its feature off. */
export const REQUIRED_KINDS = [
  'terms',
  'policy-ack',
  'age-18',
] as const satisfies readonly ConsentKind[];

export type ConsentAction = 'grant' | 'withdraw';

export interface ConsentRecord {
  id: string;
  kind: ConsentKind;
  action: ConsentAction;
  /** Version of the text the person saw, `YYYY-MM-DD`. */
  version: string;
  /** SHA-256 hex of the exact text shown, when the caller has it. */
  textHash?: string;
  /** What the consent covered (e.g. data categories sent to an AI provider). */
  categories?: string[];
  /** Which engines/processors it covered (e.g. `gemini`). */
  engines?: string[];
  /** Server time, ms since epoch. */
  at: number;
}

/** `YYYY-MM-DD` */
export const VERSION_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Every released version of each legal document, oldest first. THE source of versions: the current one is the newest
 * (`LEGAL_VERSIONS`). Add a version when a text changes materially: everyone who granted an older one is then asked
 * again (`isStale`). Several kinds share a document, so versions are keyed by document. The server keeps its own copy
 * (`functions/src/consentRecordsPure.ts`, functions cannot import client code); `tests/consentRecords.server.test.ts`
 * fails when the two differ.
 */
export const RELEASED_VERSIONS = {
  terms: ['2026-10-21'],
  policy: ['2026-10-21'],
  age: ['2026-10-21'],
  health: ['2026-10-21'],
  'atlas-ai': ['2026-10-21', '2026-10-22'],
  'atlas-puter': ['2026-10-21', '2026-10-22'],
  'geo-search': ['2026-10-21', '2026-10-22'],
  'trainer-terms': ['2026-10-21', '2026-10-22'],
} as const satisfies Record<string, readonly string[]>;
export type LegalDoc = keyof typeof RELEASED_VERSIONS;

/** The current (newest released) version of each document. */
export const LEGAL_VERSIONS = Object.fromEntries(
  Object.entries(RELEASED_VERSIONS).map(([doc, vs]) => [doc, [...vs].sort().at(-1) as string]),
) as Record<LegalDoc, string>;

/** Grants of these must carry the SHA-256 hex of the exact text shown (the server refuses them otherwise). */
export const HASH_REQUIRED_KINDS: readonly ConsentKind[] = ['terms', 'policy-ack', 'trainer-terms'];

export function isConsentKind(value: unknown): value is ConsentKind {
  return typeof value === 'string' && (CONSENT_KINDS as readonly string[]).includes(value);
}

export function isRequiredKind(kind: ConsentKind): boolean {
  return (REQUIRED_KINDS as readonly string[]).includes(kind);
}

/** Several kinds share one document (and so one version line). */
export function documentOf(kind: ConsentKind): LegalDoc {
  if (kind === 'policy-ack') return 'policy';
  if (kind === 'age-18') return 'age';
  if (kind.startsWith('health:')) return 'health';
  return kind as LegalDoc;
}

/** The versions and changelog a check runs against. Production uses the real ones; tests inject their own. */
export interface LegalCtx {
  versions: Readonly<Record<LegalDoc, string>>;
  changelog: readonly LegalChangelogEntry[];
}
export const DEFAULT_LEGAL_CTX: LegalCtx = { versions: LEGAL_VERSIONS, changelog: LEGAL_CHANGELOG };

export function currentVersion(
  kind: ConsentKind,
  versions: Readonly<Record<LegalDoc, string>> = LEGAL_VERSIONS,
): string {
  return versions[documentOf(kind)];
}

/** The latest record of a kind (by `at`, then `id`), or null. Order of `records` does not matter. */
export function latestRecord(
  records: readonly ConsentRecord[],
  kind: ConsentKind,
): ConsentRecord | null {
  let best: ConsentRecord | null = null;
  for (const r of records) {
    if (r.kind !== kind) continue;
    if (!best || r.at > best.at || (r.at === best.at && r.id > best.id)) best = r;
  }
  return best;
}

/** The person's current standing for a kind: `granted`, `withdrawn`, or `none` (never answered). */
export function consentState(
  records: readonly ConsentRecord[],
  kind: ConsentKind,
): 'granted' | 'withdrawn' | 'none' {
  const r = latestRecord(records, kind);
  if (!r) return 'none';
  return r.action === 'grant' ? 'granted' : 'withdrawn';
}

/** Granted (at any version). Whether it is still current is `isStale`. */
export function hasConsent(records: readonly ConsentRecord[], kind: ConsentKind): boolean {
  return consentState(records, kind) === 'granted';
}

/** Granted, but for a document version OLDER than the current one (`YYYY-MM-DD` sorts as text): ask again. */
export function isStale(
  records: readonly ConsentRecord[],
  kind: ConsentKind,
  versions: Readonly<Record<LegalDoc, string>> = LEGAL_VERSIONS,
): boolean {
  const r = latestRecord(records, kind);
  return !!r && r.action === 'grant' && r.version < currentVersion(kind, versions);
}

/** Granted at the current version: the feature may run. */
export function hasCurrentConsent(
  records: readonly ConsentRecord[],
  kind: ConsentKind,
  versions: Readonly<Record<LegalDoc, string>> = LEGAL_VERSIONS,
): boolean {
  return hasConsent(records, kind) && !isStale(records, kind, versions);
}

/**
 * A required consent is fine when granted at the current version, or granted at an older version of the Terms / Privacy
 * Policy whose changelog says how big the change is (N8: `PolicyUpdateHost` then shows the notice or the confirm sheet for
 * that one document). A stale grant the changelog does not cover is not fine: the full gate asks again.
 */
function requiredOk(records: readonly ConsentRecord[], kind: ConsentKind, ctx: LegalCtx): boolean {
  if (!hasConsent(records, kind)) return false;
  if (!isStale(records, kind, ctx.versions)) return true;
  const doc = (Object.keys(UPDATE_KIND) as UpdateDoc[]).find((d) => UPDATE_KIND[d] === kind);
  const from = latestRecord(records, kind)?.version ?? '';
  return !!doc && updateLevel(ctx.changelog, doc, from, ctx.versions[doc]) !== 'unknown';
}

/** An existing user lacks terms / policy-ack / age-18, or holds one the changelog cannot explain: show the blocking legal gate. */
export function needsLegalGate(
  records: readonly ConsentRecord[],
  ctx: LegalCtx = DEFAULT_LEGAL_CTX,
): boolean {
  return REQUIRED_KINDS.some((k) => !requiredOk(records, k, ctx));
}

/**
 * An OPTIONAL feature (Atlas AI chat, a health feature, gym search and maps) may run: granted at the current version and
 * not withdrawn. Never pre-ticked: no record means off. The one check every feature gate uses (SPO-286 / 290 / 293).
 */
export function optionalConsentOn(records: readonly ConsentRecord[], kind: ConsentKind): boolean {
  return !isRequiredKind(kind) && hasCurrentConsent(records, kind);
}
