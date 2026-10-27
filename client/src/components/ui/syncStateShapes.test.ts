import { describe, expect, it } from 'vitest';
import { N, SEGMENTS, SHAPES, SYNC_ICON_STATES, blend, pieces } from './syncStateShapes';

describe('syncStateShapes', () => {
  it('every state is one stroke of N finite points inside the 24 grid', () => {
    for (const s of SYNC_ICON_STATES) {
      expect(SHAPES[s]).toHaveLength(N);
      for (const [x, y] of SHAPES[s]) {
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(24);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(24);
      }
    }
  });

  it('blend starts at `from`, ends at `to`, and never produces NaN, for every pair', () => {
    for (const a of SYNC_ICON_STATES) {
      for (const b of SYNC_ICON_STATES) {
        const start = blend(SHAPES[a], SHAPES[b], 0);
        const end = blend(SHAPES[a], SHAPES[b], 1);
        for (let i = 0; i < N; i++) {
          expect(start[i][0]).toBeCloseTo(SHAPES[a][i][0], 6);
          expect(start[i][1]).toBeCloseTo(SHAPES[a][i][1], 6);
          expect(end[i][0]).toBeCloseTo(SHAPES[b][i][0], 6);
          expect(end[i][1]).toBeCloseTo(SHAPES[b][i][1], 6);
        }
        for (const t of [0.2, 0.5, 0.8]) {
          for (const [x, y] of blend(SHAPES[a], SHAPES[b], t)) {
            expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
          }
        }
      }
    }
  });

  it('pieces: fixed count, widths swell to the middle and stay thin (0.3 to 1.6)', () => {
    const ps = pieces(SHAPES.synced);
    expect(ps).toHaveLength(SEGMENTS);
    const mid = ps[Math.floor(SEGMENTS / 2)].w;
    expect(mid).toBeGreaterThan(ps[0].w);
    expect(mid).toBeGreaterThan(ps[SEGMENTS - 1].w);
    for (const p of ps) {
      expect(p.w).toBeGreaterThanOrEqual(0.3);
      expect(p.w).toBeLessThanOrEqual(1.6);
      expect(p.d.startsWith('M')).toBe(true);
    }
  });
});
