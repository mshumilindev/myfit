/**
 * What a coach may see of supplements, per `settings.sharing` (pure; no store, no I/O).
 *  - 'off'     -> nothing (null);
 *  - 'effects' -> only the effect ranges on training, for a typical training day. NEVER the
 *    names, the doses, the schedules or the timings;
 *  - 'full'    -> the same, plus the names, doses, schedules and timings of the active entries
 *    and the caffeine and protein totals.
 * Day check-ins (what was taken on which day) are NEVER shared, at any level.
 * It rides inside the sealed `meta/coachShare` doc next to the conditions, nicotine and
 * alcohol views, so it is encrypted like everything else and the server only forwards
 * ciphertext.
 */
import {
  isNeutralRange,
  SUPPLEMENT_EFFECT_KEYS,
  supplementEffectsTypical,
  type SupplementContext,
  type SupplementEffectKey,
  NO_TRAINING_CONTEXT,
} from './supplements';
import {
  activeSupplementEntries,
  caffeineMgOfEntries,
  proteinGramsOfEntries,
  supplementItem,
} from './supplementCatalog';
import type {
  SupplementId,
  SupplementSchedule,
  SupplementState,
  SupplementTiming,
  SupplementUnit,
} from './types';

/** Neutral keys: the coach sees WHAT changes, never which product causes it. */
export type CoachSupplementEffectKey =
  'strength' | 'bodyweightKg' | 'rpe' | 'sleepMin' | 'proteinGrams';
const NEUTRAL_KEY: Record<SupplementEffectKey, CoachSupplementEffectKey> = {
  creatineStrength: 'strength',
  creatineBodyweightKg: 'bodyweightKg',
  caffeineRpe: 'rpe',
  caffeineSleepMin: 'sleepMin',
  proteinGrams: 'proteinGrams',
};

export interface CoachSupplementEffect {
  key: CoachSupplementEffectKey;
  low: number;
  high: number;
}

export interface CoachSupplementItem {
  itemId: SupplementId;
  dose: number;
  unit: SupplementUnit;
  schedule: SupplementSchedule;
  timing: SupplementTiming;
}

export interface CoachSupplementsView {
  mode: 'effects' | 'full';
  /** Only effects that actually change something, for a typical training day. */
  effects: CoachSupplementEffect[];
  /** Full only. */
  full?: {
    items: CoachSupplementItem[];
    /** Caffeine mg and protein grams on a typical training day (daily + training-day entries). */
    caffeineMgPerDay: number;
    proteinGramsPerDay: number;
  };
}

export function supplementsCoachView(
  s: Pick<SupplementState, 'entries' | 'settings'> | null | undefined,
  ctx: SupplementContext = NO_TRAINING_CONTEXT,
  now: number = Date.now(),
): CoachSupplementsView | null {
  const mode = s?.settings?.sharing;
  if (mode !== 'effects' && mode !== 'full') return null;
  const fx = supplementEffectsTypical(s, now, ctx);
  const effects: CoachSupplementEffect[] = [];
  if (fx)
    for (const key of SUPPLEMENT_EFFECT_KEYS) {
      const r = fx[key];
      if (!isNeutralRange(r)) effects.push({ key: NEUTRAL_KEY[key], low: r.low, high: r.high });
    }
  if (mode === 'effects') return effects.length ? { mode, effects } : null;
  const active = activeSupplementEntries(s?.entries ?? []);
  if (!active.length) return null;
  return {
    mode,
    effects,
    full: {
      items: active.map((e) => ({
        itemId: e.itemId,
        dose: e.dose,
        unit: supplementItem(e.itemId).unit,
        schedule: e.schedule,
        timing: e.timing,
      })),
      caffeineMgPerDay: caffeineMgOfEntries(active),
      proteinGramsPerDay: proteinGramsOfEntries(active),
    },
  };
}
