import type * as S from './supplements';
import type { CoachSupplementsView } from './supplementsShare';
import type { SupplementState } from './types';

const emptyNeutral = (): SupplementState => ({
  entries: [],
  checkins: {},
  settings: {
    version: 1,
    useInCalculations: true,
    surfaces: {},
    sharing: 'off',
    checkinsOn: false,
  } as unknown as SupplementState['settings'],
  updatedAt: 0,
});

/** Neutral value of every supplement effect (+0). */
export const SUPPLEMENT_NEUTRAL = 0;

export interface SupplementsRt {
  empty: () => SupplementState;
  normalize: (raw: unknown) => SupplementState;
  normalizeEntry: typeof S.normalizeSupplementEntry;
  normalizeCheckins: typeof S.normalizeSupplementCheckins;
  isSharing: typeof S.isSupplementSharing;
  effectsFor: typeof S.supplementEffectsFor;
  proteinGramsFor: typeof S.supplementProteinGramsFor;
  warnings: typeof S.supplementWarnings;
  pending: typeof S.pendingSupplementCheckin;
  usualStartMin: typeof S.usualTrainingStartMin;
  trainingDayResolver: typeof S.trainingDayResolver;
  coachView: (
    s: Pick<SupplementState, 'entries' | 'settings'> | null | undefined,
    ctx?: S.SupplementContext,
    now?: number,
  ) => CoachSupplementsView | null;
}

export const sup: SupplementsRt = {
  empty: emptyNeutral,
  normalize: (raw) =>
    raw && typeof raw === 'object'
      ? ({ ...emptyNeutral(), ...(raw as Partial<SupplementState>) } as SupplementState)
      : emptyNeutral(),
  normalizeEntry: () => null,
  normalizeCheckins: (raw) => (raw && typeof raw === 'object' ? (raw as never) : {}),
  isSharing: ((v: unknown) =>
    v === 'off' || v === 'effects' || v === 'full') as SupplementsRt['isSharing'],
  effectsFor: () => null,
  proteinGramsFor: () => 0,
  warnings: () => [],
  pending: () => null,
  usualStartMin: () => null,
  trainingDayResolver: () => () => false,
  coachView: () => null,
};
