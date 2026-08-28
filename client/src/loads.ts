/**
 * Load types (design "Load entry", feature C). Most lifts carry a weight in kg,
 * but two don't fit that mould and the app used to force them into it:
 *
 *   assist — an assisted machine (pull-up/dip) subtracts counter-weight to help
 *            you. It's stored as a NEGATIVE kg, so "less help" is a larger
 *            number and naturally reads as stronger (top set, progression).
 *   band   — a resistance band, entered by colour. The kg is an ESTIMATE from
 *            the gym's band library, good enough for effort and progression but
 *            never counted as real tonnage.
 *
 * Everything here is pure: no store, no persistence. The store derives the type
 * from the exercise (equipment + name, with a manual override) and owns the
 * per-gym band library; this module just holds the taxonomy and the honest math.
 */

export type LoadType = 'weight' | 'assist' | 'band';

export type BandColor = 'yellow' | 'green' | 'red' | 'blue' | 'black' | 'purple';

/** One rung of a gym's band set: a colour and its estimated resistance in kg. */
export interface BandRung {
  color: BandColor;
  kg: number;
}

/** Canonical colour order, light → heavy (the common Zdrofit/Decathlon set). */
export const BAND_COLORS: BandColor[] = ['yellow', 'green', 'red', 'blue', 'black', 'purple'];

/** Sensible starting library when a gym hasn't set its own. Estimates in kg. */
export const BAND_DEFAULTS: readonly BandRung[] = [
  { color: 'yellow', kg: 7 },
  { color: 'green', kg: 11 },
  { color: 'red', kg: 15 },
  { color: 'black', kg: 23 },
];

/** Swatch colours for the band picker — the physical band colour, not a token. */
export const BAND_HEX: Record<BandColor, string> = {
  yellow: '#e5c100',
  green: '#3fa34d',
  red: '#d1495b',
  blue: '#3d84c9',
  black: '#2b2f36',
  purple: '#7b5ea7',
};

/**
 * Derive a load type from what the exercise is. Bands are an equipment id;
 * assisted machines aren't, so we read the name ("Assisted Pull-up"). The store
 * lets the user override this per exercise when the heuristic guesses wrong.
 */
export function deriveLoadType(name: string, equipment: readonly string[]): LoadType {
  if (equipment.includes('bands')) return 'band';
  if (/assist/i.test(name)) return 'assist';
  return 'weight';
}

/** Nearest band in a library to a stored estimate (so kg → colour round-trips). */
export function bandForKg(kg: number, lib: readonly BandRung[]): BandRung | null {
  if (lib.length === 0) return null;
  let best = lib[0];
  let bestD = Math.abs(lib[0].kg - kg);
  for (const r of lib) {
    const d = Math.abs(r.kg - kg);
    if (d < bestD) {
      best = r;
      bestD = d;
    }
  }
  return best;
}

/** The next stronger band after `color`, or null if it's already the heaviest. */
export function nextBand(color: BandColor, lib: readonly BandRung[]): BandRung | null {
  const sorted = [...lib].sort((a, b) => a.kg - b.kg);
  const i = sorted.findIndex((r) => r.color === color);
  return i >= 0 && i < sorted.length - 1 ? sorted[i + 1] : null;
}

/**
 * Machine-stack quick picks for the assist picker: counter-weights as negative
 * kg, heaviest help first (−48 … −8 for the defaults). Centred loosely on the
 * current value so the nearest plates are always one tap away.
 */
export function assistStack(current = 0, step = 8, count = 6): number[] {
  const mag = Math.abs(current);
  // Start one step above the current help and walk down, but never below 0.
  const top = Math.max(step * count, Math.ceil((mag + step) / step) * step);
  const out: number[] = [];
  for (let v = top; v >= step && out.length < count; v -= step) out.push(-v);
  return out;
}

/** Assist/band estimates never count toward real tonnage; only plain weight. */
export function countsAsTonnage(loadType: LoadType): boolean {
  return loadType === 'weight';
}
