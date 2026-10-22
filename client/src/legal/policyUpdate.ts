/**
 * Which policy / terms updates an existing user still has to be told about (SPO-295 N8). Pure: no React, no Firestore.
 * A person who granted `terms` / `policy-ack` at an older version, where the changelog explains the move, gets a
 * dismissible notice for an editorial change, or a confirm sheet for a material one: for THAT document only.
 */
import {
  UPDATE_DOCS,
  UPDATE_KIND,
  entriesBetween,
  updateLevel,
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
    const level = updateLevel(ctx.changelog, doc, from, to);
    if (level === 'unknown') continue;
    const bullets = [
      ...new Set(entriesBetween(ctx.changelog, doc, from, to).flatMap((e) => e.bullets)),
    ];
    out.push({ doc, kind, level, version: to, bullets });
  }
  return out;
}
