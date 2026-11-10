import type * as N from './nicotine';
import type { CoachNicotineView } from './nicotineShare';
import type { NicotineState } from './types';

const emptyNeutral = (): NicotineState => ({
  products: [],
  settings: {
    version: 2,
    useInCalculations: true,
    surfaces: {},
    sharing: 'off',
  } as unknown as NicotineState['settings'],
  updatedAt: 0,
});

/** Neutral value per effect key (x1 for factors, +0 for minutes / RPE) — `NEUTRAL[SURFACE_COEFFS[key].mode]`. */
export const NEUTRAL_MID: Record<N.NicotineEffectKey, number> = {
  readiness: 1,
  deloadThreshold: 1,
  sleepMin: 0,
  warmupMin: 0,
  restPct: 1,
  progressionStep: 1,
  rpe: 0,
};

export interface NicotineRt {
  empty: () => NicotineState;
  normalize: (raw: unknown) => NicotineState;
  normalizeProduct: typeof N.normalizeNicotineProduct;
  load: typeof N.nicotineLoad;
  effects: typeof N.nicotineEffects;
  isSharing: typeof N.isNicotineSharing;
  surfaceOn: typeof N.surfaceOn;
  coachView: (n: Pick<NicotineState, 'products' | 'settings'>) => CoachNicotineView | null;
  /** Cap of the RPE shift (only read while the effects exist, i.e. once the model is loaded). */
  rpeCap: () => number;
}

export const nic: NicotineRt = {
  empty: emptyNeutral,
  normalize: (raw) =>
    raw && typeof raw === 'object'
      ? ({ ...emptyNeutral(), ...(raw as Partial<NicotineState>) } as NicotineState)
      : emptyNeutral(),
  normalizeProduct: () => null,
  load: () => ({ mgPerDay: 0, absorbedMgPerDay: 0, cigEq: 0 }),
  effects: () => null,
  isSharing: ((v: unknown) =>
    v === 'off' || v === 'effects' || v === 'full') as NicotineRt['isSharing'],
  surfaceOn: () => false,
  coachView: () => null,
  rpeCap: () => 0,
};
