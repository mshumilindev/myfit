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
