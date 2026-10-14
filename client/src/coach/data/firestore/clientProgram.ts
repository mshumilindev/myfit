/**
 * The member's side of the plan: `plans/{me}` + the LIVE version document, opened on this device with the conversation
 * key ring (sub-key `plan`) into the `ProgramLayer` the client screens draw. A draft version is never read (rules: a
 * member reads only versions that are not drafts) and never shown; the layer is built from the live version alone.
 *
 * Returns null when there is nothing to show: no plan, no published version, no key on this device, or a document that
 * does not open (wrong key, tampered, copied from elsewhere). It never throws plaintext or partial content.
 */
import type { Vault } from '../../../autoVault';
import type { ChatKeyRing } from '../../../coachCrypto/conversationKey';
import type { Program } from '../../../views/programs/model';
import { openPlan, openVersion } from '../../program/planCodec';
import type { PlannedActivity, ProgramLayer, TargetRow } from '../../client/data/types';
import type { FsApi, Raw } from './fsApi';

export function layerFromVersion(p: {
  program: Program;
  trainerDays: ProgramLayer['trainerDays'];
  version: number;
  updatedAt: number;
  summary: string;
  acked: boolean;
}): ProgramLayer {
  const targets: Record<string, TargetRow> = {};
  for (const i of p.program.items) {
    if (i.kind !== 'strength' || i.bare || i.sets <= 0) continue;
    targets[i.name] = {
      sets: i.sets,
      reps: i.reps,
      kg: i.targetWeight ?? null,
      rpe: i.targetRpe ?? null,
      restSec: i.restSec ?? null,
      ...(i.note?.trim() ? { note: i.note.trim() } : {}),
    };
  }
  const activities: PlannedActivity[] = (p.program.activities ?? []).map((a) => ({
    id: a.id,
    day: a.day,
    name: a.type,
    minutes: a.minutes,
    when: a.when === 'before' ? 'before' : 'after',
  }));
  return {
    version: p.version,
    updatedAt: p.updatedAt,
    summary: p.summary,
    acked: p.acked,
    trainerDays: p.trainerDays,
    targets,
    activities,
    program: p.program,
  };
}

/**
 * The runnable program (`programs/prg-{client}-{n}`, plaintext, template level) with the sealed trainer layer put back,
 * IN MEMORY ONLY: per item id the target weight, RPE, rest and cue plus the warm-up weights, and the planned
 * activities. Items the layer does not know stay as they are; layer items the runnable program does not hold are
 * ignored. Nothing here is written anywhere (the localStorage cache of the assignment keeps the stripped form).
 */
export function applyProgramLayer<
  P extends {
    items: ReadonlyArray<{ id: string }>;
    activities?: unknown;
  },
>(p: P, layer: Pick<ProgramLayer, 'program'> | null | undefined): P {
  const lp = layer?.program;
  if (!lp) return p;
  const by = new Map(lp.items.map((i) => [i.id, i]));
  const items = p.items.map((i) => {
    const l = by.get(i.id);
    if (!l) return i;
    return {
      ...i,
      ...(l.targetWeight != null ? { targetWeight: l.targetWeight } : {}),
      ...(l.targetRpe != null ? { targetRpe: l.targetRpe } : {}),
      ...(l.restSec != null ? { restSec: l.restSec } : {}),
      ...(l.note?.trim() ? { note: l.note } : {}),
      ...(l.warmupItems?.length ? { warmupItems: l.warmupItems } : {}),
    };
  });
  return { ...p, items, ...(lp.activities?.length ? { activities: lp.activities } : {}) };
}

/** The "Program updated" notice is the open trace of a new version: unread and for this version = not acknowledged. */
export const ackedFrom = (notice: Raw | null, version: number): boolean => {
  if (!notice) return true;
  const ref = notice.ref as { version?: unknown } | undefined;
  if (ref && Number(ref.version) !== version) return true;
  return notice.readAt != null;
};

export async function readProgramLayer(d: {
  fs: FsApi;
  vault: Vault;
  uid: string;
  ring: ChatKeyRing | null;
  /** The ring of an earlier epoch (a plan sealed before a key rotation). */
  ringAt?: (epoch: number) => ChatKeyRing | null;
  plan: Raw | null;
  notice: Raw | null;
}): Promise<ProgramLayer | null> {
  const { fs, plan, ring } = d;
  if (!plan || !ring) return null;
  const liveN = Number(plan.liveVersion ?? 0);
  if (!Number.isSafeInteger(liveN) || liveN < 1 || typeof plan.trainerId !== 'string') return null;
  try {
    // the ring of the epoch each document was sealed in (a rotation leaves earlier documents under earlier epochs)
    const at = (epoch: unknown): ChatKeyRing | null =>
      !Number.isInteger(epoch) || epoch === ring.epoch
        ? ring
        : (d.ringAt?.(epoch as number) ?? null);
    const planRing = at(plan.keyEpoch);
    if (!planRing) return null;
    // the plan itself must open too: a plan copied from another conversation is not shown
    await openPlan({ vault: d.vault, ring: planRing }, d.uid, plan);
    const raw = await fs.get(`plans/${d.uid}/versions/${liveN}`);
    if (!raw || raw.state !== 'live') return null;
    const verRing = at(raw.keyEpoch);
    if (!verRing) return null;
    const v = await openVersion({ vault: d.vault, ring: verRing }, d.uid, plan.trainerId, raw);
    return layerFromVersion({
      program: v.program,
      trainerDays: v.trainerDays,
      version: v.n,
      updatedAt: v.publishedAt ?? v.createdAt,
      summary: v.summary,
      acked: ackedFrom(d.notice, v.n),
    });
  } catch {
    return null;
  }
}
