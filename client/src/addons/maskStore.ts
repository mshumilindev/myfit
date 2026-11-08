import type { RestMode, RestPeriod } from '../types';

export interface AddonFlags {
  activities: boolean;
  goals: boolean;
  sleep: boolean;
  atlas: boolean;
  /** Passed in (not imported) so this file stays a leaf: importing the store's own helpers here would form import cycles. */
  restShown: (mode: RestMode) => boolean;
  emptyGoals: unknown;
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
    restPeriods: (masked.restPeriods ?? []).filter((r) => on.restShown(r.mode)),
    ...(on.activities ? {} : { activities: [] }),
    ...(on.goals ? {} : { goals: on.emptyGoals }),
    // no nights: readiness, RPE, Mastery and the cards stay neutral
    ...(on.sleep ? {} : { sleeps: [] }),
    // Atlas is off for every reader (its voice, notes, plan card), the setup stays stored
    ...(on.atlas ? {} : { coach: { ...masked.coach, enabled: false } }),
  } as T;
}
