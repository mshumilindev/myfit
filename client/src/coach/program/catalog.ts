/**
 * The exercise facts the Coach editor and the check read, from the REAL catalog (data/exercises).
 * Names are the catalog's own; a trainer-typed alias maps onto a catalog entry here (R-KIT-09: "Skull crusher" finds the
 * EZ-bar skullcrusher and its picture). An exercise the catalog does not know (a custom one) has no picture: the check
 * says so as "To review", never as an error.
 */
import type { EquipmentId } from '../../data/equipment';
import {
  exerciseImage,
  muscleInfoByName,
  richExerciseByName,
  searchCatalog,
  type MuscleGroup,
} from '../../data/exercises';

/** Trainer vocabulary -> catalog name. Lowercase keys. */
const ALIASES: Record<string, string> = {
  'skull crusher': 'EZ-Bar Skullcrusher',
  skullcrusher: 'EZ-Bar Skullcrusher',
  'bulgarian split squat': 'Split Squat with Dumbbells',
  'weighted plank': 'Plank',
  'paused bench press': 'Barbell Bench Press - Medium Grip',
};

/** Facts for names the catalog does not hold (custom exercises a trainer typed): muscles and equipment, never a picture. */
const CUSTOM_FACTS: Record<
  string,
  { primary: MuscleGroup; secondary: MuscleGroup[]; equipment: EquipmentId }
> = {};

export interface ExerciseFacts {
  name: string;
  /** Primary muscle first, then secondaries. */
  muscles: MuscleGroup[];
  primary: MuscleGroup | null;
  secondary: MuscleGroup[];
  equipment: EquipmentId | null;
  image: string | undefined;
  /** Movement direction when the catalog knows it (push / pull). */
  force: 'push' | 'pull' | null;
}

export const catalogName = (name: string): string => ALIASES[name.trim().toLowerCase()] ?? name;

export function exerciseFacts(name: string): ExerciseFacts {
  const canon = catalogName(name);
  const info = muscleInfoByName(canon);
  const custom = CUSTOM_FACTS[name.trim().toLowerCase()];
  const primary = info?.primary ?? custom?.primary ?? null;
  const secondary = (info?.secondary ?? custom?.secondary ?? []).filter(
    (m) => m !== 'cardio' && m !== primary,
  );
  return {
    name,
    primary: primary === 'cardio' ? null : primary,
    secondary,
    muscles: primary && primary !== 'cardio' ? [primary, ...secondary] : secondary,
    equipment: info?.equipment ?? custom?.equipment ?? null,
    image: exerciseImage(canon, 'strength'),
    force: ((f) => (f === 'push' || f === 'pull' ? f : null))(richExerciseByName(canon)?.force),
  };
}

export interface CatalogHit {
  name: string;
  muscle: MuscleGroup;
  equipment: EquipmentId | null;
  image: string | undefined;
}

/** Library search for the "Add exercise" / "Swap" panes. Empty query + a muscle browses that muscle. */
export function findExercises(opts: {
  query?: string;
  muscle?: MuscleGroup;
  exclude?: readonly string[];
  limit?: number;
}): CatalogHit[] {
  const q = (opts.query ?? '').trim();
  const alias = ALIASES[q.toLowerCase()];
  const hits = searchCatalog(
    alias ?? q,
    (opts.limit ?? 8) + (opts.exclude?.length ?? 0),
    undefined,
    opts.muscle,
  );
  const skip = new Set((opts.exclude ?? []).map((n) => n.toLowerCase()));
  return hits
    .filter((h) => !skip.has(h.names[0].toLowerCase()))
    .slice(0, opts.limit ?? 8)
    .map((h) => ({
      name: h.names[0],
      muscle: h.muscle,
      equipment: h.equipment ?? null,
      image: exerciseImage(h.names[0], 'strength'),
    }));
}

/** Fine muscle groups -> the coarse groups the weekly volume ranges are written for. null = no weekly range. */
export const RANGE_GROUP: Record<MuscleGroup, string | null> = {
  chest: 'chest',
  back: 'back',
  lats: 'back',
  traps: 'back',
  lower_back: 'back',
  shoulders: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  quads: 'quads',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  calves: 'calves',
  core: 'core',
  forearms: null,
  adductors: null,
  abductors: null,
  neck: null,
  fullbody: null,
  cardio: null,
};
