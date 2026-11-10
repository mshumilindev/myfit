import type * as C from './cycle/cycleState';
import type * as K from './cycle/cycleCore';

/** Condition key of menopause (also exported by `cycle/cycleCore`; a test keeps them equal). */
export const MENOPAUSE_KEY = 'preg_menopause';

const emptyNeutral = (): C.CycleState => ({
  enabled: false,
  settings: null,
  starts: [],
  surfaces: { today: true, calendar: true, session: true },
  pendingDate: false,
  updatedAt: 0,
});

export interface CycleRt {
  empty: () => C.CycleState;
  normalize: (raw: unknown) => C.CycleState;
  withStart: typeof C.withStart;
  normalizeSettings: typeof K.normalizeSettings;
}

export const cyc: CycleRt = {
  empty: emptyNeutral,
  normalize: (raw) =>
    raw && typeof raw === 'object'
      ? ({ ...emptyNeutral(), ...(raw as Partial<C.CycleState>) } as C.CycleState)
      : emptyNeutral(),
  withStart: (starts, day) => [...starts, day],
  normalizeSettings: (s) => s,
};
