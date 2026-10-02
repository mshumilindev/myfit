/**
 * What a coach may see of alcohol, per `settings.sharing` (pure; no store, no I/O).
 *  - 'off'     -> nothing (null);
 *  - 'effects' -> only the flat effect ranges on training. NEVER the drinks, the amounts or
 *    the weekdays: alcohol has no "full" level.
 * It rides inside the sealed `meta/coachShare` doc next to the conditions and nicotine views,
 * so it is encrypted like everything else and the server only forwards ciphertext.
 */
import {
  alcoholEffects,
  ALCOHOL_EFFECT_KEYS,
  NEUTRAL,
  SURFACE_COEFFS,
  type AlcoholEffectKey,
} from './alcohol';
import type { AlcoholState } from './types';

export interface CoachAlcoholEffect {
  key: AlcoholEffectKey;
  low: number;
  high: number;
}

export interface CoachAlcoholView {
  mode: 'effects';
  /** Only surfaces that actually change something. */
  effects: CoachAlcoholEffect[];
}

export function alcoholCoachView(
  a: Pick<AlcoholState, 'entries' | 'settings'> | null | undefined,
): CoachAlcoholView | null {
  if (a?.settings?.sharing !== 'effects') return null;
  const fx = alcoholEffects(a);
  if (!fx) return null;
  const effects: CoachAlcoholEffect[] = [];
  for (const key of ALCOHOL_EFFECT_KEYS) {
    const r = fx[key];
    const neutral = NEUTRAL[SURFACE_COEFFS[key].mode];
    if (r.low !== neutral || r.high !== neutral) effects.push({ key, low: r.low, high: r.high });
  }
  return effects.length ? { mode: 'effects', effects } : null;
}
