/**
 * Goals and Playbook are add-ons. Goals: without it every reader of the store sees empty goals (store.ts `exposed()`), the
 * stored goals stay and come back on re-install. Playbook is computed from the history, so it is only a gate on its screens,
 * tiles, nudge, widget and suggestions. One gate each; screens ask it, they do not re-implement it.
 */
import { addonAvailable, useAddonOrBase } from './enabledSet';

/** Pure code (no hook): true while Goals is installed or not offered to this role. Never throws (a storage error = off: a hard guard). */
export function goalsAvailable(): boolean {
  try {
    return addonAvailable('goals');
  } catch {
    return false;
  }
}

/** Sleep: without it every reader of the store sees no nights (store.ts `exposed()`), so no model or card uses them. */
export function sleepAvailable(): boolean {
  try {
    return addonAvailable('sleep');
  } catch {
    return false;
  }
}

/** Atlas: without it every reader of the store sees Atlas as off (store.ts `exposed()`), so none of its UI or voice shows. */
export function atlasAvailable(): boolean {
  try {
    return addonAvailable('atlas');
  } catch {
    return false;
  }
}

/** Playbook: without it nothing reads the learned plays (`playbookGated.ts`); screens use `usePlaybookOn`. */
export function playbookAvailable(): boolean {
  try {
    return addonAvailable('playbook');
  } catch {
    return false;
  }
}

/** Apex ranks (standards tiers): without the module nothing derives a rank or tier, not even inside other widgets. */
export function apexRanksAvailable(): boolean {
  try {
    return addonAvailable('apex-ranks');
  } catch {
    return false;
  }
}

export function useGoalsOn(): boolean {
  return useAddonOrBase('goals');
}

export function usePlaybookOn(): boolean {
  return useAddonOrBase('playbook');
}
