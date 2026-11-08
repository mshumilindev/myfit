/**
 * Goals and Playbook are add-ons. Goals: without it every reader of the store sees empty goals (store.ts `exposed()`), the
 * stored goals stay and come back on re-install. Playbook is computed from the history, so it is only a gate on its screens,
 * tiles, nudge, widget and suggestions. One gate each; screens ask it, they do not re-implement it.
 */
import { addonAvailable, useAddonOrBase } from './enabledSet';

/** Pure code (no hook): true while Goals is installed or not offered to this role. Never throws (blocked storage = on). */
export function goalsAvailable(): boolean {
  try {
    return addonAvailable('goals');
  } catch {
    return true;
  }
}

/** Sleep: without it every reader of the store sees no nights (store.ts `exposed()`), so no model or card uses them. */
export function sleepAvailable(): boolean {
  try {
    return addonAvailable('sleep');
  } catch {
    return true;
  }
}

export function useGoalsOn(): boolean {
  return useAddonOrBase('goals');
}

export function usePlaybookOn(): boolean {
  return useAddonOrBase('playbook');
}
