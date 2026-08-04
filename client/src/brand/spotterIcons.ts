/**
 * Spotter brand icon URLs (served from /icons + /favicon).
 * Canonical pack: brand/icons/ — regenerated from source/logo.png
 * via scripts/generate-brand-icons.py.
 *
 * - UI glyphs: transparent (CSS plate = --color-accent-100 via SpotterMark)
 * - install / PWA / favicon / desktop: baked on accent-100 plate
 * - rail / narrow nav: sidebar glyph + CSS plate
 */
const I = (name: string) => `/icons/${name}`;
const F = (name: string) => `/favicon/${name}`;

function pickSrc(map: Record<number, string>, px: number): string {
  const sizes = Object.keys(map)
    .map(Number)
    .sort((a, b) => a - b);
  const hit = sizes.find((s) => s >= px) ?? sizes[sizes.length - 1]!;
  return map[hit]!;
}

export const spotterIcons = {
  /** Transparent glyph with padding — cards / larger surfaces. */
  glyph: {
    16: I('spotter-glyph-16.png'),
    20: I('spotter-glyph-20.png'),
    24: I('spotter-glyph-24.png'),
    28: I('spotter-glyph-28.png'),
    32: I('spotter-glyph-32.png'),
    36: I('spotter-glyph-36.png'),
    40: I('spotter-glyph-40.png'),
    44: I('spotter-glyph-44.png'),
    48: I('spotter-glyph-48.png'),
    56: I('spotter-glyph-56.png'),
    64: I('spotter-glyph-64.png'),
    72: I('spotter-glyph-72.png'),
    80: I('spotter-glyph-80.png'),
    96: I('spotter-glyph-96.png'),
    128: I('spotter-glyph-128.png'),
    192: I('spotter-glyph-192.png'),
    256: I('spotter-glyph-256.png'),
    512: I('spotter-glyph-512.png'),
  },
  /** Nearly full-bleed transparent — small CSS sizes stay detailed. */
  glyphTight: {
    16: I('spotter-glyph-tight-16.png'),
    20: I('spotter-glyph-tight-20.png'),
    24: I('spotter-glyph-tight-24.png'),
    28: I('spotter-glyph-tight-28.png'),
    32: I('spotter-glyph-tight-32.png'),
    36: I('spotter-glyph-tight-36.png'),
    40: I('spotter-glyph-tight-40.png'),
    44: I('spotter-glyph-tight-44.png'),
    48: I('spotter-glyph-tight-48.png'),
    56: I('spotter-glyph-tight-56.png'),
    64: I('spotter-glyph-tight-64.png'),
    72: I('spotter-glyph-tight-72.png'),
    80: I('spotter-glyph-tight-80.png'),
    96: I('spotter-glyph-tight-96.png'),
    128: I('spotter-glyph-tight-128.png'),
    192: I('spotter-glyph-tight-192.png'),
    256: I('spotter-glyph-tight-256.png'),
    512: I('spotter-glyph-tight-512.png'),
  },
  /** Narrow rail / tab slots. */
  sidebar: {
    24: I('spotter-sidebar-24.png'),
    28: I('spotter-sidebar-28.png'),
    32: I('spotter-sidebar-32.png'),
    36: I('spotter-sidebar-36.png'),
    40: I('spotter-sidebar-40.png'),
    48: I('spotter-sidebar-48.png'),
    56: I('spotter-sidebar-56.png'),
    64: I('spotter-sidebar-64.png'),
  },
  pwa: {
    192: I('spotter-pwa-192.png'),
    512: I('spotter-pwa-512.png'),
  },
  maskable: {
    192: I('spotter-maskable-192.png'),
    512: I('spotter-maskable-512.png'),
  },
  favicon: {
    ico: F('favicon.ico'),
    16: F('favicon-16.png'),
    32: F('favicon-32.png'),
    48: F('favicon-48.png'),
    64: F('favicon-64.png'),
    96: F('favicon-96.png'),
    128: F('favicon-128.png'),
    180: F('favicon-180.png'),
    192: F('favicon-192.png'),
    256: F('favicon-256.png'),
    512: F('favicon-512.png'),
    appleTouch: F('apple-touch-icon.png'),
  },
} as const;

export type SpotterMarkVariant = 'sidebar' | 'tight' | 'glyph';

export function iconSrcFor(variant: SpotterMarkVariant, cssPx: number): string {
  // Prefer ≥2× asset so retina keeps muscle detail.
  const want = Math.ceil(cssPx * 2);
  if (variant === 'sidebar') return pickSrc(spotterIcons.sidebar, want);
  if (variant === 'tight') return pickSrc(spotterIcons.glyphTight, want);
  return pickSrc(spotterIcons.glyph, want);
}

/** @deprecated use iconSrcFor('glyph' | 'tight', px) */
export function glyphSrcFor(px: number): string {
  return iconSrcFor('tight', px);
}
