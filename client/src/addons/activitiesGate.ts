/**
 * Activities is an add-on: without it the app has no activity logging, and every reader of the store sees an empty
 * activity list (store.ts `exposed()`), the same way a missing Health consent masks health data. The stored activities are
 * not touched: they come back on re-install. This is the one gate; screens ask it, they do not re-implement it.
 */
import { addonAvailable, useAddonOrBase } from './enabledSet';

/** Pure code (no hook): true while Activities is installed or not offered to this role. Never throws (blocked storage = on). */
export function activitiesAvailable(): boolean {
  try {
    return addonAvailable('activities');
  } catch {
    return true;
  }
}

/** The same gate for components. */
export function useActivitiesOn(): boolean {
  return useAddonOrBase('activities');
}
