import { describe, expect, it } from 'vitest';
import { freshProgram, normalizeProgram, toSaved } from './model';
import { MAX_BLOCKS_PER_DAY, dayBlocks, sanitizeProgramBlocks } from './programBlocks';

const blk = (o: Record<string, unknown> = {}) => ({
  id: 'b1',
  day: 1,
  position: 0,
  spec: { fmt: 'amrap', capSec: 720 },
  members: [{ name: 'Pullups', reps: '5' }],
  ...o,
});

describe('program time blocks', () => {
  it('keeps a valid block and drops malformed ones', () => {
    const out = sanitizeProgramBlocks([
      blk(),
      blk({ id: 'x', day: 9 }),
      blk({ id: 'y', spec: { fmt: 'amrap' } }),
      blk({ id: 'z', spec: { fmt: 'nope' } }),
      blk({ id: 'm', members: [] }),
      'junk',
      null,
    ]);
    expect(out.map((b) => b.id)).toEqual(['b1']);
    expect(sanitizeProgramBlocks('x')).toEqual([]);
  });

  it('caps the blocks per day and the members, and trims names', () => {
    const many = Array.from({ length: MAX_BLOCKS_PER_DAY + 2 }, (_, i) => blk({ id: `b${i}` }));
    expect(sanitizeProgramBlocks(many)).toHaveLength(MAX_BLOCKS_PER_DAY);
    const big = sanitizeProgramBlocks([
      blk({ members: Array.from({ length: 20 }, (_, i) => ({ name: ` M${i} `, reps: '5' })) }),
    ]);
    expect(big[0].members).toHaveLength(8);
    expect(big[0].members[0].name).toBe('M0');
  });

  it('save and normalize keep the blocks, and mark them with blockV', () => {
    const p = { ...freshProgram('P'), blocks: sanitizeProgramBlocks([blk({ afterItemId: 'r1' })]) };
    const saved = toSaved(p, 'u1', 'P');
    expect(saved.blocks).toHaveLength(1);
    expect(saved.blocks?.[0].afterItemId).toBe('r1');
    expect(saved.blockV).toBe(1);
    expect(normalizeProgram(saved).blocks).toEqual(saved.blocks);
    const none = toSaved(freshProgram('P'), 'u1', 'P');
    expect(none.blocks).toBeUndefined();
    expect(none.blockV).toBe(0); // "none, on purpose": the rules let this through
  });

  it('lists a day in order', () => {
    const p = { blocks: sanitizeProgramBlocks([blk({ id: 'a' }), blk({ id: 'b', day: 2 })]) };
    expect(dayBlocks(p, 1).map((b) => b.id)).toEqual(['a']);
  });
});
