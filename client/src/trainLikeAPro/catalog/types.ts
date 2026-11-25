/**
 * Train like a pro: the shape of one catalog entry (one variant of a published athlete program).
 * Pure types: no code, so seams and tests can name them without loading the catalog chunk.
 * Entries are read-only; "Start" turns one into a program (`entryToProgram`), the entry itself never changes.
 */
import type { ProgramActivityWhen } from '../../views/programs/model';
import type { EquipmentId } from '../../data/equipment';
import type { ActivityEffort } from '../../types';

/** Era the person trained in, taken from the source only; `unknown` when the source does not say. */
export type CatalogEra =
  'pre-1940' | 'golden-age' | 'arnold-era' | 'mass-monsters' | 'modern' | 'current' | 'unknown';
export type CatalogLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite';
export type CatalogGoal = 'mass' | 'strength' | 'shape' | 'general';
export type CatalogDiscipline = 'bodybuilding' | 'powerlifting' | 'strength' | 'bodyweight';
export type CatalogSplit =
  | 'full-body'
  | 'body-part'
  | 'push-pull-legs'
  | 'lift-per-day'
  | 'single-lift'
  | 'squat-plus'
  | 'daily';
/** How the source relates to the program: the author's own site, a retelling of a book or magazine, or a media article. */
export type CatalogOriginKind = 'official' | 'book' | 'media';
/** The add-ons a program needs besides Gym (its weekly cycle, its supersets). */
export type CatalogNeed = 'periodization' | 'supersets';

export interface CatalogRow {
  day: number;
  position: number;
  /** Exercise name as in the exercise catalog (or an own name when `custom`). */
  name: string;
  kind: 'strength';
  sets: number;
  reps: number;
  equipment: EquipmentId[];
  restSec?: number;
  targetRpe?: number;
  /** Only language-neutral cues ("8–12"); sentences live in the translated copy, never in the data. */
  note?: string;
  groupId?: string;
  groupOrder?: number;
  /** "Just the exercise": no sets or reps in the source. */
  bare?: boolean;
  /** An own exercise the catalog does not have. */
  custom?: boolean;
}

export interface CatalogActivity {
  day: number;
  /** Key in ACTIVITY_TYPES. */
  type: string;
  minutes: number;
  effort: ActivityEffort;
  when: ProgramActivityWhen;
}

export interface CatalogEntry {
  /** Stable slug; the started program's id is `tl-<uid>-<id>`. */
  id: string;
  /** Whose program it is (shown first, in the accent colour). */
  who: string;
  title: string;
  origin: { label: string; kind: CatalogOriginKind };
  era: CatalogEra;
  levels: CatalogLevel[];
  goals: CatalogGoal[];
  discipline: CatalogDiscipline;
  split: CatalogSplit;
  /** Elite programs carry a warning for beginners. */
  elite: boolean;
  /** `null` = the source does not say (never a guess). */
  gender: 'm' | 'f' | null;
  /** Length of the program in weeks (1 = one repeating week). */
  weeks: number;
  daysPerWeek: number;
  dayNames: Record<string, string>;
  needs: CatalogNeed[];
  items: CatalogRow[];
  activities: CatalogActivity[];
}
