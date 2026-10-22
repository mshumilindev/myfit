/** What the Consents page shows for each kind (SPO-295 N4). Pure: no React, no Firestore. */
import {
  HEALTH_FEATURES,
  REQUIRED_KINDS,
  hasConsent,
  hasCurrentConsent,
  isStale,
  latestRecord,
  type ConsentKind,
  type ConsentRecord,
} from './consents';

/** The optional consents the page lists, in page order (health features, then the two that send data outside). */
export const HEALTH_KINDS: readonly ConsentKind[] = HEALTH_FEATURES.map(
  (f) => `health:${f}` as const,
);
export const OUTSIDE_KINDS = [
  'atlas-ai',
  'atlas-puter',
  'geo-search',
] as const satisfies readonly ConsentKind[];
export const OPTIONAL_KINDS: readonly ConsentKind[] = [...HEALTH_KINDS, ...OUTSIDE_KINDS];

export type RowStatus =
  | { state: 'loading' }
  | { state: 'none' }
  | { state: 'given'; version: string; at: number }
  | { state: 'older'; version: string; at: number };

export interface RowModel {
  /** The switch: only a CURRENT grant is on; an older version asks again. */
  on: boolean;
  status: RowStatus;
}

export function rowModel(
  records: readonly ConsentRecord[],
  kind: ConsentKind,
  loading: boolean,
): RowModel {
  if (loading) return { on: false, status: { state: 'loading' } };
  const r = latestRecord(records, kind);
  if (!r || !hasConsent(records, kind)) return { on: false, status: { state: 'none' } };
  if (isStale(records, kind)) {
    return { on: false, status: { state: 'older', version: r.version, at: r.at } };
  }
  return { on: true, status: { state: 'given', version: r.version, at: r.at } };
}

/** Terms of Use, Privacy Policy and 18+ are one row: on only when all three stand at the current version. */
export function requiredModel(records: readonly ConsentRecord[], loading: boolean): RowModel {
  if (loading) return { on: false, status: { state: 'loading' } };
  const on = REQUIRED_KINDS.every((k) => hasCurrentConsent(records, k));
  const terms = latestRecord(records, 'terms');
  if (!on || !terms) return { on: false, status: { state: 'none' } };
  return { on: true, status: { state: 'given', version: terms.version, at: terms.at } };
}

/** "N of M on" over the optional consents. */
export function countOn(records: readonly ConsentRecord[]): { on: number; total: number } {
  return {
    on: OPTIONAL_KINDS.filter((k) => hasCurrentConsent(records, k)).length,
    total: OPTIONAL_KINDS.length,
  };
}
