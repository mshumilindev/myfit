/**
 * The pure half of the Coach side of the program editor tool (`tools/programEditor`): document adapters, the exercise
 * catalog, the activity list and the check environment. No React, no components: the draft store and node tests use it.
 * The labels and the anatomy figure live in `toolHost.tsx`.
 */
import { ACTIVITY_TYPES } from '../../activities';
import type { Program } from '../../views/programs/model';
import { weekOrder } from '../../weekStart';
import type {
  ActivityKind,
  CheckEnv,
  ExerciseCatalog,
  ProgramDoc,
} from '../../tools/programEditor';
import { exerciseFacts, findExercises } from './catalog';

/** The tool's document is a structural subset of the Coach program: nothing to convert on the way in. */
export const toDoc = (p: Program): ProgramDoc => p;
/**
 * ...and the tool spreads what it is given, so host-only fields come back untouched. Equipment ids are the only
 * narrower type (`EquipmentId` vs `string`); they come from this host's own catalog, so the cast is safe.
 */
export const asProgram = (d: ProgramDoc): Program => d as unknown as Program;

export const coachCatalog: ExerciseCatalog = {
  facts: (name) => exerciseFacts(name),
  search: (q) => findExercises(q),
};

/** Real activity types a plan can hold, conditioning first, then recovery (picker order). */
const PLAN_ACTIVITIES = [
  'run',
  'walk',
  'cycle',
  'swim',
  'row',
  'hiit',
  'padel',
  'mobility',
  'yoga',
];
export const COACH_ACTIVITIES: ActivityKind[] = PLAN_ACTIVITIES.flatMap((k) => {
  const a = ACTIVITY_TYPES.find((x) => x.key === k);
  return a ? [{ key: a.key, icon: a.icon, category: a.category }] : [];
});

/** What the check engine reads, outside React (the draft store computes the check for both screens). */
export const coachCheckEnv = (restrictions: readonly string[] = []): CheckEnv => ({
  catalog: coachCatalog,
  activities: COACH_ACTIVITIES,
  weekOrder: weekOrder(),
  checkContext: { restrictions },
});
