// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isSealed, sealDoc, unsealDoc } from '../encryptedDoc';
import { readyVault } from '../testVault';
import { addBlock, saveResult, startBlock } from './blockOps';

/** R18/R68: a block lives inside the sealed session — none of it is readable in the stored document, all of it comes back. */
describe('time blocks in a sealed session', () => {
  it('seals the blocks with the workout and opens them unchanged (unknown fields survive)', async () => {
    const v = await readyVault();
    const { key, salt } = v.material();
    let blocks = addBlock(
      [],
      { fmt: 'amrap', capSec: 720 },
      [{ name: 'Secret Move', reps: '5' }],
      2,
      1000,
    );
    blocks = startBlock(blocks, blocks[0].id, 2000);
    blocks = saveResult(blocks, blocks[0].id, { rounds: 7, extraReps: 3, savedAt: 3000 });
    const w = {
      id: 'w1',
      startedAt: 1,
      finishedAt: null,
      autoFinished: false,
      exercises: [],
      blocks,
      futureField: 1,
    };
    const stored = await sealDoc('workouts', w, key, salt);
    expect(isSealed(stored)).toBe(true);
    expect(JSON.stringify(stored)).not.toContain('Secret Move');
    expect(stored).not.toHaveProperty('blocks');
    expect(await unsealDoc(stored as unknown as Record<string, unknown>, key)).toEqual(w);
  });
});
