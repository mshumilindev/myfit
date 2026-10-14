import { describe, expect, it } from 'vitest';
import { groupDecisions, monthTitle, type DecisionRow } from './decisionModel';

const row = (
  id: string,
  cid: string,
  name: string,
  at: number,
  result: DecisionRow['result'],
  kind = 'stall',
) =>
  ({
    rec: { id, clientId: cid, decidedAt: at, signal: { kind } },
    name,
    result,
    title: id,
  }) as unknown as DecisionRow;

const D = (m: number, d: number) => Date.UTC(2026, m - 1, d);
const rows = [
  row('a', 'c2', 'Maria', D(10, 6), 'measuring', 'rhythm'),
  row('b', 'c1', 'Oleh', D(10, 1), 'improved'),
  row('c', 'c2', 'Maria', D(9, 20), 'declined', 'injury'),
  row('d', 'c1', 'Oleh', D(9, 2), 'improved', 'rhythm'),
];

describe('groupDecisions', () => {
  it('none is one group in the given order', () => {
    const g = groupDecisions(rows, 'none');
    expect(g).toHaveLength(1);
    expect(g[0].rows.map((x) => x.rec.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(groupDecisions([], 'none')).toEqual([]);
  });
  it('client: A to Z, rows keep their order', () => {
    const g = groupDecisions(rows, 'client');
    expect(g.map((x) => x.rows.map((y) => y.rec.id))).toEqual([
      ['a', 'c'],
      ['b', 'd'],
    ]);
  });
  it('result: good to bad', () => {
    expect(groupDecisions(rows, 'result').map((x) => x.key)).toEqual([
      'improved',
      'measuring',
      'declined',
    ]);
  });
  it('trigger follows the signal order; month is newest first', () => {
    expect(groupDecisions(rows, 'trigger').map((x) => x.key)).toEqual([
      'stall',
      'rhythm',
      'injury',
    ]);
    expect(groupDecisions(rows, 'month').map((x) => x.key)).toEqual(['2026-10', '2026-09']);
    expect(monthTitle('2026-10', 'en')).toBe('October 2026');
  });
});
