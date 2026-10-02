/** Shared labels, icons and number helpers of the Nicotine screens. */
import { useT } from '../../../i18n';
import { nicotineSummaryText, productMgPerDay } from '../../../nicotine';
import type { NicotineKind, NicotineProduct, NicotineUnit } from '../../../types';

/** Phosphor icon of each product tile (board 2A). */
export const NIC_ICON: Record<NicotineKind, string> = {
  cigarettes: 'flame',
  cigars: 'cylinder',
  pipe: 'fire',
  heated: 'lightning',
  vape: 'wind',
  pouches: 'stack',
  snus: 'drop',
  chew: 'feather',
  hookah: 'wave-sine',
  other: 'dots-three',
};

/** One product per kind: the id is stable so a tile is "selected" or not. */
export const nicProductId = (kind: NicotineKind): string => `nic-${kind}`;

/** Stepper shape for the usual amount, by unit. */
export function stepFor(unit: NicotineUnit): { step: number; decimals: number } {
  switch (unit) {
    case 'ml':
      return { step: 0.5, decimals: 1 };
    case 'packs':
    case 'pods':
      return { step: 0.5, decimals: 1 };
    case 'puffs':
      return { step: 10, decimals: 0 };
    default:
      return { step: 1, decimals: 0 };
  }
}

/** An amount as the stepper shows it (same decimals), so the list subtitle and the stepper agree. */
export function amountText(n: number, unit: NicotineUnit): string {
  const { decimals } = stepFor(unit);
  return String(Number(n.toFixed(decimals)));
}

/** Rounds an amount to the unit's stepper step (never to 0 for a positive amount), e.g. 0.75 pods -> 1. */
export function snapAmount(n: number, unit: NicotineUnit): number {
  const { step, decimals } = stepFor(unit);
  if (!(n > 0)) return n;
  const snapped = Math.max(step, Math.round(n / step) * step);
  return Number(snapped.toFixed(decimals));
}

/** Plain number text, no trailing zeros. */
export const numText = (n: number): string => String(Math.round(n * 100) / 100);

/** mg of nicotine per day, rounded for display. */
export const roundMg = (n: number): number => (n < 10 ? Math.round(n * 10) / 10 : Math.round(n));

export function useNicotineText() {
  const { t } = useT();
  const kindLabel = (k: NicotineKind): string => t.nicKind[k];
  const perDay = (mg: number): string => t.nicMgADay(mg);
  const unitLabel = (u: NicotineUnit): string => t.nicUnit[u];
  const cap = (s: string): string => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s);
  /** "Vape + Heated tobacco · ≈ 38 mg a day", or null with nothing active. */
  const summary = (products: readonly NicotineProduct[]): string | null =>
    nicotineSummaryText(products, (k) => t.nicKindShort[k], perDay, t.supMore);
  /** "About 8 sticks a day", or "From time to time". */
  const aboutText = (p: NicotineProduct): string =>
    p.occasional ? t.nicFreqSome : t.nicProdAbout(amountText(p.amount, p.unit), unitLabel(p.unit));
  const mgFrom = (p: NicotineProduct): number => roundMg(productMgPerDay(p));
  return { t, kindLabel, perDay, unitLabel, cap, summary, aboutText, mgFrom };
}
