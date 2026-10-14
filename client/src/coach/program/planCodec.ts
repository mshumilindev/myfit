/**
 * Plan documents <-> sealed documents (plan-security C.2 no. 3, sub-key `plan`; plan-backend 6.1).
 *
 *   plans/{clientId}                  open clientId, trainerId, programId, liveVersion, rev, updatedAt, keyEpoch;
 *                                     enc trainerDays, targets, activities, dayNotes   (the LIVE overlay)
 *   plans/{clientId}/versions/{n}     open n, programId, state, createdAt, publishedAt, keyEpoch;
 *                                     enc reason, summary, diff, overlay {program, trainerDays}   (the whole version)
 *
 * The ONLY place a plan or a version is sealed or opened. Everything goes through `sealOrThrow`: a locked vault or a
 * missing ring throws `vault-locked`, never plaintext. The authenticated context (AAD) is cid | epoch | document id |
 * author | time | class, with the class `plan` or `planVersion`:
 *
 *   plan     id = clientId, author = trainerId, time = 0. The publish function flips `liveVersion`, `rev`, `updatedAt`
 *            on the open side, so none of them may be part of the AAD. A plan copied to another conversation, client,
 *            author or class does not open; freshness is the trainer's `rev` check (rules: rev == previous + 1).
 *   version  id = `clientId:n`, author = trainerId, time = createdAt (immutable by rules). The publish function only
 *            changes the open `state` / `publishedAt`, so a version stays readable after it goes live.
 *
 * No logging anywhere. A document that does not open is reported to the caller as an error, never shown partially.
 */
import { openSealed, sealOrThrow, type SealSource } from '../../coachCrypto/sealOrThrow';
import type { Program, ProgramActivity } from '../../views/programs/model';
import type { Dow } from '../domain/types';
import { DOWS } from '../domain/types';
import { targetsOf } from './planTargets';
import type { Change } from './ops';

type Src = Omit<SealSource, 'ctx'>;
const roundSecond = (ms: number) => Math.floor(ms / 1000) * 1000;

/** The program id every version of one client's plan points at (the assignment is per client). */
export const planProgramId = (clientId: string): string => `prg-${clientId}`;
/**
 * The runnable program of ONE version (`programs/{id}`, the document the Gym app starts sessions from through the
 * assignment). One immutable document per version (R-BE-PRG-9): the member's assignment points at the previous version's
 * document until `publishPlanVersion` flips it, so the member never sees a half-published or unsent draft.
 */
export const versionProgramId = (clientId: string, n: number): string => `prg-${clientId}-${n}`;
export const versionDocId = (clientId: string, n: number): string => `${clientId}:${n}`;

export interface PlanOverlay {
  trainerDays: readonly Dow[];
  targets: ReturnType<typeof targetsOf>;
  activities: readonly ProgramActivity[];
  dayNotes: Readonly<Record<string, string>>;
}

export interface PlanDocData extends PlanOverlay {
  clientId: string;
  trainerId: string;
  programId: string;
  liveVersion: number;
  rev: number;
  updatedAt: number;
}

export const overlayOf = (p: Program, trainerDays: readonly Dow[]): PlanOverlay => ({
  trainerDays: [...trainerDays],
  targets: targetsOf(p),
  activities: p.activities ?? [],
  dayNotes: p.dayNames ?? {},
});

export const emptyOverlay = (): PlanOverlay => ({
  trainerDays: [],
  targets: {},
  activities: [],
  dayNotes: {},
});

export async function sealPlan(src: Src, d: PlanDocData): Promise<Record<string, unknown>> {
  return sealOrThrow(
    'plans',
    {
      clientId: d.clientId,
      trainerId: d.trainerId,
      programId: d.programId,
      // a create carries no liveVersion (rules: absent or 0); every later write keeps the server's value
      ...(d.liveVersion > 0 ? { liveVersion: d.liveVersion } : {}),
      rev: d.rev,
      updatedAt: roundSecond(d.updatedAt),
      trainerDays: [...d.trainerDays],
      targets: d.targets,
      activities: d.activities,
      dayNotes: d.dayNotes,
    },
    { ...src, ctx: { messageId: d.clientId, fromUid: d.trainerId, at: 0 } },
  );
}

export async function openPlan(
  src: Src,
  clientId: string,
  raw: Record<string, unknown>,
): Promise<PlanDocData> {
  if (
    raw.clientId !== clientId ||
    typeof raw.trainerId !== 'string' ||
    typeof raw.programId !== 'string' ||
    !Number.isSafeInteger(raw.rev) ||
    !Number.isSafeInteger(raw.updatedAt)
  )
    throw new Error('bad-plan');
  const d = await openSealed<Record<string, unknown>>('plans', raw, {
    ...src,
    ctx: { messageId: clientId, fromUid: raw.trainerId, at: 0 },
  });
  return {
    clientId,
    trainerId: raw.trainerId,
    programId: raw.programId,
    liveVersion: Number.isSafeInteger(raw.liveVersion) ? (raw.liveVersion as number) : 0,
    rev: raw.rev as number,
    updatedAt: raw.updatedAt as number,
    trainerDays: Array.isArray(d.trainerDays)
      ? d.trainerDays.filter((x): x is Dow => DOWS.includes(x as Dow))
      : [],
    targets: (d.targets && typeof d.targets === 'object'
      ? d.targets
      : {}) as PlanOverlay['targets'],
    activities: (Array.isArray(d.activities) ? d.activities : []) as ProgramActivity[],
    dayNotes: (d.dayNotes && typeof d.dayNotes === 'object' ? d.dayNotes : {}) as Record<
      string,
      string
    >,
  };
}

