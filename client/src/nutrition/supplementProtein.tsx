/**
 * Nutrition › Today: the protein from supplements (whey, casein, plant protein, EAA) counts
 * toward the day's protein TARGET progress, and a small hint says so. It is added to the
 * EATEN protein of the macro bars only: calories, the ring and the food log are untouched
 * (a shake logged as food in the diary is not detected, so it can count twice; the hint says
 * the supplement part is counted apart from the food log). 0 when supplements are off, the
 * protein switch is off, or nothing counts that day.
 */
import { Notice } from '../components/ui/Notice';
import { useSupplements } from '../store';
import { supplementProteinGrams } from '../supplementsApply';
import { useT } from './i18n';

/** Extra protein grams (whole) from the supplements that count on a day ('YYYY-MM-DD'). */
export function useSupplementProtein(day: string): number {
  useSupplements(); // re-render when the supplements change
  return Math.round(supplementProteinGrams(day));
}

export function SupplementProteinHint({ grams }: { grams: number }) {
  const { t } = useT();
  if (grams <= 0) return null;
  return (
    <Notice tone="neutral" icon="pill" className="sup-hint" data-testid="sup-protein-hint">
      {t('supFxProteinHint', { g: grams })}
    </Notice>
  );
}
