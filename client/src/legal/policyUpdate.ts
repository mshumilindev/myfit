/**
 * Which policy / terms updates an existing user still has to be told about (SPO-295 N8). Pure: no React, no Firestore.
 * A person who granted `terms` / `policy-ack` at an older version, where the changelog explains the move, gets a
 * dismissible notice for an editorial change, or a confirm sheet for a material one: for THAT document only.
 */
import {
  UPDATE_DOCS,
  UPDATE_KIND,
  entriesBetween,
  type ChangeBullet,
  type ChangeKind,
  type UpdateDoc,
} from './changelog';
import {
  DEFAULT_LEGAL_CTX,
  isStale,
  latestRecord,
  needsLegalGate,
  type ConsentRecord,
  type LegalCtx,
} from './consents';

export interface PendingUpdate {
  doc: UpdateDoc;
  kind: (typeof UPDATE_KIND)[UpdateDoc];
  level: ChangeKind;
  /** The current version of the document (what the person is asked to accept / is told about). */
  version: string;
  /** "What is new", without repeats, in the order of the changelog. */
  bullets: ChangeBullet[];
}

/** The updates to show, per affected document. Nothing while the full gate is due (it asks for everything first). */
export function pendingUpdates(
  records: readonly ConsentRecord[],
  ctx: LegalCtx = DEFAULT_LEGAL_CTX,
): PendingUpdate[] {
  if (needsLegalGate(records, ctx)) return [];
  const out: PendingUpdate[] = [];
  for (const doc of UPDATE_DOCS) {
    const kind = UPDATE_KIND[doc];
    if (!isStale(records, kind, ctx.versions)) continue;
    const from = latestRecord(records, kind)?.version ?? '';
    const to = ctx.versions[doc];
    // Only the NEWEST revision is shown (owner decision 04.11.2026): its own level and its own "what is new". Older revisions
    // the person never saw are not repeated. `unknown` (the changelog does not know the move) still asks for the full gate.
    const latest = entriesBetween(ctx.changelog, doc, from, to).at(-1);
    if (!latest) continue;
    const level: ChangeKind = latest.kind;
    const bullets = [...new Set(latest.bullets)];
    out.push({ doc, kind, level, version: to, bullets });
  }
  return out;
}
