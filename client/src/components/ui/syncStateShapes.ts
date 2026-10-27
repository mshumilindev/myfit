/**
 * Geometry and tween maths for `SyncStateIcon` (SPO-375). Pure functions, no DOM.
 *
 * Every state is ONE continuous stroke (a polyline of `N` points on a 24 grid). A state change
 * re-routes that same stroke into the next shape, so nothing is swapped or cross-faded.
 * The stroke is drawn as `SEGMENTS` consecutive path pieces whose width swells towards the middle
 * (a calligraphy pen): the component only writes `d` and `stroke-width` of those pieces.
 */
export type SyncIconState =
  'synced' | 'syncing' | 'saving' | 'slow' | 'offline' | 'stale' | 'failed' | 'locked';

export const SYNC_ICON_STATES: readonly SyncIconState[] = [
  'synced',
  'syncing',
  'saving',
  'slow',
  'offline',
  'stale',
  'failed',
  'locked',
];

export type Pt = readonly [number, number];

/** Points per stroke. */
export const N = 96;
/** Path pieces per stroke (width steps). */
export const SEGMENTS = 13;
const WIDTH_MIN = 0.3;
const WIDTH_SPAN = 1.3;
/** How much of the transition is spent staggering the points (0 = all at once). */
export const SPREAD = 0.35;
export const DURATION_MS = 1300;
/** Degrees per millisecond of the endless turn while syncing. */
export const SPIN_PER_MS = 0.13;

const RAD = Math.PI / 180;

function arc(cx: number, cy: number, r: number, a0: number, a1: number, steps: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (a0 + ((a1 - a0) * i) / steps) * RAD;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

function head(x: number, y: number, deg: number): Pt[] {
  const a = deg * RAD;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const px = -uy;
  const py = ux;
  return [
    [x - ux * 2.6 + px * 2.2, y - uy * 2.6 + py * 2.2],
    [x, y],
    [x - ux * 2.6 - px * 2.2, y - uy * 2.6 - py * 2.2],
  ];
}

function spiral(): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= 70; i++) {
    const t = i / 70;
    const r = 9 - 7.3 * t;
    const a = (t * 2.2 * 360 - 90) * RAD;
    out.push([12 + r * Math.cos(a), 12 + r * Math.sin(a)]);
  }
  return out;
}

const circArrow = arc(12, 12, 7.5, -40, 250, 48);
const tip = circArrow[circArrow.length - 1];

/** Raw outlines, one per state. */
const RAW: Record<SyncIconState, Pt[]> = {
  synced: [
    [6, 12.5],
    [10.5, 17],
    [18.5, 7],
  ],
  syncing: circArrow.concat(head(tip[0], tip[1], 340)),
  saving: [
    [12, 19.5],
    [12, 5],
    [6.8, 10.2],
    [12, 5],
    [17.2, 10.2],
  ],
  slow: [
    [7, 4.5],
    [17, 4.5],
    [7, 19.5],
    [17, 19.5],
    [7, 4.5],
  ],
  offline: arc(12, 12, 8.5, 225, 585, 60).concat([[18.01, 18.01]]),
  stale: spiral(),
  failed: [
    [13.5, 3],
    [6.5, 13.5],
    [12.2, 13.5],
    [10.5, 21],
    [17.5, 10],
    [12, 10],
    [13.5, 3],
  ],
  locked: [
    [9, 12],
    [9, 8.5],
    ...arc(12, 8.5, 3, 180, 360, 14),
    [15, 12],
    [18, 12],
    [18, 20],
    [6, 20],
    [6, 12],
    [9, 12],
  ],
};

/** Resample a polyline to `n` points evenly spaced along its length. */
export function resample(pts: readonly Pt[], n: number): Pt[] {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const total = cum[cum.length - 1];
  const out: Pt[] = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const t = (total * k) / (n - 1);
    while (j < pts.length - 1 && cum[j] < t) j++;
    const seg = cum[j] - cum[j - 1] || 1;
    const u = Math.min(1, Math.max(0, (t - cum[j - 1]) / seg));
    out.push([
      pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * u,
      pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * u,
    ]);
  }
  return out;
}

export const SHAPES: Record<SyncIconState, Pt[]> = Object.fromEntries(
  SYNC_ICON_STATES.map((s) => [s, resample(RAW[s], N)]),
) as Record<SyncIconState, Pt[]>;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Cubic ease in-out. */
export function ease(p: number): number {
  return p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
}

/**
 * The stroke part-way between two shapes. `el` is the elapsed fraction (0..1) of the whole
 * transition; the points start one after another along the stroke (a wave), like a snake turning.
 */
export function blend(from: readonly Pt[], to: readonly Pt[], el: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < N; i++) {
    const q = clamp01((el - (i / (N - 1)) * SPREAD) / (1 - SPREAD));
    const e = ease(q);
    out.push([from[i][0] + (to[i][0] - from[i][0]) * e, from[i][1] + (to[i][1] - from[i][1]) * e]);
  }
  return out;
}

/** Path pieces (`d` + width) for one stroke. */
export function pieces(p: readonly Pt[]): { d: string; w: number }[] {
  const out: { d: string; w: number }[] = [];
  for (let k = 0; k < SEGMENTS; k++) {
    const a = Math.floor((k * (N - 1)) / SEGMENTS);
    const b = Math.floor(((k + 1) * (N - 1)) / SEGMENTS);
    let d = '';
    for (let i = a; i <= b; i++)
      d += `${i === a ? 'M' : 'L'}${p[i][0].toFixed(2)} ${p[i][1].toFixed(2)} `;
    out.push({ d, w: WIDTH_MIN + WIDTH_SPAN * Math.sin((Math.PI * (k + 0.5)) / SEGMENTS) ** 1.3 });
  }
  return out;
}
