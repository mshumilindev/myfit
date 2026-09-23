/**
 * Muscle-group background palette — THE one place a designer edits colours.
 *
 * Every entry is derived from the app's own design tokens (client/src/styles.css
 * :root custom properties), mixed into the graphite background so the library
 * reads as one dark, restrained Spotter shoot with a subtle per-muscle cast —
 * never a rainbow. Colour only touches the wall tone, ambient glow and a faint
 * rim light; the prompt forbids tinting skin.
 *
 * To change a group's colour: edit its `hue` (a token name like
 * '--color-accent' or a hex) and/or `strength` (0–1: how much of the hue goes
 * into the wall). Regeneration picks it up via the prompt hash.
 */
import fs from 'node:fs';
import { PATHS } from './config';

export type PaletteKey =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quadriceps'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'fullbody'
  | 'cardio'
  | 'mobility'
  | 'other';

export interface PaletteEntry {
  /** Token name (resolved from styles.css) or a literal #rrggbb. */
  hue: string;
  /** Share of the hue mixed into the graphite wall (keep ≤ 0.3). */
  strength: number;
  /** Words the prompt uses for the cast (models follow words better than hex). */
  words: string;
}

/** Base the walls are mixed into — the app background token. */
export const PALETTE_BASE = '--color-bg';

export const MUSCLE_PALETTE: Record<PaletteKey, PaletteEntry> = {
  chest: { hue: '--color-danger', strength: 0.16, words: 'muted oxblood' },
  back: { hue: '--color-rest-700', strength: 0.22, words: 'deep steel blue' },
  shoulders: { hue: '--color-accent', strength: 0.16, words: 'warm bronze' },
  biceps: { hue: '--color-accent-700', strength: 0.2, words: 'dark amber' },
  triceps: { hue: '#7a5a9e', strength: 0.16, words: 'dusky plum' },
  forearms: { hue: '--color-neutral-500', strength: 0.18, words: 'cool stone grey' },
  quadriceps: { hue: '--color-ok', strength: 0.14, words: 'deep forest green' },
  hamstrings: { hue: '--color-ok-line', strength: 0.22, words: 'dark pine' },
  glutes: { hue: '#9e5a6a', strength: 0.16, words: 'muted rosewood' },
  calves: { hue: '--color-kcal', strength: 0.14, words: 'slate teal' },
  core: { hue: '--color-accent-600', strength: 0.16, words: 'smoked gold' },
  fullbody: { hue: '--color-neutral-400', strength: 0.12, words: 'neutral graphite' },
  cardio: { hue: '--color-rest-400', strength: 0.14, words: 'cool azure' },
  mobility: { hue: '--color-ok-text', strength: 0.12, words: 'soft sage' },
  other: { hue: '--color-neutral-600', strength: 0.1, words: 'neutral charcoal' },
};

/** Primary muscle (catalog MuscleGroup) → palette key. */
const MUSCLE_TO_KEY: Record<string, PaletteKey> = {
  chest: 'chest',
  back: 'back',
  lats: 'back',
  traps: 'back',
  lower_back: 'back',
  shoulders: 'shoulders',
  neck: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  quads: 'quadriceps',
  adductors: 'quadriceps',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  abductors: 'glutes',
  calves: 'calves',
  core: 'core',
  fullbody: 'fullbody',
  cardio: 'cardio',
};

export function paletteKeyFor(primary: string | null, category: string | null): PaletteKey {
  if (category === 'cardio') return 'cardio';
  if (category === 'stretching') return 'mobility';
  return (primary && MUSCLE_TO_KEY[primary]) || 'other';
}

// --- colour maths -------------------------------------------------------------

export function readThemeTokens(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  const root = css.match(/:root\s*\{([\s\S]*?)\n\}/);
  const body = root ? root[1] : css;
  for (const m of body.matchAll(/(--color-[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g)) {
    if (!(m[1] in out)) out[m[1]] = m[2].toLowerCase();
  }
  return out;
}

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([0, 1, 2].map((i) => x[i] * (1 - t) + y[i] * t) as [number, number, number]);
}

export interface ResolvedPalette {
  key: PaletteKey;
  wall: string;
  glow: string;
  words: string;
}

export function resolvePalette(
  key: PaletteKey,
  tokens: Record<string, string>,
  palette: Record<PaletteKey, PaletteEntry> = MUSCLE_PALETTE,
): ResolvedPalette {
  const e = palette[key];
  const pick = (v: string) => (v.startsWith('#') ? v.toLowerCase() : tokens[v]);
  const base = pick(PALETTE_BASE);
  const hue = pick(e.hue);
  if (!base || !hue) throw new Error(`palette: cannot resolve ${key} (${e.hue}) from theme tokens`);
  return {
    key,
    wall: mix(base, hue, e.strength),
    // Glow sits a bit brighter than the wall, still far from saturated.
    glow: mix(base, hue, Math.min(0.55, e.strength * 2.6)),
    words: e.words,
  };
}

let cached: Record<string, string> | null = null;
export function loadThemeTokens(): Record<string, string> {
  if (!cached) cached = readThemeTokens(fs.readFileSync(PATHS.themeCss, 'utf8'));
  return cached;
}
