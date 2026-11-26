/**
 * Edits of a session's block list (pure: list in, list out). The UI passes the result to the store's `setWorkoutBlocks`.
 * Every op leaves the other blocks, and any field it does not know, untouched.
 */
import {
  finishRun,
  newBlockId,
  pauseRun,
  resumeRun,
  startRun,
  validateSpec,
  type BlockMember,
  type BlockResult,
  type BlockSpec,
  type WorkoutBlock,
} from './model';

const mapBlock = (
  blocks: readonly WorkoutBlock[],
  id: string,
  f: (b: WorkoutBlock) => WorkoutBlock,
): WorkoutBlock[] => blocks.map((b) => (b.id === id ? f(b) : b));

/** A new, not-yet-started block after the `exerciseCount`-th exercise. Refuses a bad spec or a block with no exercise. */
export function addBlock(
  blocks: readonly WorkoutBlock[],
  spec: BlockSpec,
  members: readonly BlockMember[],
  exerciseCount: number,
  now: number,
): WorkoutBlock[] {
  if (!validateSpec(spec) || members.length === 0) return [...blocks];
  const b: WorkoutBlock = {
    id: newBlockId(now),
    spec,
    members: members.map((m) => ({ ...m })),
    position: exerciseCount - 0.5,
  };
  return [...blocks, b];
}

/** Edit a block that has not started (a started block keeps its numbers: the clock is already running on them). */
export function editBlock(
  blocks: readonly WorkoutBlock[],
  id: string,
  spec: BlockSpec,
  members: readonly BlockMember[],
): WorkoutBlock[] {
  if (!validateSpec(spec) || members.length === 0) return [...blocks];
  return mapBlock(blocks, id, (b) =>
    b.run ? b : { ...b, spec, members: members.map((m) => ({ ...m })) },
  );
}

export const startBlock = (blocks: readonly WorkoutBlock[], id: string, now: number) =>
  mapBlock(blocks, id, (b) =>
    b.run || b.result ? b : { ...b, run: startRun(now), roundsDone: 0 },
  );

export const pauseBlock = (blocks: readonly WorkoutBlock[], id: string, now: number) =>
  mapBlock(blocks, id, (b) => (b.run ? { ...b, run: pauseRun(b.run, now) } : b));

export const resumeBlock = (blocks: readonly WorkoutBlock[], id: string, now: number) =>
  mapBlock(blocks, id, (b) => (b.run ? { ...b, run: resumeRun(b.run, now) } : b));

/** The Round button (AMRAP: +1 round; For time: one scheme round done). Ignored when not running. */
export const countRound = (blocks: readonly WorkoutBlock[], id: string) =>
  mapBlock(blocks, id, (b) =>
    b.run && b.run.finishedAt == null && b.run.pausedAt == null
      ? { ...b, roundsDone: (b.roundsDone ?? 0) + 1 }
      : b,
  );

/** The block ended: the cap was reached, or the person finished For time / stopped early. */
export const endBlock = (blocks: readonly WorkoutBlock[], id: string, now: number) =>
  mapBlock(blocks, id, (b) => (b.run ? { ...b, run: finishRun(b.run, now) } : b));

export const saveResult = (blocks: readonly WorkoutBlock[], id: string, result: BlockResult) =>
  mapBlock(blocks, id, (b) => (b.run ? { ...b, result } : b));

/** Throw a block away (Cancel before it started, or delete). A logged result goes with it: the caller confirms first. */
export const removeBlock = (blocks: readonly WorkoutBlock[], id: string) =>
  blocks.filter((b) => b.id !== id);
