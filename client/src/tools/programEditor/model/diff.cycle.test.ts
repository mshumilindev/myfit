import { describe, expect, it } from 'vitest';
import { demoDoc } from '../stories/demoHost';
import { diffPrograms } from './diff';
import type { ProgramDoc, ProgramItemDoc } from './doc';

type Cycled = ProgramDoc & {
  cycle?: {
    length: number;
    weeks: Array<Pick<ProgramDoc, 'items' | 'dayNames' | 'targetMuscles'>>;
  };
};
const withCycle = (d: ProgramDoc, items: ProgramItemDoc[][]): Cycled => ({
  ...d,
  cycle: {
    length: items.length + 1,
    weeks: items.map((it) => ({ items: it, dayNames: d.dayNames, targetMuscles: d.targetMuscles })),
  },
});

describe('diff of a program with a weekly cycle', () => {
  const base = demoDoc();
  const row = base.items.find((i) => i.kind === 'strength')!;

  it('a percent of max or a rep range changing is a weight / reps change of the row', () => {
    const live = {
      ...base,
      items: base.items.map((i) => (i.id === row.id ? { ...i, targetPct: 70 } : i)),
    };
    const pct = {
      ...live,
      items: live.items.map((i) => (i.id === row.id ? { ...i, targetPct: 75 } : i)),
    };
    expect(diffPrograms(live, pct)).toEqual([
      { op: 'change', day: row.day, name: row.name, what: 'weight' },
    ]);
    const range = {
      ...live,
      items: live.items.map((i) =>
        i.id === row.id ? { ...i, repsMin: Math.max(1, row.reps - 2) } : i,
      ),
    };
    expect(diffPrograms(live, range)).toEqual([
      { op: 'change', day: row.day, name: row.name, what: 'reps' },
    ]);
  });

  it('an edit in a later week is seen (the version is not an empty one)', () => {
    const w2 = base.items.map((i) => ({ ...i, id: `w2-${i.id}` }));
    const live = withCycle(base, [w2]);
    const draft = withCycle(base, [w2.map((i, k) => (k === 0 ? { ...i, sets: i.sets + 1 } : i))]);
    const d = diffPrograms(live, draft);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ op: 'change', what: 'sets' });
  });

  it('a week added to the cycle shows its rows as added; a week removed, as removed', () => {
    const w2 = base.items.map((i) => ({ ...i, id: `w2-${i.id}` }));
    const strength = w2.filter((i) => i.kind === 'strength').length;
    expect(diffPrograms(base, withCycle(base, [w2])).filter((c) => c.op === 'add')).toHaveLength(
      strength,
    );
    expect(diffPrograms(withCycle(base, [w2]), base).filter((c) => c.op === 'remove')).toHaveLength(
      strength,
    );
  });

  it('no cycle on either side: exactly the old result', () => {
    expect(diffPrograms(base, base)).toEqual([]);
  });
});
