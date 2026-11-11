/**
 * What a coach may see of nicotine, per `settings.sharing` (pure; no store, no I/O).
 *  - 'off'     -> nothing (null);
 *  - 'effects' -> only the effect ranges on training (no products, no mg);
 *  - 'full'    -> the same, plus the usual amounts and the combined mg.
 * It rides inside the sealed `meta/coachShare` doc next to the conditions view, so it is
 * encrypted like everything else and the server only forwards ciphertext.
 */
import {
  activeNicotineProducts,
  nicotineEffects,
  nicotineLoad,
  NEUTRAL,
  SURFACE_COEFFS,
  type NicotineEffectKey,
} from './nicotine';
import type { NicotineKind, NicotineState, NicotineUnit } from './types';

export interface CoachNicotineEffect {
  key: NicotineEffectKey;
  low: number;
  high: number;
}

export interface CoachNicotineView {
  mode: 'effects' | 'full';
  /** Only surfaces that actually change something. */
  effects: CoachNicotineEffect[];
  /** Full only. */
  full?: {
    /** Labelled mg a day. */
    mgPerDay: number;
    /** Absorbed mg a day: the base of the load (labelled x absorption). */
    absorbedMgPerDay: number;
    /** Cigarette-equivalents a day (absorbed mg / 1 mg). */
    cigEq: number;
    products: {
      kind: NicotineKind;
      /** Absent for a from-time-to-time product (`occasional`). */
      unit?: NicotineUnit;
      amount?: number;
      strengthMg: number;
      mlPerPod?: number;
      occasional?: true;
    }[];
  };
}

export function nicotineCoachView(
  n: Pick<NicotineState, 'products' | 'settings'>,
): CoachNicotineView | null {
  const mode = n.settings.sharing;
  if (mode !== 'effects' && mode !== 'full') return null;
  const fx = nicotineEffects(n);
  const effects: CoachNicotineEffect[] = [];
  if (fx) {
    for (const key of Object.keys(SURFACE_COEFFS) as NicotineEffectKey[]) {
      const r = fx[key];
      const neutral = NEUTRAL[SURFACE_COEFFS[key].mode];
      if (r.low !== neutral || r.high !== neutral) effects.push({ key, low: r.low, high: r.high });
    }
  }
  const active = activeNicotineProducts(n.products);
  if (mode === 'effects') return effects.length ? { mode, effects } : null;
  if (!active.length && !effects.length) return null;
  return {
    mode,
    effects,
    full: {
      ...(({ mgPerDay, absorbedMgPerDay, cigEq }) => ({ mgPerDay, absorbedMgPerDay, cigEq }))(
        nicotineLoad(n.products),
      ),
      products: active.map((p) =>
        p.occasional
          ? { kind: p.kind, strengthMg: p.strengthMg, occasional: true as const }
          : {
              kind: p.kind,
              unit: p.unit,
              amount: p.amount,
              strengthMg: p.strengthMg,
              ...(p.mlPerPod ? { mlPerPod: p.mlPerPod } : {}),
            },
      ),
    },
  };
}
