import { describe, expect, it } from 'vitest';
import {
  addBlock,
  countRound,
  editBlock,
  endBlock,
  pauseBlock,
  removeBlock,
  resumeBlock,
  saveResult,
  startBlock,
} from './blockOps';
import { blockStatus, type BlockSpec, type WorkoutBlock } from './model';

const spec: BlockSpec = { fmt: 'amrap', capSec: 720 };
const members = [{ name: 'Pullups', reps: '5' }];
const fresh = () => addBlock([], spec, members, 2, 1000);

describe('block ops', () => {
  it('adds a block after the n-th exercise; refuses a bad spec or no exercise', () => {
    const [b] = fresh();
    expect(b.position).toBe(1.5);
    expect(blockStatus(b)).toBe('ready');
    expect(addBlock([], { fmt: 'amrap' }, members, 0, 1)).toEqual([]);
    expect(addBlock([], spec, [], 0, 1)).toEqual([]);
  });
  it('edits only a block that has not started', () => {
    const [b] = fresh();
    const next: BlockSpec = { fmt: 'amrap', capSec: 600 };
    expect(editBlock([b], b.id, next, members)[0].spec).toEqual(next);
    const started = startBlock([b], b.id, 2000);
    expect(editBlock(started, b.id, next, members)[0].spec).toEqual(spec);
    expect(editBlock([b], b.id, { fmt: 'amrap' }, members)[0].spec).toEqual(spec); // bad spec ignored
  });
  it('start, pause, resume, round, end, result: the status follows', () => {
    let l: WorkoutBlock[] = fresh();
    const id = l[0].id;
    l = startBlock(l, id, 2000);
    expect(blockStatus(l[0])).toBe('running');
    l = countRound(countRound(l, id), id);
    expect(l[0].roundsDone).toBe(2);
    l = pauseBlock(l, id, 3000);
    expect(blockStatus(l[0])).toBe('paused');
    expect(countRound(l, id)[0].roundsDone).toBe(2); // not while paused
    l = resumeBlock(l, id, 4000);
    expect(blockStatus(l[0])).toBe('running');
    l = endBlock(l, id, 5000);
    expect(blockStatus(l[0])).toBe('ended');
    l = saveResult(l, id, { rounds: 7, extraReps: 4, savedAt: 6000 });
    expect(blockStatus(l[0])).toBe('logged');
    expect(startBlock(l, id, 7000)[0].run?.startedAt).toBe(2000); // a logged block never restarts
  });
  it('a result needs a started block; removing drops only that block and unknown fields survive other ops', () => {
    const l = fresh();
    expect(saveResult(l, l[0].id, { rounds: 1, savedAt: 1 })[0].result).toBeUndefined();
    const extra = [{ ...l[0], futureField: 'kept' } as WorkoutBlock];
    expect(
      (startBlock(extra, l[0].id, 5)[0] as unknown as { futureField: string }).futureField,
    ).toBe('kept');
    expect(removeBlock([...l, ...addBlock([], spec, members, 0, 9)], l[0].id)).toHaveLength(1);
  });
});
