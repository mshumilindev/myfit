import type { MuscleGroup } from './exercises';
import type { Box } from './pathBounds';

/**
 * Zoom windows for the exercise picker's muscle-family tiles: the bounding box
 * (library coordinate space) of every lit path of a family, per view. Precomputed
 * from the `body-muscles` paths (see familyWindows.test.ts, which recomputes and
 * compares) so nothing depends on DOM getBBox at runtime.
 */
export type BodyView = 'front' | 'back';

export const familyKey = (groups: readonly MuscleGroup[], view: BodyView): string =>
  `${view}:${groups
    .filter((g) => g !== 'cardio')
    .sort()
    .join(',')}`;

export const FAMILY_LIT_BOUNDS: Record<string, Box> = {
  'front:chest': { x0: 7.732, y0: 17.085, x1: 23.957, y1: 25.823 },
  'back:back,lats,lower_back,traps': { x0: 39.426, y0: 12.005, x1: 65.29, y1: 42.03 },
  'front:shoulders': { x0: 3.784, y0: 13.248, x1: 27.889, y1: 23.687 },
  'front:biceps,forearms,triceps': { x0: 2.035, y0: 21.133, x1: 29.496, y1: 43.268 },
  'front:abductors,adductors,calves,glutes,hamstrings,quads': {
    x0: 7.068,
    y0: 38.791,
    x1: 24.62,
    y1: 86.746,
  },
  'front:core': { x0: 8.789, y0: 24.746, x1: 22.899, y1: 44.92 },
};

/** Tile padding around the lit muscles, as a fraction of the lit box. */
export const ZOOM_PAD = 0.18;

/**
 * viewBox cropped to the lit bounds + padding, grown (never shrunk) to the
 * slot's aspect ratio so no lit muscle is ever cut. null → no window known.
 */
export function zoomViewBox(
  groups: readonly MuscleGroup[],
  view: BodyView,
  slotW: number,
  slotH: number,
): string | null {
  const b = FAMILY_LIT_BOUNDS[familyKey([...groups], view)];
  if (!b || !(slotW > 0) || !(slotH > 0)) return null;
  let w = (b.x1 - b.x0) * (1 + 2 * ZOOM_PAD);
  let h = (b.y1 - b.y0) * (1 + 2 * ZOOM_PAD);
  const aspect = slotW / slotH;
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return `${r(cx - w / 2)} ${r(cy - h / 2)} ${r(w)} ${r(h)}`;
}
