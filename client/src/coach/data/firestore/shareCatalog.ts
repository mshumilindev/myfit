/**
 * The app's catalogues as the pure share helpers need them (`shareExtras.ts`). Browser side only: it imports the exercise
 * catalogue and the activity catalogue, so nothing node-side (the adapter unit tests) imports this file; they use the
 * plain default instead.
 */
import { activityType } from '../../../activities';
import { muscleInfoByName } from '../../../data/exercises';
import type { ExtrasCatalog } from './shareExtras';

export const workoutCatalog: ExtrasCatalog = {
  primaryMuscle: (name) => muscleInfoByName(name)?.primary ?? null,
  activityIcon: (type) => activityType(type)?.icon ?? null,
};
