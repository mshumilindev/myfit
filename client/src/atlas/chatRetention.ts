/**
 * Withdrawing the `atlas-history` consent (SPO-392). Using the copy stops at once either way (the sync is off); what
 * happens to the stored copy is the person's choice in the dialog:
 *  - 'now'  — deleted right away (their right to erasure);
 *  - 'keep' — kept, sealed and unused, for `RETENTION_DAYS` so a slip can be undone (turning the consent back on within
 *             that time brings the chat back); then deleted by the next sweep. Never read or shown while the consent is off.
 * Ports only, so it is tested with fakes.
 */
import { EMPTY_STATE, retentionExpired, type AtlasState } from './chatSyncCore';

export interface RetentionPorts {
  /** The state document; throws when it exists but cannot be read yet (vault locked) — never guessed as empty. */
  readState(): Promise<AtlasState>;
  putState(st: AtlasState): Promise<void>;
  deleteAll(): Promise<void>;
  now(): number;
}

export async function withdrawHistory(p: RetentionPorts, mode: 'keep' | 'now'): Promise<void> {
  const st = await p.readState();
  if (mode === 'now') {
    await p.deleteAll();
    await p.putState({ ...st, withdrawnAt: null });
  } else {
    await p.putState({ ...st, withdrawnAt: p.now() });
  }
}

/** Deletes a kept copy whose time is up. Run while the consent is off; harmless otherwise. */
export async function sweepWithdrawn(p: RetentionPorts): Promise<'none' | 'kept' | 'deleted'> {
  const st = await p.readState().catch(() => EMPTY_STATE);
  if (st.withdrawnAt === null) return 'none';
  if (!retentionExpired(st.withdrawnAt, p.now())) return 'kept';
  await p.deleteAll();
  await p.putState({ ...st, withdrawnAt: null });
  return 'deleted';
}
