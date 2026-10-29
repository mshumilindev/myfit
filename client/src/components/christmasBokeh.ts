/**
 * Christmas background layout (SPO-393): out-of-focus golden lights (bokeh). Gold is the base of the theme; accent-coloured
 * discs on top carry the app's colour code by COLOUR (the app accent) and by COUNT (`ACCENT_COUNT` per app, applied in CSS from
 * `--xb-n`). Deterministic (seeded), so the picture is the same on every start and in every test.
 */
export interface Bokeh {
  /** gold base, or accent (a) / light accent (b) */
  tone: 'gold' | 'amber' | 'a' | 'b';
  x: number; // % of the width
  y: number; // % of the scene height
  size: number; // px (at 390 px width)
  blur: number; // px
  op: number; // resting opacity 0..1
  drift: number; // s
  breathe: number; // s
  delay: number; // s (negative: already running at the first frame)
  /** accent discs: 1-based order in which an app "unlocks" them (CSS compares it with --xb-n) */
  k?: number;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GOLD_COUNT = 30;
const ACCENT_TOTAL = 14;

function make(seed: number, n: number, tones: Bokeh['tone'][], accent: boolean): Bokeh[] {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const size = 14 + r() * 52;
    return {
      tone: tones[Math.floor(r() * tones.length)],
      x: r() * 100,
      y: r() * 100,
      size,
      blur: 1 + r() * 4,
      op: 0.16 + r() * 0.34,
      drift: 16 + r() * 22,
      breathe: 4 + r() * 6,
      delay: -r() * 30,
      ...(accent ? { k: i + 1 } : {}),
    };
  });
}

export const BOKEH: readonly Bokeh[] = [
  ...make(7, GOLD_COUNT, ['gold', 'gold', 'amber'], false),
  ...make(21, ACCENT_TOTAL, ['a', 'a', 'b'], true),
];