export type VersionState = 'draft' | 'live' | 'superseded';

export interface VersionDocData {
  n: number;
  programId: string;
  state: VersionState;
  createdAt: number;
  publishedAt: number | null;
  reason: string;
  /** What changed, in the trainer's words (user text). */
  summary: string;
  diff: readonly Change[];
  program: Program;
  trainerDays: readonly Dow[];
}

const STATES: readonly VersionState[] = ['draft', 'live', 'superseded'];

export async function sealVersion(
  src: Src,
  clientId: string,
  trainerId: string,
  v: VersionDocData,
): Promise<Record<string, unknown>> {
  const createdAt = roundSecond(v.createdAt);
  return sealOrThrow(
    'versions',
    {
      n: v.n,
      programId: v.programId,
      state: v.state,
      createdAt,
      ...(v.publishedAt != null ? { publishedAt: v.publishedAt } : {}),
      reason: v.reason,
      summary: v.summary,
      diff: v.diff,
      overlay: { program: v.program, trainerDays: [...v.trainerDays] },
    },
    { ...src, ctx: { messageId: versionDocId(clientId, v.n), fromUid: trainerId, at: createdAt } },
  );
}

export async function openVersion(
  src: Src,
  clientId: string,
  trainerId: string,
  raw: Record<string, unknown>,
): Promise<VersionDocData> {
  if (
    !Number.isSafeInteger(raw.n) ||
    typeof raw.programId !== 'string' ||
    !STATES.includes(raw.state as VersionState) ||
    !Number.isSafeInteger(raw.createdAt)
  )
    throw new Error('bad-version');
  const d = await openSealed<Record<string, unknown>>('versions', raw, {
    ...src,
    ctx: {
      messageId: versionDocId(clientId, raw.n as number),
      fromUid: trainerId,
      at: raw.createdAt as number,
    },
  });
  const ov = d.overlay as { program?: Program; trainerDays?: unknown } | undefined;
  if (!ov?.program || !Array.isArray(ov.program.items)) throw new Error('bad-version');
  return {
    n: raw.n as number,
    programId: raw.programId,
    state: raw.state as VersionState,
    createdAt: raw.createdAt as number,
    publishedAt: Number.isSafeInteger(raw.publishedAt) ? (raw.publishedAt as number) : null,
    reason: typeof d.reason === 'string' ? d.reason : '',
    summary: typeof d.summary === 'string' ? d.summary : '',
    diff: (Array.isArray(d.diff) ? d.diff : []) as Change[],
    program: ov.program,
    trainerDays: Array.isArray(ov.trainerDays)
      ? ov.trainerDays.filter((x): x is Dow => DOWS.includes(x as Dow))
      : [],
  };
}

/**
 * The TEMPLATE-LEVEL projection the Gym app can run (plan-backend F10 / R-BE-PRG-6): plaintext like every program in
 * `programs/{id}` (the server's `programMine` and `setProgramStatus` read the items), and therefore stripped of
 * everything that is the per-client trainer layer: targets (weight, RPE, rest, cue), warm-up weights and planned
 * activities. Those stay sealed in the version / plan and reach the member through the `ProgramLayer`. What remains
 * is the structure the trainer typed: day names, exercise names, sets, reps, equipment, groups, target muscles.
 * Starts as `draft` so nothing treats it as live; the publish function flips it to `active` in the same transaction as
 * the assignment. Pure and idempotent: the same program always yields the same document.
 */
export function runnableProgram(
  p: Program,
  o: { id: string; authorId: string; updatedAt: number },
): Program {
  const items = p.items
    .filter((i) => i.name.trim())
    .map((i) => {
      const { targetWeight: _w, targetRpe: _r, restSec: _s, note: _n, warmupItems, ...rest } = i;
      void _w;
      void _r;
      void _s;
      void _n;
      const warm = (warmupItems ?? []).map(({ weight: _kg, ...w }) => {
        void _kg;
        return w;
      });
      return { ...rest, ...(i.kind === 'warmup' && warm.length ? { warmupItems: warm } : {}) };
    });
  const { activities: _a, activitiesEnc: _e, ...base } = p;
  void _a;
  void _e;
  return {
    ...base,
    id: o.id,
    authorId: o.authorId,
    status: 'draft',
    items,
    updatedAt: o.updatedAt,
  };
}
