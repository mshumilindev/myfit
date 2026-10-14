/**
 * Decision records <-> sealed documents. ALL writes go through `sealOrThrow` with the registry in
 * `coachCrypto/newCollections` (never `prepareWrite`, never a plaintext fallback): when the vault is
 * locked the call throws `VaultLockedError` and nothing is written (the store keeps the op queued).
 *  decisions/{id}            open: id, clientId, kind, status, decidedAt, windowEndsAt
 *                            enc : signal, optionId, diff, message, outcome, e1rmBefore, e1rmAfter, noiseKg, notes
 *  decisions/{id}/evidence/{cat}  open: category   enc: rows = { level, granular, rows[] }
 *  meta/signalState          open: updatedAt       enc: snoozed, dismissed = { entries, dataQuality }
 * `dataQuality` has no field of its own by design: it is part of the one sealed `dismissed` object (no rule or query
 * reads it, so a separate registry field would add nothing).
 */
import type { Vault } from '../../autoVault';
import { openSealed, sealOrThrow } from '../../coachCrypto/sealOrThrow';
import type { DecisionBook, DecisionRecord, DismissReason } from '../domain/decisions';
import type { Category, Evidence } from '../domain/types';

const src = (vault: Vault) => ({ vault });

type OpenedDecision = Record<string, unknown> &
  Omit<
    DecisionRecord,
    'evidence' | 'reason' | 'optionId' | 'diff' | 'message' | 'outcome' | 'windowEndsAt'
  > & {
    windowEndsAt?: number | null;
    optionId?: string | null;
    diff?: DecisionRecord['diff'];
    message?: string;
    outcome?: DecisionRecord['outcome'];
    notes?: { reason?: DismissReason | null };
  };
type OpenedEvidence = Record<string, unknown> & {
  category: Category;
  rows: { level: Evidence['level']; granular: boolean; rows: Evidence['rows'] };
};
type OpenedSignalState = Record<string, unknown> & {
  snoozed?: DecisionBook['snoozed'];
  dismissed?: { entries?: DecisionBook['dismissed']; dataQuality?: DecisionBook['dataQuality'] };
};

export function toDecisionDoc(d: DecisionRecord): Record<string, unknown> {
  return {
    id: d.id,
    clientId: d.clientId,
    kind: d.kind,
    status: d.status,
    decidedAt: d.decidedAt,
    windowEndsAt: d.windowEndsAt,
    signal: d.signal,
    optionId: d.optionId,
    diff: d.diff,
    message: d.message,
    outcome: d.outcome,
    e1rmBefore: d.outcome?.before ?? null,
    e1rmAfter: d.outcome?.after ?? null,
    noiseKg: d.outcome?.noiseKg ?? null,
    notes: { reason: d.reason },
  };
}

export function evidenceDocs(
  d: DecisionRecord,
): { category: Category; doc: Record<string, unknown> }[] {
  return d.evidence.map((e) => ({
    category: e.category,
    doc: { category: e.category, rows: { level: e.level, granular: e.granular, rows: e.rows } },
  }));
}

export async function sealDecision(d: DecisionRecord, vault: Vault) {
  const decision = await sealOrThrow('decisions', toDecisionDoc(d), src(vault));
  const evidence = await Promise.all(
    evidenceDocs(d).map(async (e) => ({
      category: e.category,
      doc: await sealOrThrow('evidence', e.doc, src(vault)),
    })),
  );
  return { decision, evidence };
}

export async function openDecision(
  raw: Record<string, unknown>,
  evidenceRaw: Record<string, unknown>[],
  vault: Vault,
): Promise<DecisionRecord> {
  const o = await openSealed<OpenedDecision>('decisions', raw, src(vault));
  const evidence: Evidence[] = [];
  for (const er of evidenceRaw) {
    const e = await openSealed<OpenedEvidence>('evidence', er, src(vault));
    evidence.push({
      category: e.category,
      level: e.rows.level,
      granular: e.rows.granular,
      rows: e.rows.rows,
    });
  }
  return {
    id: o.id,
    clientId: o.clientId,
    kind: o.kind,
    status: o.status,
    decidedAt: o.decidedAt,
    windowEndsAt: o.windowEndsAt ?? null,
    signal: o.signal,
    optionId: o.optionId ?? null,
    diff: o.diff ?? null,
    message: o.message ?? '',
    reason: o.notes?.reason ?? null,
    outcome: o.outcome ?? null,
    evidence,
  };
}

export async function sealSignalState(book: DecisionBook, vault: Vault, updatedAt: number) {
  return sealOrThrow(
    'signalState',
    {
      updatedAt,
      snoozed: book.snoozed,
      dismissed: { entries: book.dismissed, dataQuality: book.dataQuality },
    },
    src(vault),
  );
}

export async function openSignalState(raw: Record<string, unknown>, vault: Vault) {
  const o = await openSealed<OpenedSignalState>('signalState', raw, src(vault));
  return {
    snoozed: (o.snoozed ?? {}) as DecisionBook['snoozed'],
    dismissed: (o.dismissed?.entries ?? {}) as DecisionBook['dismissed'],
    dataQuality: (o.dismissed?.dataQuality ?? {}) as DecisionBook['dataQuality'],
  };
}
