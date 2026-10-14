import { describe, expect, it } from 'vitest';
import { placeBlocks } from './view';
import { dayOfTs, tsOf } from './time';

const D = dayOfTs(Date.UTC(2026, 9, 7));
const at = (h: number, m = 0) => tsOf(D, h * 60 + m);
const ev = (id: string, s: number, e: number) => ({ id, start: s, end: e });
const pack = (xs: ReturnType<typeof ev>[]) =>
  placeBlocks(xs, (x) => x, 7 * 60, 21 * 60).map((b) => ({
    id: b.item.id,
    lane: b.lane,
    lanes: b.lanes,
    span: b.span,
    first: b.first,
    size: b.size,
    cluster: b.cluster,
  }));

describe('calendar column packing', () => {
  it('a lone session fills the column', () => {
    expect(pack([ev('a', at(9), at(10))])).toEqual([
      { id: 'a', lane: 0, lanes: 1, span: 1, first: false, size: 1, cluster: 0 },
    ]);
  });

  it('two sessions that overlap share the column equally (the 18:00 / 18:30 case)', () => {
    const r = pack([ev('a', at(18), at(18, 45)), ev('b', at(18, 30), at(19, 15))]);
    expect(r.map((x) => [x.id, x.lane, x.lanes, x.span])).toEqual([
      ['a', 0, 2, 1],
      ['b', 1, 2, 1],
    ]);
    expect(r.filter((x) => x.first).map((x) => x.id)).toEqual(['a']); // one marker per cluster
  });

  it('sessions that only touch (one ends when the next starts) do not share a column', () => {
    const r = pack([ev('a', at(9), at(10)), ev('b', at(10), at(11))]);
    expect(r.every((x) => x.lanes === 1 && x.span === 1 && !x.first)).toBe(true);
    expect(new Set(r.map((x) => x.cluster)).size).toBe(2);
  });

  it('a block grows into free columns to the right (it is not squeezed to its lane)', () => {
    // 09-12 long one, 09-10 b, 09:00-09:30 d, then c 10-11: c reuses a column freed by an earlier session and widens
    // into the next free one, but stops at the long session's column
    const r = pack([
      ev('long', at(9), at(12)),
      ev('b', at(9), at(10)),
      ev('c', at(10), at(11)),
      ev('d', at(9), at(9, 30)),
    ]);
    const by = Object.fromEntries(r.map((x) => [x.id, x]));
    expect(by.long.lanes).toBe(3);
    expect(by.long.span).toBe(1);
    expect(by.c.lane).toBe(0);
    expect(by.c.span).toBe(2);
    expect(by.c.lane + by.c.span).toBeLessThanOrEqual(by.long.lane);
  });

  it('three concurrent sessions: three equal columns, one cluster, one marker', () => {
    const r = pack([
      ev('a', at(9), at(10)),
      ev('b', at(9, 15), at(10)),
      ev('c', at(9, 30), at(10, 30)),
    ]);
    expect(r.map((x) => x.lanes)).toEqual([3, 3, 3]);
    expect(r.filter((x) => x.first)).toHaveLength(1);
    expect(r.every((x) => x.size === 3)).toBe(true);
  });

  it('top and height are fractions of the visible range', () => {
    const [b] = placeBlocks([ev('a', at(9), at(10))], (x) => x, 7 * 60, 21 * 60);
    expect(b.top).toBeCloseTo(2 / 14, 6);
    expect(b.height).toBeCloseTo(1 / 14, 6);
  });
});
