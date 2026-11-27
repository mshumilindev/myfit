import { describe, expect, it } from 'vitest';
import { applyProgramLayer } from './clientProgram';

const BLOCK = {
  id: 'b1',
  day: 1,
  position: 0.5,
  spec: { fmt: 'amrap', capSec: 600 },
  members: [{ name: 'Burpee', reps: '8' }],
};

describe('the trainer layer carries time blocks (SPO-608, phase 2)', () => {
  it('puts the trainer blocks on the runnable program, with the writer marker', () => {
    const base = { items: [{ id: 'x' }] };
    const out = applyProgramLayer(
      base as never,
      { program: { items: [], blocks: [BLOCK] } } as never,
    ) as {
      blocks?: unknown[];
      blockV?: number;
    };
    expect(out.blocks).toEqual([BLOCK]);
    expect(out.blockV).toBe(1);
  });

  it('leaves a program without trainer blocks exactly as it was', () => {
    const base = { items: [{ id: 'x' }], blocks: [BLOCK], blockV: 1 };
    const noBlocks = applyProgramLayer(
      base as never,
      { program: { items: [] } } as never,
    ) as typeof base;
    expect(noBlocks.blocks).toEqual([BLOCK]); // the client's own blocks are not erased by a layer that has none
    const empty = applyProgramLayer(
      { items: [] } as never,
      { program: { items: [], blocks: [] } } as never,
    );
    expect(empty).not.toHaveProperty('blocks');
  });
});

describe('the trainer program document keeps its blocks as day structure (SPO-608, phase 2)', () => {
  it('runnableProgram keeps blocks with the writer marker, and marks 0 when there are none', async () => {
    const { runnableProgram } = await import('../../program/planCodec');
    const { freshProgram } = await import('../../../views/programs/model');
    const base = freshProgram('Plan');
    const meta = { id: 'prg-c-1', authorId: 't1', updatedAt: 1 };
    const withBlocks = runnableProgram({ ...base, blocks: [BLOCK] } as never, meta);
    expect(withBlocks.blocks).toEqual([BLOCK]);
    expect(withBlocks.blockV).toBe(1);
    const none = runnableProgram(base, meta);
    expect(none.blockV).toBe(0);
    expect(none.blocks).toBeUndefined();
  });
});
