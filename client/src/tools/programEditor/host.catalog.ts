/** Exercise-catalog types of the host contract. Kept apart from host.ts so check/engine.ts and host.ts do not import each other. */
import type { MuscleGroup } from './model/doc';

/** A caution the host attaches to an exercise (the athlete's health limits). Shown beside the name, never blocks. */
export interface ExerciseFlag {
  level: 'caution' | 'avoid';
  /** Words for it, from the host's dictionary ("Not advised for you"). */
  label: string;
}

export interface ExerciseFacts {
  name: string;
  /** Primary muscle first, then secondaries. */
  muscles: MuscleGroup[];
  primary: MuscleGroup | null;
  secondary: MuscleGroup[];
  /** One equipment id (the host's), or null. */
  equipment: string | null;
  /** Picture url. A name the catalog does not know (a custom exercise) has none. */
  image: string | undefined;
  /** Movement direction when the catalog knows it; the check falls back to the primary muscle. */
  force?: 'push' | 'pull' | null;
  flag?: ExerciseFlag | null;
}

export interface CatalogHit {
  /** The host's catalog id (kept on a warm-up reference so the logger can find the exercise). */
  id?: string;
  name: string;
  muscle: MuscleGroup;
  equipment: string | null;
  image: string | undefined;
  flag?: ExerciseFlag | null;
}

export interface ExerciseSearch {
  /** Free text. Empty text with a muscle browses that muscle. */
  query?: string;
  muscle?: MuscleGroup;
  /** Names already used (hidden from the result). */
  exclude?: readonly string[];
  limit?: number;
}

/** Exercise knowledge. Synchronous and local: the editor must work offline and never wait for a network. */
export interface ExerciseCatalog {
  facts(name: string): ExerciseFacts;
  search(q: ExerciseSearch): CatalogHit[];
}

/** One planned-activity type (run, yoga...). The list order is the order of the picker. */
export interface ActivityKind {
  key: string;
  /** Icon name of the shared Icon set. */
  icon: string;
  category: 'conditioning' | 'recovery';
}
