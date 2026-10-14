/**
 * The library the share picker and the peek read: the app's own bundled catalogues (exercises with photos, equipment
 * with photos), mapped to the plain `Library` shape the resolver uses. No network, nothing user-typed. Gyms are not a
 * bundled catalogue (they are `sharedGyms` on the server), so they come from the source adapter.
 */
import {
  BUILT_IN_CATALOG,
  richExerciseById,
  secondaryMusclesOf,
  type MuscleGroup,
} from '../../data/exercises';
import { exerciseNameVariants } from '../../data/exerciseNames';
import { enrichedCatalog } from '../../data/equipmentCatalog';
import type { FamilyId, LibEquipment, LibExercise } from './types';

const FAMILY: Partial<Record<MuscleGroup, FamilyId>> = {
  chest: 'chest',
  back: 'back',
  lats: 'back',
  traps: 'back',
  lower_back: 'back',
  shoulders: 'shoulders',
  biceps: 'arms',
  triceps: 'arms',
  forearms: 'arms',
  quads: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  calves: 'legs',
  adductors: 'legs',
  abductors: 'legs',
  core: 'core',
};
export const familyOf = (m: string): FamilyId => FAMILY[m as MuscleGroup] ?? 'other';
export const FAMILY_ORDER: readonly FamilyId[] = [
  'chest',
  'back',
  'shoulders',
  'arms',
  'legs',
  'core',
  'other',
];

let EX: LibExercise[] | null = null;
/** The bundled exercise catalogue (about 870 exercises), memoised. Names are the canonical English ones. */
export function catalogExercises(): readonly LibExercise[] {
  if (EX) return EX;
  EX = BUILT_IN_CATALOG.filter((c) => c.muscle !== 'cardio').map((c) => {
    const rich = richExerciseById(c.id);
    const name = c.names[0];
    const muscles = [c.muscle, ...secondaryMusclesOf(c)].filter((m, i, a) => a.indexOf(m) === i);
    return {
      id: c.id,
      name,
      muscles,
      equipment: c.equipment ? [c.equipment] : [],
      family: familyOf(c.muscle),
      image: rich?.images?.[0],
      aliases: exerciseNameVariants(name).filter((n) => n !== name),
    };
  });
  return EX;
}

let EQ: LibEquipment[] | null = null;
/** The bundled equipment catalogue (about 320 items with photos), memoised. */
export function catalogEquipment(): readonly LibEquipment[] {
  if (EQ) return EQ;
  EQ = enrichedCatalog().map((e) => ({
    id: e.id,
    name: e.name,
    category: e.category,
    muscles: e.muscles,
    image: e.image?.thumbUrl,
    aliases: e.aka ?? [],
  }));
  return EQ;
}
