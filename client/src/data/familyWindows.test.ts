import { describe, expect, it } from 'vitest';
import { FAMILIES } from '../picker';
import { LIB_VIEW_PATHS, litLibIds } from '../components/Muscle';
import { FAMILY_LIT_BOUNDS, ZOOM_PAD, familyKey, zoomViewBox } from './familyWindows';
import { pathBounds, unionBounds } from './pathBounds';

const SLOTS: [number, number][] = [
  [56, 76],
  [28, 54],
];

const litBox = (groups: (typeof FAMILIES)[number]['groups'], view: 'front' | 'back') => {
  const ids = new Set(litLibIds(groups, view));
  return unionBounds(
    LIB_VIEW_PATHS[view].filter((m) => ids.has(m.id)).map((m) => pathBounds(m.path)),
  );
};

describe('pathBounds', () => {
  it('handles relative/absolute, H/V, curves and implicit lineto', () => {
    expect(pathBounds('M1 2 h4 v3 z')).toEqual({ x0: 1, y0: 2, x1: 5, y1: 5 });
    expect(pathBounds('m 1,1 2,3 -1,1')).toEqual({ x0: 1, y0: 1, x1: 3, y1: 5 });
    expect(pathBounds('M0 0 C 0 10 10 10 10 0')).toEqual({ x0: 0, y0: 0, x1: 10, y1: 10 });
  });
});

describe('picker family zoom windows', () => {
  it.each(FAMILIES.map((f) => [f.id, f] as const))(
    '%s has a window matching its lit paths',
    (_, f) => {
      const stored = FAMILY_LIT_BOUNDS[familyKey(f.groups, f.view)];
      expect(stored).toBeDefined();
      const b = litBox(f.groups, f.view);
      for (const k of ['x0', 'y0', 'x1', 'y1'] as const) expect(stored[k]).toBeCloseTo(b[k], 2);
    },
  );

  it.each(FAMILIES.flatMap((f) => SLOTS.map((s) => [f.id, f, s] as const)))(
    '%s window contains every lit path with padding and keeps the slot aspect %j',
    (_, f, [w, h]) => {
      const vb = zoomViewBox(f.groups, f.view, w, h)!;
      expect(vb).not.toBeNull();
      const [x, y, vw, vh] = vb.split(' ').map(Number);
      expect(vw / vh).toBeCloseTo(w / h, 2);
      const b = litBox(f.groups, f.view);
      const eps = 0.01;
      expect(x).toBeLessThanOrEqual(b.x0 + eps);
      expect(y).toBeLessThanOrEqual(b.y0 + eps);
      expect(x + vw).toBeGreaterThanOrEqual(b.x1 - eps);
      expect(y + vh).toBeGreaterThanOrEqual(b.y1 - eps);
      // at least the 18% padding on the tighter axis; never wider than the full figure by much
      const bw = b.x1 - b.x0;
      const bh = b.y1 - b.y0;
      expect(vw).toBeGreaterThanOrEqual(bw * (1 + 2 * ZOOM_PAD) - eps);
      expect(vh).toBeGreaterThanOrEqual(bh * (1 + 2 * ZOOM_PAD) - eps);
      expect(vh).toBeLessThan(96.5); // tighter than the full figure
      expect(vw / vh).toBeGreaterThan(0.2);
      expect(vw / vh).toBeLessThan(2);
    },
  );

  it('returns null for unknown groups or an empty slot', () => {
    expect(zoomViewBox(['cardio'], 'front', 56, 76)).toBeNull();
    expect(zoomViewBox(['chest'], 'front', 0, 76)).toBeNull();
  });
});
