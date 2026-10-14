/**
 * Coach frame variables as numbers (R-FE-004). `frame.css` is the CSS source;
 * `frame.test.ts` pins the two together and checks the plan's widths
 * (1440 -> 1288, 1280 -> 1128, 1024 -> 900, 390 -> 358).
 */
import { COACH_BREAKPOINT, COACH_WIDE_BREAKPOINT } from '../../components/ui/breakpoints';

/** Content never grows past this on very wide screens. */
export const FRAME_MAX = 1360;

export interface FrameVars {
  rail: number;
  pad: number;
  gut: number;
  frame: number;
  insp: number;
  dockW: number;
  dockInset: number;
  dockClear: number;
}

export type FrameBand = 'wide' | 'mid' | 'phone';

export function frameBand(viewportWidth: number): FrameBand {
  if (viewportWidth >= COACH_WIDE_BREAKPOINT) return 'wide';
  if (viewportWidth >= COACH_BREAKPOINT) return 'mid';
  return 'phone';
}

/** The per-band constants (everything except `frame`, which depends on the viewport). */
export const FRAME_BANDS: Record<FrameBand, Omit<FrameVars, 'frame'>> = {
  wide: { rail: 88, pad: 32, gut: 24, insp: 416, dockW: 440, dockInset: 16, dockClear: 96 },
  mid: { rail: 60, pad: 32, gut: 24, insp: 340, dockW: 0, dockInset: 0, dockClear: 0 },
  phone: { rail: 0, pad: 16, gut: 16, insp: 0, dockW: 0, dockInset: 0, dockClear: 0 },
};

export function frameVars(viewportWidth: number): FrameVars {
  const band = FRAME_BANDS[frameBand(viewportWidth)];
  const frame = Math.min(FRAME_MAX, viewportWidth - band.rail - 2 * band.pad);
  return { ...band, frame };
}
