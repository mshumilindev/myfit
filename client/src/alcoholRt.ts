import type * as A from './alcohol';
import type { AlcoholRegion } from './types';
import type { CoachAlcoholView } from './alcoholShare';
import type { AlcoholState } from './types';

/** Neutral empty document (the real one, `emptyAlcoholState`, fills the default surfaces; `normalize` rebuilds it). */
const emptyNeutral = (): AlcoholState => ({
  entries: [],
  checkins: {},
  settings: {
    version: 1,
    useInCalculations: true,
    surfaces: {},
    sharing: 'off',
    usualDays: [],
    checkinsOn: false,
  } as unknown as AlcoholState['settings'],
  updatedAt: 0,
});

/** Neutral value per effect key (x1 for factors, +0 for minutes) — `NEUTRAL[SURFACE_COEFFS[key].mode]`. */
export const NEUTRAL_MID: Record<A.AlcoholEffectKey, number> = {
  readiness: 1,
  sleepMin: 0,
  deloadThreshold: 1,
  progressionStep: 1,
};

export interface AlcoholRt {
  empty: () => AlcoholState;
  normalize: (raw: unknown) => AlcoholState;
  normalizeEntry: typeof A.normalizeAlcoholEntry;
  load: typeof A.alcoholLoad;
  effects: typeof A.alcoholEffects;
  effectsFor: typeof A.alcoholEffectsFor;
  weekActual: typeof A.alcoholWeekActual;
  pending: typeof A.pendingAlcoholCheckin;
  dayKey: typeof A.dayKey;
  surfaceOn: typeof A.surfaceOn;
  usualGrams: typeof A.usualOccasionGrams;
  normalizeCheckins: typeof A.normalizeCheckins;
  cleanUsualDays: typeof A.cleanUsualDays;
  isSharing: typeof A.isAlcoholSharing;
  isRegion: (v: unknown) => v is AlcoholRegion;
  resolveRegion: (override?: AlcoholRegion | null) => AlcoholRegion;
  coachView: (
    a: Pick<AlcoholState, 'entries' | 'settings'> | null | undefined,
  ) => CoachAlcoholView | null;
}

export const alc: AlcoholRt = {
  empty: emptyNeutral,
  normalize: (raw) =>
    raw && typeof raw === 'object'
      ? ({ ...emptyNeutral(), ...(raw as Partial<AlcoholState>) } as AlcoholState)
      : emptyNeutral(),
  normalizeEntry: () => null,
  load: () => ({ gramsPerWeek: 0, gramsPerDay: 0 }),
  effects: () => null,
  effectsFor: () => null,
  weekActual: () => null,
  pending: () => null,
  dayKey: () => null,
  surfaceOn: () => false,
  usualGrams: () => 0,
  normalizeCheckins: (raw) => (raw && typeof raw === 'object' ? (raw as never) : {}),
  cleanUsualDays: () => [],
  isSharing: ((v: unknown) => v === 'off' || v === 'effects') as AlcoholRt['isSharing'],
  isRegion: ((v: unknown) => typeof v === 'string') as AlcoholRt['isRegion'],
  resolveRegion: (o) => o ?? 'eu',
  coachView: () => null,
};
