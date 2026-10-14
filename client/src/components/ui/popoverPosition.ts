/**
 * Pure placement maths for `Popover` (R-KIT-28): preferred side, alignment on
 * the cross axis, flip to the roomier side when the panel does not fit, clamp
 * into the viewport and cap the height. No DOM access, so it is unit-tested.
 */
export type PopoverSide = 'top' | 'bottom' | 'left' | 'right';
export type PopoverAlign = 'start' | 'center' | 'end';

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PlaceInput {
  anchor: RectLike;
  panel: { width: number; height: number };
  viewport: { width: number; height: number };
  side?: PopoverSide;
  align?: PopoverAlign;
  /** Gap between anchor and panel (room for the arrow). */
  offset?: number;
  /** Minimum distance to the viewport edge. */
  margin?: number;
  /** Flip to the opposite side when the preferred one is too tight. Default true. */
  flip?: boolean;
}

export interface Placement {
  left: number;
  top: number;
  /** The side actually used (after a flip). */
  side: PopoverSide;
  /** Height cap so the panel scrolls instead of leaving the viewport. */
  maxHeight: number;
  /** Where the arrow sits along the panel edge, px from the panel's start. */
  arrow: number;
}

const OPPOSITE: Record<PopoverSide, PopoverSide> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

const clamp = (n: number, min: number, max: number): number =>
  Math.min(Math.max(n, min), Math.max(min, max));

/** Free room on a side of the anchor, after the offset and the viewport margin. */
function room(side: PopoverSide, a: RectLike, v: PlaceInput['viewport'], gap: number, m: number) {
  switch (side) {
    case 'top':
      return a.top - gap - m;
    case 'bottom':
      return v.height - (a.top + a.height) - gap - m;
    case 'left':
      return a.left - gap - m;
    case 'right':
      return v.width - (a.left + a.width) - gap - m;
  }
}

export function computePopoverPosition(input: PlaceInput): Placement {
  const { anchor: a, panel: p, viewport: v } = input;
  const gap = input.offset ?? 8;
  const m = input.margin ?? 8;
  const align = input.align ?? 'start';
  let side = input.side ?? 'bottom';

  const vertical = (s: PopoverSide) => s === 'top' || s === 'bottom';
  const need = (s: PopoverSide) => (vertical(s) ? p.height : p.width);
  if (input.flip !== false && room(side, a, v, gap, m) < need(side)) {
    const alt = OPPOSITE[side];
    if (room(alt, a, v, gap, m) > room(side, a, v, gap, m)) side = alt;
  }

  let left: number;
  let top: number;
  if (vertical(side)) {
    top =
      side === 'bottom'
        ? a.top + a.height + gap
        : a.top - gap - Math.min(p.height, room(side, a, v, gap, m));
    left =
      align === 'start'
        ? a.left
        : align === 'end'
          ? a.left + a.width - p.width
          : a.left + (a.width - p.width) / 2;
    left = clamp(left, m, v.width - p.width - m);
  } else {
    left = side === 'right' ? a.left + a.width + gap : a.left - gap - p.width;
    top =
      align === 'start'
        ? a.top
        : align === 'end'
          ? a.top + a.height - p.height
          : a.top + (a.height - p.height) / 2;
    top = clamp(top, m, v.height - Math.min(p.height, v.height - 2 * m) - m);
  }

  const maxHeight = vertical(side)
    ? Math.max(0, room(side, a, v, gap, m))
    : Math.max(0, v.height - 2 * m);
  if (vertical(side) && side === 'top') top = Math.max(m, top);

  const arrowRaw = vertical(side) ? a.left + a.width / 2 - left : a.top + a.height / 2 - top;
  const span = vertical(side) ? p.width : Math.min(p.height, maxHeight);
  const arrow = clamp(arrowRaw, 14, span - 14);

  return {
    left: Math.round(left),
    top: Math.round(top),
    side,
    maxHeight: Math.floor(maxHeight),
    arrow: Math.round(arrow),
  };
}
