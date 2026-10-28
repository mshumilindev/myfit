/** Reads what the app can already read on this device into `ExportSources`. No network, no new data path. */
import { currentUid, getRole, getUsername } from '../../api';
import { getChatLog } from '../../atlas/chatLog';
import {
  hasNutritionData,
  nutritionLoaded,
  storedNutrition,
  store as nutritionStore,
} from '../../nutrition/store';
import { getStoreState, getStoredHealthForExport, hasStoredHealthData } from '../../store';
import { LOCAL_KEYS } from '../../localKeys.registry';
import type { ConsentRecord } from '../consents';
import type { ExportSources, HealthFeatureKey, StoreSlice } from './exportModel';

const HEALTH: readonly HealthFeatureKey[] = [
  'injuries',
  'chronic',
  'cycle',
  'nicotine',
  'alcohol',
  'supplements',
];

export interface LiveInputs {
  consents: readonly ConsentRecord[] | null;
  hasTrainer: boolean;
}

/** Reads the stores now. Waits briefly for the food log's first snapshots (never longer than its own timeout). */
export async function readExportSources(live: LiveInputs): Promise<ExportSources> {
  const st = getStoreState();
  const slice: StoreSlice = st;
  const loaded = await nutritionLoaded();
  const shown = nutritionStore.get();
  const hasShown =
    shown.entries.length > 0 || shown.customFoods.length > 0 || !!shown.goal || !!shown.profile;
  // The person's own stored food data goes back to them even while the food log is off (Art. 15 / 20); it is labelled.
  const food = storedNutrition();
  return {
    account: { uid: currentUid(), username: getUsername(), role: getRole() },
    consents: live.consents,
    store: slice,
    storeSynced: st.syncStatus === 'synced',
    health: getStoredHealthForExport(),
    hiddenHealth: HEALTH.filter((f) => hasStoredHealthData(f) && !visible(f, st)),
    nutrition: !loaded
      ? null
      : {
          entries: food.entries,
          foods: food.customFoods,
          goal: food.goal,
          profile: food.profile,
          hidden: !hasShown && hasNutritionData(),
        },
    chat: getChatLog(),
    settings: readAccountSettings(),
    hasTrainer: live.hasTrainer,
  };
}

/** A health feature is visible when the masked state still holds something for it. */
function visible(f: HealthFeatureKey, st: ReturnType<typeof getStoreState>): boolean {
  switch (f) {
    case 'injuries':
      return st.injuries.length > 0;
    case 'chronic':
      return st.conditions.length > 0;
    default:
      return (st[f]?.updatedAt ?? 0) > 0;
  }
}

const parse = (raw: string): unknown => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
};

/**
 * The settings and small values that live in the account's `meta/*` documents (SPO-385…391), read from this device's cache.
 * Driven by the key registry, so a key registered as synced to `meta/*` is exported without touching this file. Stamps
 * (`…At`) are bookkeeping, not the person's data, and stay out.
 */
export function readAccountSettings(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  try {
    const meta = LOCAL_KEYS.filter(
      (e) =>
        e.class === 'synced' &&
        e.scope === 'account' &&
        e.syncedTo?.startsWith('users/{uid}/meta/'),
    );
    for (const k of Object.keys(localStorage).sort()) {
      if (/At$/.test(k)) continue;
      if (!meta.some((e) => e.key === k || (e.prefix && k.startsWith(e.prefix)))) continue;
      const raw = localStorage.getItem(k);
      if (raw !== null) out[k] = parse(raw);
    }
  } catch {
    /* storage unavailable: nothing to add */
  }
  return out;
}
