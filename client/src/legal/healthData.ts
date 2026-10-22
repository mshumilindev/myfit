/**
 * What is stored for a health feature and how to delete it (SPO-290), through each feature's existing delete path.
 * The main store holds six features; the food log has its own store, loaded on demand (importing it opens its streams,
 * so it is imported only when the person is actually asked about deleting it).
 */
import { deleteStoredHealthData, hasStoredHealthData } from '../store';
import type { HealthFeature } from './consents';

export async function hasHealthData(f: HealthFeature): Promise<boolean> {
  if (f === 'nutrition') {
    const n = await import('../nutrition/store');
    // "Nothing stored" is only an answer after the food documents have reported; when they cannot (offline with nothing
    // cached) the delete is offered anyway: deleting nothing is harmless, hiding the offer is not.
    const loaded = await n.nutritionLoaded();
    return n.hasNutritionData() || !loaded;
  }
  return hasStoredHealthData(f);
}

/** Removes everything stored for the feature. Works while the feature is off. */
export async function deleteHealthData(f: HealthFeature): Promise<void> {
  if (f === 'nutrition') {
    (await import('../nutrition/store')).deleteNutritionData();
    return;
  }
  deleteStoredHealthData(f);
}
