/**
 * Moon phase for a date & (optional) latitude — a self-contained astronomical
 * approximation good to a few percent, which is all the night sky needs.
 *
 * Phase runs 0 (new) → 0.5 (full) → 1 (new again); illuminated fraction and the
 * lit limb (for drawing) follow from it. Southern-hemisphere viewers see the lit
 * side mirrored, so `litOnRight` accounts for latitude.
 */
export type MoonPhaseName =
  | 'new'
  | 'waxingCrescent'
  | 'firstQuarter'
  | 'waxingGibbous'
  | 'full'
  | 'waningGibbous'
  | 'lastQuarter'
  | 'waningCrescent';

export interface MoonInfo {
  /** 0..1 through the synodic month (0 = new, 0.5 = full). */
  phase: number;
  /** Illuminated fraction 0..1. */
  illum: number;
  /** Waxing (growing) vs waning. */
  waxing: boolean;
  name: MoonPhaseName;
  /** Which limb catches the light when drawn (hemisphere-aware). */
  litOnRight: boolean;
}

const SYNODIC = 29.530588853; // days
// A well-known new moon: 2000-01-06 18:14 UTC.
const REF_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);

function nameFor(p: number): MoonPhaseName {
  if (p < 0.02 || p > 0.98) return 'new';
  if (p < 0.23) return 'waxingCrescent';
  if (p < 0.27) return 'firstQuarter';
  if (p < 0.48) return 'waxingGibbous';
  if (p < 0.52) return 'full';
  if (p < 0.73) return 'waningGibbous';
  if (p < 0.77) return 'lastQuarter';
  return 'waningCrescent';
}

export function moonInfo(date: Date = new Date(), lat = 0): MoonInfo {
  const days = (date.getTime() - REF_NEW_MOON) / 86400000;
  let phase = (days % SYNODIC) / SYNODIC;
  if (phase < 0) phase += 1;
  const illum = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  const waxing = phase < 0.5;
  // Northern hemisphere: waxing moon is lit on the right. Flip south of equator.
  const litOnRight = lat < 0 ? !waxing : waxing;
  return { phase, illum, waxing, name: nameFor(phase), litOnRight };
}

export function illumPct(info: MoonInfo): number {
  return Math.round(info.illum * 100);
}
