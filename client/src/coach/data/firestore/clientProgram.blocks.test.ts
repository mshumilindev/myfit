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
