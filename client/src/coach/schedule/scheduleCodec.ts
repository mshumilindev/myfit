/**
 * Schedule documents <-> sealed documents (plan 6.1 / 11, Part C sub-keys `schedule` and `requests`). The ONLY place a
 * schedule or a reschedule request is sealed or opened. Everything goes through `sealOrThrow`: a locked vault throws
 * `vault-locked`, never plaintext. AAD binds cid | epoch | id | author | time | kind, so a ciphertext copied to another
 * conversation, id, author or time does not open. The requester seals a request; the other party changes only the open
 * `status` / `decidedAt` (the sealed content and its AAD fields never change). No logging anywhere.
 */
import { openSealed, sealOrThrow, type SealSource } from '../../coachCrypto/sealOrThrow';
import { MAX_NOTE, type ReqStatus, type RescheduleRequest, type ScheduleDoc } from './types';

const roundSecond = (ms: number) => Math.floor(ms / 1000) * 1000;
const STATUSES: readonly ReqStatus[] = [
  'pending',
  'accepted',
  'declined',
  'countered',
  'expired',
  'cancelled',
];

/* ---- requests ------------------------------------------------------------------------------------------------------ */
/** conversations/{cid}/requests/{id}: open id, from, status, createdAt, decidedAt, expiresAt, slotKey, supersedes; enc slotRef, proposed, note. */
export async function sealRequest(
  src: Omit<SealSource, 'ctx'>,
  r: RescheduleRequest,
): Promise<Record<string, unknown>> {
  if (r.note && r.note.length > MAX_NOTE) throw new Error('note-too-long');
  const createdAt = roundSecond(r.createdAt);
  return sealOrThrow(
    'requests',
    {
      id: r.id,
      from: r.from,
      status: r.status,
      createdAt,
      ...(r.decidedAt != null ? { decidedAt: r.decidedAt } : {}),
      expiresAt: r.expiresAt,
      slotKey: r.slotKey,
      ...(r.supersedes ? { supersedes: r.supersedes } : {}),
      slotRef: {
        clientId: r.clientId,
        fromStart: r.fromStart,
        scope: r.scope,
        ...(r.groupKey ? { groupKey: r.groupKey } : {}),
      },
      proposed: { start: r.toStart },
      ...(r.note ? { note: r.note } : {}),
    },
    { ...src, ctx: { messageId: r.id, fromUid: r.from, at: createdAt } },
  );
}

export async function openRequest(
  src: Omit<SealSource, 'ctx'>,
  docId: string,
  raw: Record<string, unknown>,
): Promise<RescheduleRequest> {
  if (
    raw.id !== docId ||
    (raw.from !== 'trainer' && raw.from !== 'client') ||
    !Number.isSafeInteger(raw.createdAt)
  )
    throw new Error('bad-request');
  const d = await openSealed<Record<string, unknown>>('requests', raw, {
    ...src,
    ctx: { messageId: docId, fromUid: raw.from, at: raw.createdAt as number },
  });
  const ref = d.slotRef as Record<string, unknown> | undefined;
  const prop = d.proposed as Record<string, unknown> | undefined;
  if (
    !ref ||
    !prop ||
    typeof ref.clientId !== 'string' ||
    typeof ref.fromStart !== 'number' ||
    typeof prop.start !== 'number' ||
    typeof d.slotKey !== 'string' ||
    !STATUSES.includes(d.status as ReqStatus) ||
    typeof d.expiresAt !== 'number'
  )
    throw new Error('bad-request');
  return {
    id: docId,
    clientId: ref.clientId,
    from: raw.from,
    slotKey: d.slotKey,
    fromStart: ref.fromStart,
    toStart: prop.start,
    ...(typeof d.note === 'string' ? { note: d.note } : {}),
    status: d.status as ReqStatus,
    createdAt: raw.createdAt as number,
    ...(typeof d.decidedAt === 'number' ? { decidedAt: d.decidedAt } : {}),
    expiresAt: d.expiresAt,
    scope: ref.scope === 'one' ? 'one' : 'all',
    ...(typeof ref.groupKey === 'string' ? { groupKey: ref.groupKey } : {}),
    ...(typeof d.supersedes === 'string' ? { supersedes: d.supersedes } : {}),
  };
}

/** The ONLY change the other party may write: open `status` + `decidedAt` (the sealed part and its AAD stay as they are). */
export function withStatus(
  raw: Record<string, unknown>,
  status: ReqStatus,
  decidedAt: number,
): Record<string, unknown> {
  return { ...raw, status, decidedAt };
}

const cleanGymNames = (v: unknown): { gymNames?: Record<string, string> } => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [id, name] of Object.entries(v as Record<string, unknown>).slice(0, 40))
    if (typeof name === 'string' && name.trim()) out[id.slice(0, 120)] = name.trim().slice(0, 120);
  return Object.keys(out).length ? { gymNames: out } : {};
};

/* ---- schedules ------------------------------------------------------------------------------------------------------ */
/** schedules/{clientId}: open clientId, trainerId, rev, updatedAt, keyEpoch; enc patterns, oneOffs, exceptions, cancelled. */
export async function sealSchedule(
  src: Omit<SealSource, 'ctx'>,
  doc: ScheduleDoc,
  trainerUid: string,
  updatedAt: number,
): Promise<Record<string, unknown>> {
  const at = roundSecond(updatedAt);
  return sealOrThrow(
    'schedules',
    {
      clientId: doc.clientId,
      trainerId: trainerUid,
      rev: doc.rev,
      updatedAt: at,
      patterns: doc.patterns,
      oneOffs: doc.oneOffs,
      exceptions: doc.exceptions,
      cancelled: doc.cancelled,
      ...(doc.tz ? { tz: doc.tz } : {}),
      ...(doc.gymNames && Object.keys(doc.gymNames).length ? { gymNames: doc.gymNames } : {}),
    },
    { ...src, ctx: { messageId: doc.clientId, fromUid: trainerUid, at } },
  );
}

export async function openSchedule(
  src: Omit<SealSource, 'ctx'>,
  docId: string,
  raw: Record<string, unknown>,
): Promise<ScheduleDoc> {
  if (
    raw.clientId !== docId ||
    typeof raw.trainerId !== 'string' ||
    !Number.isSafeInteger(raw.updatedAt) ||
    !Number.isSafeInteger(raw.rev)
  )
    throw new Error('bad-schedule');
  const d = await openSealed<Record<string, unknown>>('schedules', raw, {
    ...src,
    ctx: { messageId: docId, fromUid: raw.trainerId, at: raw.updatedAt as number },
  });
  const arr = (x: unknown) => (Array.isArray(x) ? x : []);
  return {
    clientId: docId,
    rev: raw.rev as number,
    patterns: arr(d.patterns) as ScheduleDoc['patterns'],
    oneOffs: arr(d.oneOffs) as ScheduleDoc['oneOffs'],
    exceptions: arr(d.exceptions) as ScheduleDoc['exceptions'],
    cancelled: arr(d.cancelled).filter((x): x is string => typeof x === 'string'),
    ...(typeof d.tz === 'string' && d.tz.length <= 64 ? { tz: d.tz } : {}),
    ...cleanGymNames(d.gymNames),
  };
}
