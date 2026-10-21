/** Session weight text: one decimal and the locale's own kg unit (same word as the set-table column) (store stays canonical kg). */
import { t } from './i18n';

export function fmtWeightValue(kg: number): string {
  return kg.toFixed(1);
}

export function fmtWeightKg(kg: number): string {
  return `${fmtWeightValue(kg)} ${t().kgCol.toLowerCase()}`;
}
