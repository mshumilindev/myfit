/**
 * Tamper-evident trail of a manager's edits to a client's sealed schedule (SPO-267 M4).
 *
 * The schedule is sealed, so the server cannot read what changed, but it CAN see that a new version was written and by whom:
 * the rules force a manager to sign every write with their own uid (`updatedBy`) and to bump `rev` by exactly one. This
 * Firestore trigger therefore writes the journal entry ITSELF, whatever the manager's device does or does not report
 * (`teamLogActivity` stays as the richer, device-reported "done / missed / cancelled" note). Metadata only: who, which
 * client, which version. The client reads it through `teamForClient` ("Who saw your data"), the owner through `teamActivity`.
 *
 * Idempotent by DOCUMENT VERSION: the entry id is derived from (client, rev), so a redelivered event is a no-op. A write that
 * does not bump `rev` (the reminder job advancing `timing.dueAt`) is not a new version and is ignored.
 *
 * Not kept: the previous ciphertext. Retaining a revision means a new sealed-size store with its own retention, rules and
 * restore path; the trail (who / when / which version) is what makes an edit visible, and the version number lets a later
 * revision store attach to it.
 */
import { logActivity, teamIdOf } from './activity';
import type { Doc } from './kv';
import type { Ctx } from './service';

export const scheduleEntryId = (clientId: string, rev: number): string =>
  `sch-${clientId}-${rev}`.slice(0, 200);

export type TrailResult = 'logged' | 'duplicate' | 'skipped';

const asInt = (x: unknown): number | null => (Number.isInteger(x) ? (x as number) : null);

export async function afterScheduleWritten(
  ctx: Ctx,
  clientId: string,
  before: Doc | null,
  after: Doc | null,
): Promise<TrailResult> {
  if (!after) return 'skipped'; // deleted (end of relationship): the end-of-relationship body logs its own notices
  const rev = asInt(after.rev);
  if (rev === null) return 'skipped';
  if (before && asInt(before.rev) === rev) return 'skipped'; // not a new version (e.g. `timing.dueAt` advanced by the job)
  const writer = typeof after.updatedBy === 'string' ? after.updatedBy : '';
  const trainerId = typeof after.trainerId === 'string' ? after.trainerId : '';
  // The trainer (who may omit `updatedBy`) and the client are not the subject of this trail: only a third party is, i.e. a manager.
  if (!writer || !trainerId || writer === trainerId || writer === clientId) return 'skipped';
  const id = scheduleEntryId(clientId, rev);
  const teamId = await teamIdOf(ctx.kv, trainerId);
  return ctx.kv.tx(async (kv) => {
    if (await kv.get(`teams/${teamId}/activity/${id}`)) return 'duplicate';
    await logActivity(
      kv,
      teamId,
      ctx.now(),
      { actorUid: writer, role: 'manager', kind: 'session-edited', clientId, refId: `rev-${rev}` },
      id,
    );
    return 'logged';
  });
}
