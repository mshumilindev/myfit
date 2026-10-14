import { describe, expect, it } from 'vitest';
import { computePopoverPosition } from './popoverPosition';

const vp = { width: 1000, height: 700 };
const panel = { width: 200, height: 150 };
const a = (left: number, top: number, width = 100, height = 40) => ({ left, top, width, height });

describe('computePopoverPosition', () => {
  it('places below the anchor, start aligned, with the offset', () => {
    const p = computePopoverPosition({ anchor: a(300, 100), panel, viewport: vp });
    expect(p).toMatchObject({ side: 'bottom', left: 300, top: 148 });
  });

  it('aligns to the end and centre', () => {
    expect(
      computePopoverPosition({ anchor: a(300, 100), panel, viewport: vp, align: 'end' }).left,
    ).toBe(200);
    expect(
      computePopoverPosition({ anchor: a(300, 100), panel, viewport: vp, align: 'center' }).left,
    ).toBe(250);
  });

  it('flips to the top when the bottom is too tight and the top has more room', () => {
    const p = computePopoverPosition({ anchor: a(300, 640), panel, viewport: vp });
    expect(p.side).toBe('top');
    expect(p.top).toBe(640 - 8 - 150);
  });

  it('does not flip when flip is off', () => {
    const p = computePopoverPosition({ anchor: a(300, 640), panel, viewport: vp, flip: false });
    expect(p.side).toBe('bottom');
    expect(p.maxHeight).toBeLessThan(150);
  });

  it('clamps horizontally into the viewport margin', () => {
    const right = computePopoverPosition({ anchor: a(950, 100, 40), panel, viewport: vp });
    expect(right.left + panel.width).toBeLessThanOrEqual(vp.width - 8);
    const left = computePopoverPosition({ anchor: a(-20, 100, 40), panel, viewport: vp });
    expect(left.left).toBe(8);
  });

  it('places to the right of a rail item and flips left at the right edge', () => {
    const r = computePopoverPosition({
      anchor: a(0, 300, 60, 44),
      panel,
      viewport: vp,
      side: 'right',
      align: 'center',
    });
    expect(r).toMatchObject({ side: 'right', left: 68 });
    const l = computePopoverPosition({
      anchor: a(900, 300, 60, 44),
      panel,
      viewport: vp,
      side: 'right',
    });
    expect(l.side).toBe('left');
    expect(l.left).toBe(900 - 8 - 200);
  });

  it('keeps a tall panel inside the viewport vertically for side placements', () => {
    const p = computePopoverPosition({
      anchor: a(0, 650, 60, 44),
      panel: { width: 200, height: 400 },
      viewport: vp,
      side: 'right',
    });
    expect(p.top + 400).toBeLessThanOrEqual(vp.height - 8);
  });

  it('points the arrow at the anchor centre, kept off the corners', () => {
    const p = computePopoverPosition({ anchor: a(300, 100), panel, viewport: vp });
    expect(p.arrow).toBe(50);
    const edge = computePopoverPosition({ anchor: a(0, 100, 10), panel, viewport: vp });
    expect(edge.arrow).toBeGreaterThanOrEqual(14);
  });
});
