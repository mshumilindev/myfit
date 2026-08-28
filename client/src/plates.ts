/**
 * Barbell plate maths (design "Load entry", feature A): given a target total
 * weight, what goes on the bar PER SIDE — with a selectable bar weight, plates
 * counted in kg or lb (a lb-plate gym while the app stores kg), optional
 * collars, and a "closest loadable" answer when the exact number can't be made.
 * Pure: no store/React. Weights are canonical kg everywhere except the plate
 * denominations, which are in `unit`.
 */
export type PlateUnit = 'kg' | 'lb';

export const LB_PER_KG = 2.2046226218;
export const kgToLb = (kg: number): number => kg * LB_PER_KG;
export const lbToKg = (lb: number): number => lb / LB_PER_KG;

/** Selectable bar weights (kg): olympic, women's, 10 kg EZ, 7 kg technique. */
export const BAR_WEIGHTS_KG = [20, 15, 10, 7];
/** Selectable bar weights when loading in lb (45 lb / 35 lb bars), stored as kg. */
export const BAR_WEIGHTS_LB = [45, 35];

/** Default plate racks per unit, largest first. */
export const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];
export const PLATES_LB = [45, 35, 25, 10, 5, 2.5, 1.25];

/** Disc colour by denomination — calibrated-plate convention, tuned to the
 *  graphite theme (reuses the app's accent/ok/danger/kcal hues). */
export const PLATE_COLOR_KG: Record<number, string> = {
  25: '#e2564f',
  20: '#3d84c9',
  15: '#e6b53f',
  10: '#4cbe8c',
  5: '#e9edf1',
  2.5: '#8a9099',
  1.25: '#6b727c',
  0.5: '#4a4f57',
};
export const PLATE_COLOR_LB: Record<number, string> = {
  45: '#3d84c9',
  35: '#e6b53f',
  25: '#4cbe8c',
  10: '#e9edf1',
  5: '#8a9099',
  2.5: '#6b727c',
  1.25: '#4a4f57',
};

export function plateColor(denom: number, unit: PlateUnit): string {
  return (unit === 'kg' ? PLATE_COLOR_KG : PLATE_COLOR_LB)[denom] ?? '#8a9099';
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface PlateSolution {
  /** Plate denominations (in `unit`) loaded on ONE side, largest first. */
  perSide: number[];
  /** Total weight actually loaded (kg) — ≤ target when not exact. */
  achievedKg: number;
  /** target − achieved (kg); 0 when exact, positive when the bar undershoots. */
  deltaKg: number;
  exact: boolean;
  /** Load per side in kg (bar excluded) — for the readout. */
  perSideKg: number;
}

export interface PlateOpts {
  barKg: number;
  unit: PlateUnit;
  /** Available plate denominations in `unit`; defaults to the standard rack. */
  plates?: number[];
  /** One collar per side, in kg (e.g. 2.5 kg competition collars). */
  collarKg?: number;
}

/**
 * Solve a target total (kg) into plates per side by a greedy largest-first fill.
 * Greedy undershoots when the exact number isn't loadable, so `achievedKg` is
 * the closest weight you CAN load at or below the target (snap to it).
 */
export function solvePlates(targetKg: number, opts: PlateOpts): PlateSolution {
  const collar = opts.collarKg ?? 0;
  const denoms = (opts.plates ?? (opts.unit === 'kg' ? PLATES_KG : PLATES_LB))
    .slice()
    .sort((a, b) => b - a);
  const perSideKgTarget = (targetKg - opts.barKg - 2 * collar) / 2;
  const perSide: number[] = [];
  if (perSideKgTarget > 0.01) {
    let remKg = perSideKgTarget;
    for (const d of denoms) {
      const dKg = opts.unit === 'kg' ? d : lbToKg(d);
      while (remKg + 1e-6 >= dKg) {
        perSide.push(d);
        remKg -= dKg;
      }
    }
  }
  const sumKg = perSide.reduce((s, d) => s + (opts.unit === 'kg' ? d : lbToKg(d)), 0);
  const achievedKg = round2(opts.barKg + 2 * collar + 2 * sumKg);
  const deltaKg = round2(targetKg - achievedKg);
  return {
    perSide,
    achievedKg,
    deltaKg,
    exact: Math.abs(deltaKg) < 0.05,
    perSideKg: round2(sumKg),
  };
}

/** Build direction: total weight (kg) from a chosen bar + per-side plates. */
export function totalFromPlates(perSide: number[], opts: PlateOpts): number {
  const collar = opts.collarKg ?? 0;
  const sumKg = perSide.reduce((s, d) => s + (opts.unit === 'kg' ? d : lbToKg(d)), 0);
  return round2(opts.barKg + 2 * collar + 2 * sumKg);
}

/** Group a per-side plate list into {denom, count} runs, largest first. */
export function plateCounts(perSide: number[]): { denom: number; count: number }[] {
  const out: { denom: number; count: number }[] = [];
  for (const d of perSide) {
    const last = out[out.length - 1];
    if (last && last.denom === d) last.count++;
    else out.push({ denom: d, count: 1 });
  }
  return out;
}
