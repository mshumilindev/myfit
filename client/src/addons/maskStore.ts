import { EMPTY_GOALS } from '../goals';
import { restPeriodShown } from '../healthAddons';
import type { RestPeriod } from '../types';

export interface AddonFlags {
  activities: boolean;
  goals: boolean;
  sleep: boolean;
  atlas: boolean;
}

/**
 * What every reader of the store sees once the add-ons are applied (SPO-500, hard guard): the data of an add-on that is
 * not installed is replaced by its empty value. Nothing stored is touched; writers keep using the raw state.
 * Rest periods follow their modules (Rest / Unwell). `masked` is the state after the Health consent masks.
 */
export function maskAddons<T extends { restPeriods: RestPeriod[]; coach: { enabled: boolean } }>(
  masked: T,
  on: AddonFlags,
): T {
  return {
    ...masked,
    restPeriods: (masked.restPeriods ?? []).filter((r) => restPeriodShown(r.mode)),
    ...(on.activities ? {} : { activities: [] }),
    ...(on.goals ? {} : { goals: EMPTY_GOALS }),
    // no nights: readiness, RPE, Mastery and the cards stay neutral
    ...(on.sleep ? {} : { sleeps: [] }),
    // Atlas is off for every reader (its voice, notes, plan card), the setup stays stored
    ...(on.atlas ? {} : { coach: { ...masked.coach, enabled: false } }),
  } as T;
}
