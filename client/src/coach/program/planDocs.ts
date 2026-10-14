/**
 * Plan documents (R-BE-KEY, `plans/{clientId}` and `plans/{clientId}/versions/{n}`): the draft <-> the registered shapes.
 * Only the declared open fields leave in the clear; trainer days, targets, activities, notes, summary and the overlay are
 * secret. Sealing itself (`sealOrThrow`, key 'ck', sub-key `plan`, AAD context) is `planCodec.ts`; the Firestore adapter
 * is `data/firestore/programPort.ts` (trainer) and `data/firestore/clientProgram.ts` (member).
 */
import type { Program } from '../../views/programs/model';
import type { Dow } from '../domain/types';
import { splitFields } from '../../coachCrypto/newCollections';
import { forWrite } from './ops';

import { targetsOf } from './planTargets';

export { targetsOf };

export interface PlanDocInput {
  clientId: string;
  trainerId: string;
  programId: string;
  liveVersion: number;
  rev: number;
  updatedAt: number;
  trainerDays: readonly Dow[];
  draft: Program;
}

export function toPlanDoc(i: PlanDocInput): Record<string, unknown> {
  return {
    clientId: i.clientId,
    trainerId: i.trainerId,
    programId: i.programId,
    liveVersion: i.liveVersion,
    rev: i.rev,
    updatedAt: i.updatedAt,
    keyEpoch: 0,
    trainerDays: [...i.trainerDays],
    targets: targetsOf(i.draft),
    activities: i.draft.activities ?? [],
    dayNotes: i.draft.dayNames ?? {},
  };
}

export function toVersionDoc(v: {
  n: number;
  programId: string;
  state: 'draft' | 'sent';
  createdAt: number;
  publishedAt: number | null;
  summary: string;
  draft: Program;
}): Record<string, unknown> {
  return {
    n: v.n,
    programId: v.programId,
    state: v.state,
    createdAt: v.createdAt,
    publishedAt: v.publishedAt,
    keyEpoch: 0,
    summary: v.summary,
    overlay: { program: forWrite(v.draft) },
  };
}

/** What a registered split makes of a doc (used by the tests and by the real adapter before sealing). */
export const splitPlan = (doc: Record<string, unknown>) => splitFields('plans', doc);
export const splitVersion = (doc: Record<string, unknown>) => splitFields('versions', doc);
