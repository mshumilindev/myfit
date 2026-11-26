import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { diffPrograms } from './diff';
import { emptyDoc, type ProgramBlockDoc, type ProgramDoc } from './doc';
import {
  addBlock,
  addItem,
  clearDay,
  copyDay,
  dayBlocks,
  importDay,
  removeBlock,
  setIdGenerator,
  toMusclesMode,
  updateBlock,
} from './ops';
import { demoCatalog } from '../stories/demoHost';

let n = 0;
beforeEach(() => {
  n = 0;
  setIdGenerator(() => `id-${++n}`);
});
afterEach(() => setIdGenerator());

const spec = { fmt: 'amrap', capSec: 600 } as const;
const members = [{ name: 'Pullups', reps: '5' }];
function withDay(): ProgramDoc {
  let d = emptyDoc('P');
  d = { ...d, dayNames: { '1': 'Upper A' } };
  d = addItem(d, {
    day: 1,
    name: 'Bench Press',
    kind: 'strength',
    sets: 3,
    reps: 5,
    durationMin: null,
    equipment: [],
  });
  return d;
}

describe('program time blocks in the editor ops', () => {
  it('adds, edits and removes a block; no blocks leaves no key', () => {
    let d = addBlock(withDay(), 1, { spec, members }, null);
    expect(dayBlocks(d, 1)).toHaveLength(1);
    expect(dayBlocks(d, 1)[0].afterItemId).toBeNull();
    const id = dayBlocks(d, 1)[0].id;
    d = updateBlock(d, id, { spec: { fmt: 'amrap', capSec: 900 } });
    expect(dayBlocks(d, 1)[0].spec.capSec).toBe(900);
    d = removeBlock(d, id);
    expect('blocks' in d).toBe(false);
  });

  it('copyDay gives the copy its own blocks (new ids, following the copied row); clearDay and toMusclesMode drop them', () => {
    const base = withDay();
    const rowId = base.items[0].id;
    const d = addBlock(base, 1, { spec, members }, rowId);
    const c = copyDay(d, 1, 3);
    const copied = dayBlocks(c, 3)[0] as ProgramBlockDoc;
    expect(copied.id).not.toBe(dayBlocks(c, 1)[0].id);
    expect(copied.afterItemId).toBe(c.items.find((i) => i.day === 3)!.id);
    expect(dayBlocks(c, 1)).toHaveLength(1);
    expect(dayBlocks(clearDay(c, 3), 3)).toHaveLength(0);
    expect(dayBlocks(clearDay(c, 3), 1)).toHaveLength(1);
    expect(dayBlocks(toMusclesMode(d, 1, demoCatalog), 1)).toHaveLength(0);
  });

  it('importDay brings the source day blocks along', () => {
    const src = addBlock(withDay(), 1, { spec, members }, null);
    const out = importDay(emptyDoc('Q'), 5, src, 1);
    expect(dayBlocks(out, 5)).toHaveLength(1);
    expect(dayBlocks(out, 5)[0].id).not.toBe(dayBlocks(src, 1)[0].id);
  });

  it('a changed block shows in the version diff, once', () => {
    const live = addBlock(withDay(), 1, { spec, members }, null);
    const draft = updateBlock(live, dayBlocks(live, 1)[0].id, {
      spec: { fmt: 'amrap', capSec: 900 },
    });
    expect(
      diffPrograms(live, draft).filter((c) => c.op === 'change' && c.what === 'blocks'),
    ).toHaveLength(1);
  });
});
