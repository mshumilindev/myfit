/**
 * Typed changelog of the Terms of Use and the Privacy Policy (SPO-295 N8): the ONE source for what a new version means to
 * people already using Spotter. Pure: no React, no Firestore.
 *
 * Every released version after a document's first needs an entry here (`changelogGaps`, enforced by a test). An
 * `editorial` change (wording, no change in processing) only shows a dismissible notice; a `material` change (a new
 * purpose, recipient, category, period or transfer) blocks with a confirm sheet that lists the `bullets` and records a
 * fresh consent at the new version (LEGAL-compliance-system §3). Bullet texts are i18n keys (`i18n/legalUpdate.ts`).
 */
import type { LegalDoc } from './releasedVersions';

/** The documents that carry a changelog, and the consent kind that records the person's standing on each. */
export const UPDATE_DOCS = ['terms', 'policy'] as const satisfies readonly LegalDoc[];
export type UpdateDoc = (typeof UPDATE_DOCS)[number];
export const UPDATE_KIND = { terms: 'terms', policy: 'policy-ack' } as const;

/** What a material change can be about. Each key has its text in every locale. */
export const CHANGE_BULLETS = [
  'recipient',
  'purpose',
  'category',
  'retention',
  'transfer',
  'terms',
] as const;
export type ChangeBullet = (typeof CHANGE_BULLETS)[number];

export type ChangeKind = 'editorial' | 'material';

export interface LegalChangelogEntry {
  doc: UpdateDoc;
  /** `YYYY-MM-DD`, one of `RELEASED_VERSIONS[doc]`. */
  version: string;
  kind: ChangeKind;
  /** The "what is new" list; required (at least one) for a material change. */
  bullets: readonly ChangeBullet[];
}

/** Newest last. Empty: the first versions (2026-10-21) are the baseline. */
export const LEGAL_CHANGELOG: readonly LegalChangelogEntry[] = [];

/** Entries of a document after `from` (exclusive) up to `to` (inclusive). */
export function entriesBetween(
  log: readonly LegalChangelogEntry[],
  doc: UpdateDoc,
  from: string,
  to: string,
): LegalChangelogEntry[] {
  return log.filter((e) => e.doc === doc && e.version > from && e.version <= to);
}

/**
 * How big the move from `from` to `to` is: `material` when any step in between is, else `editorial`; `unknown` when the
 * changelog says nothing about it (the caller then asks for the full acceptance, the safe way).
 */
export function updateLevel(
  log: readonly LegalChangelogEntry[],
  doc: UpdateDoc,
  from: string,
  to: string,
): ChangeKind | 'unknown' {
  const es = entriesBetween(log, doc, from, to);
  if (es.length === 0) return 'unknown';
  return es.some((e) => e.kind === 'material') ? 'material' : 'editorial';
}

/** Guard: released versions (after the first of each document) with no changelog entry, and material entries with no bullets. */
export function changelogGaps(
  released: Readonly<Record<string, readonly string[]>>,
  log: readonly LegalChangelogEntry[],
): string[] {
  const gaps: string[] = [];
  for (const doc of UPDATE_DOCS) {
    const versions = [...(released[doc] ?? [])].sort();
    for (const v of versions.slice(1)) {
      const e = log.find((x) => x.doc === doc && x.version === v);
      if (!e) gaps.push(`${doc}@${v}: no changelog entry`);
      else if (e.kind === 'material' && e.bullets.length === 0)
        gaps.push(`${doc}@${v}: material entry without bullets`);
    }
  }
  for (const e of log) {
    if (!(released[e.doc] ?? []).includes(e.version))
      gaps.push(`${e.doc}@${e.version}: entry for a version that is not released`);
  }
  return gaps;
}
