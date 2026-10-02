/** Shared labels, icons and number helpers of the Supplements screens. */
import { FEATURE_ICON } from '../../../coachEffectIcons';
import { useT } from '../../../i18n';
import {
  activeSupplementEntries,
  supplementItem,
  supplementSummaryText,
  type SupplementEvidence,
  type SupplementItem,
} from '../../../supplementCatalog';
import {
  supplementEffectsTypical,
  defaultSupplementSettings,
  type Range,
  type SupplementEffectKey,
  type SupplementEffects,
  type SupplementWarningLevel,
} from '../../../supplements';
import { supplementContext } from '../../../supplementsApply';
import type { Tone } from '../../../components/ui/tones';
import type {
  SupplementEntry,
  SupplementGroup,
  SupplementId,
  SupplementTiming,
  SupplementUnit,
} from '../../../types';

/** The icon of the Supplements row, hub and privacy category. */
export const SUP_ROW_ICON = FEATURE_ICON.supplements;

/** One entry per supplement: the id is stable so an item is "saved" or not. */
export const supEntryId = (itemId: SupplementId): string => `sup-${itemId}`;

/** The item a group sheet opens on when nothing in it is saved yet. */
export const defaultItemOf = (items: readonly SupplementItem[]): SupplementId => items[0].id;

/** Plain number text, no trailing zeros. */
export const numText = (n: number): string => String(Math.round(n * 100) / 100);

/** Decimals the stepper needs for an item (from its step and presets). */
export function decimalsOf(item: SupplementItem): number {
  const d = (n: number) => (String(n).split('.')[1] ?? '').length;
  return Math.max(d(item.step), ...item.presets.map(d));
}

/** How a warning level looks (kit Notice tone and icon). */
export const WARNING_TONE: Record<SupplementWarningLevel, { tone: Tone; icon: string }> = {
  warn: { tone: 'danger', icon: 'warning' },
  caution: { tone: 'accent', icon: 'warning' },
  info: { tone: 'neutral', icon: 'info' },
};

/** Tag tone of an evidence level. */
export const EVIDENCE_TONE: Record<SupplementEvidence | 'none', Tone> = {
  strong: 'ok',
  moderate: 'accent',
  weak: 'neutral',
  none: 'neutral',
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The effects an entry would have at the full ramp (creatine measured 12+ weeks from now),
 * on a typical training day. Display only: the readout of the item sheet.
 */
export function effectsAtFullRamp(entry: SupplementEntry): SupplementEffects | null {
  const now = Date.now();
  return supplementEffectsTypical(
    {
      entries: [{ ...entry, active: true, startedAt: now - 14 * WEEK_MS }],
      checkins: {},
      settings: defaultSupplementSettings(),
    },
    now,
    supplementContext(now),
  );
}

export function useSupplementText() {
  const { t } = useT();
  const itemName = (id: SupplementId): string => t.supItem[id];
  const itemShort = (id: SupplementId): string => t.supItemShort[id];
  const groupName = (g: SupplementGroup): string => t.supGroup[g];
  const timingLabel = (k: SupplementTiming): string => t.supTiming[k];
  /** "5 g", "1.5 scoops". */
  const doseText = (dose: number, unit: SupplementUnit): string => t.supDose[unit](numText(dose));
  /** "3–5 g", "0.2–0.3 g per kg", "70 ml". */
  const typicalText = (item: SupplementItem): string => {
    const [lo, hi] = item.typicalPerKg ?? item.typical;
    const per = item.typicalPerKg ? ` ${t.supPerKg}` : '';
    if (lo === hi) return `${doseText(lo, item.unit)}${per}`;
    return `${numText(lo)}–${numText(hi)} ${t.supUnit[item.unit]}${per}`;
  };
  /** "5 g · Any time": the sub-line of one entry. */
  const entryText = (e: Pick<SupplementEntry, 'itemId' | 'dose' | 'timing' | 'schedule'>): string =>
    `${doseText(e.dose, supplementItem(e.itemId).unit)} · ${
      e.schedule === 'trainingDays' ? t.supSchedule.trainingDays : timingLabel(e.timing)
    }`;
  /** "Creatine + Whey · 2 items", or null with nothing active. */
  const summary = (entries: readonly SupplementEntry[]): string | null =>
    supplementSummaryText(entries, itemShort, t.supItemsTail, t.supMore);
  /** "Creatine + Whey": the names alone, in the order saved. */
  const summaryNames = (entries: readonly SupplementEntry[]): string => {
    const names: string[] = [];
    for (const e of activeSupplementEntries(entries)) {
      const n = itemShort(e.itemId);
      if (!names.includes(n)) names.push(n);
    }
    const shown = names.slice(0, 2);
    const rest = names.length - shown.length;
    return rest > 0 ? `${shown.join(' + ')} + ${t.supMore(rest)}` : shown.join(' + ');
  };
  /** The sub-line of a group row: what is saved in it, or null. */
  const groupSub = (list: readonly SupplementEntry[]): string | null => {
    if (list.length === 0) return null;
    if (list.length > 2) return t.supCount(list.length);
    return list
      .map((e) => `${itemShort(e.itemId)} ${doseText(e.dose, supplementItem(e.itemId).unit)}`)
      .join(' · ');
  };
  const sign = (n: number): string => (n < 0 ? '−' : '+');
  /** The value of one effect as a range: "+0–8 %", "−0.2–0.5 RPE", "+5 min". */
  const fxValue = (key: SupplementEffectKey, r: Range): string => {
    const a = Math.abs(r.low);
    const b = Math.abs(r.high);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const s = sign(r.low + r.high);
    const span = (x: number, y: number, unit: string): string =>
      x === y ? `${s}${numText(x)} ${unit}` : `${s}${numText(x)}–${numText(y)} ${unit}`;
    switch (key) {
      case 'creatineStrength':
        return span(Math.round(lo * 1000) / 10, Math.round(hi * 1000) / 10, '%');
      case 'creatineBodyweightKg':
        return span(lo, hi, t.supKg);
      case 'caffeineRpe':
        return span(lo, hi, 'RPE');
      case 'caffeineSleepMin':
        return span(Math.round(lo), Math.round(hi), t.supMin);
      default:
        return span(lo, hi, t.supUnit.g);
    }
  };
  return {
    t,
    itemName,
    itemShort,
    groupName,
    timingLabel,
    doseText,
    typicalText,
    entryText,
    summary,
    summaryNames,
    groupSub,
    fxValue,
  };
}
