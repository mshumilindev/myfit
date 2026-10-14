/**
 * The ONE seam between the program editor and its data (like CoachWorldPort): components never call Firebase.
 * The real one is `data/firestore/programPort.ts`: it reads/writes `plans/{clientId}`
 * and `plans/{clientId}/versions/{n}` sealed with `sealOrThrow` (`planCodec.ts`), publishes through the
 * `publishPlanVersion` callable (flips `liveVersion`, writes the client's "Program updated (vN)" notice) and copies the
 * draft to a client that shares the program.
 */
import type { Dow } from '../domain/types';
import type { Program } from '../../views/programs/model';
import type { LibraryEntry, ProgramBundle, SaveResult } from './types';

export interface ProgramPort {
  /** Last good bundle from the local (sealed) cache, synchronously. Never blocks. */
  peek(clientId: string): ProgramBundle | null;
  /** From the server. May be slow or fail; the screen renders the cache meanwhile. */
  load(clientId: string, opts: { signal: AbortSignal }): Promise<ProgramBundle>;
  /** Save the draft. `baseRev` stale -> ProgramPortError('conflict'). */
  saveDraft(
    clientId: string,
    input: { draft: Program; trainerDays: readonly Dow[]; baseRev: number },
  ): Promise<SaveResult>;
  /** Publish the draft as the client's live version. */
  send(
    clientId: string,
    input: { draft: Program; trainerDays: readonly Dow[]; baseRev: number },
  ): Promise<{ version: number; rev: number }>;
  /** Days to copy from (templates, other clients' programs). Local cache; never blocks. */
  library(clientId: string): LibraryEntry[];
  /** Copy the current draft to another client on the same program. */
  copyTo(clientId: string, targetClientId: string): Promise<void>;
}
