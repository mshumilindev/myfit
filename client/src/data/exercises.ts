/**
 * Built-in exercise catalog sourced from free-exercise-db rich data.
 * Exercise names are English-only; the tuple shape stays for back-compat with
 * older picker/search code.
 */
import DB_RAW from './exercises.db.json';
import RICH_RAW from './exercises.rich.json';
import type { EquipmentId } from './equipment';

export type MuscleGroup =
  | 'chest'
  | 'back'
  // Finer back split (RICH import — free-exercise-db distinguishes these).
  // `back` stays valid for legacy/custom logs; the catalog now emits the finer
  // groups. Every group below has an anatomical region in the body-muscles lib.
  | 'lats'
  | 'traps'
  | 'lower_back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'adductors'
  | 'hamstrings'
  | 'glutes'
  | 'abductors'
  | 'calves'
  | 'core'
  | 'neck'
  | 'fullbody'
  | 'cardio';

export interface CatalogExercise {
  id: string;
  muscle: MuscleGroup;
  names: [string, string, string, string, string];
  /** Equipment (free-exercise-db taxonomy); null = unknown/none listed. */
  equipment?: EquipmentId | null;
}

export type ExerciseForce = 'push' | 'pull' | 'static';
export type ExerciseLevel = 'beginner' | 'intermediate' | 'expert';
export type ExerciseMechanic = 'compound' | 'isolation';
export type ExerciseCategory =
  | 'strength'
  | 'stretching'
  | 'plyometrics'
  | 'strongman'
  | 'powerlifting'
  | 'cardio'
  | 'olympic weightlifting';

export interface RichExercise {
  id: string;
  name: string;
  force: ExerciseForce | null;
  level: ExerciseLevel | null;
  mechanic: ExerciseMechanic | null;
  category: ExerciseCategory | null;
  equipment: EquipmentId | null;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  instructions: string[];
  images: string[];
}

// --- free-exercise-db import (public domain, 873 entries) -------------------
// Compact rows [name, equipment|null, muscle] stay as a legacy fallback; rich
// records are the product catalog.

type DbRow = [string, EquipmentId | null, MuscleGroup];
const DB_ROWS = DB_RAW as DbRow[];
const RICH_EXERCISES = RICH_RAW as RichExercise[];

const RICH_BY_ID = new Map<string, RichExercise>(RICH_EXERCISES.map((e) => [e.id, e]));
const RICH_BY_NAME = new Map<string, RichExercise>(
  RICH_EXERCISES.map((e) => [e.name.trim().toLowerCase(), e]),
);

const RICH_EN = new Set(RICH_EXERCISES.map((e) => e.name.trim().toLowerCase()));

function richPrimary(rich: RichExercise): MuscleGroup {
  return rich.primaryMuscles[0] ?? (rich.category === 'cardio' ? 'cardio' : 'fullbody');
}

function richAsCatalogEntry(rich: RichExercise): CatalogExercise {
  const primary = richPrimary(rich);
  return {
    id: rich.id,
    muscle: primary,
    names: [rich.name, rich.name, rich.name, rich.name, rich.name],
    equipment: rich.equipment,
  };
}

/** Rich DB records as catalog entries (EN name in every slot). */
const RICH_ENTRIES: CatalogExercise[] = RICH_EXERCISES.map(richAsCatalogEntry);

/** Compact DB rows stay as a back-compat fallback when rich data is missing. */
const DB_ENTRIES: CatalogExercise[] = DB_ROWS.filter((r) => !RICH_EN.has(r[0].toLowerCase())).map(
  (r, i) => ({
    id: `db-${i}`,
    muscle: r[2],
    names: [r[0], r[0], r[0], r[0], r[0]],
    equipment: r[1],
  }),
);

export const BUILT_IN_CATALOG: CatalogExercise[] = [...RICH_ENTRIES, ...DB_ENTRIES];

// --- Muscle metadata (design MG/EQ) -----------------------------------------
// An exercise carries one primary group and any number of secondary groups
// from the rich import. Legacy compact rows only carry their primary group.

/** Secondary muscle groups for a catalog entry (possibly empty). */
export function secondaryMusclesOf(ex: CatalogExercise): MuscleGroup[] {
  const custom = CUSTOM_SECONDARIES(ex.id);
  if (custom) return custom;
  const rich = RICH_BY_ID.get(ex.id) ?? RICH_BY_NAME.get(ex.names[0].trim().toLowerCase());
  if (rich) return rich.secondaryMuscles;
  return [];
}

export interface MuscleInfo {
  primary: MuscleGroup;
  secondary: MuscleGroup[];
  equipment: EquipmentId | null;
}

const BY_NAME = new Map<string, CatalogExercise>();
for (const ex of BUILT_IN_CATALOG) {
  for (const n of ex.names) {
    const key = n.trim().toLowerCase();
    if (key && !BY_NAME.has(key)) BY_NAME.set(key, ex);
  }
}

// Back-compat for historical entries logged before exercise names became
// English-only data. Keep this tiny: new names should stay English.
const LEGACY_NAME_ALIASES: Record<string, string> = {
  'bench press': 'Barbell Bench Press - Medium Grip',
  'back squat': 'Barbell Full Squat',
  squat: 'Barbell Full Squat',
  deadlift: 'Barbell Deadlift',
  'incline bench press': 'Barbell Incline Bench Press - Medium Grip',
  'dumbbell bench press': 'Dumbbell Bench Press',
  'lat pulldown': 'Wide-Grip Lat Pulldown',
  'seated cable row': 'Seated Cable Rows',
  'leg extension': 'Leg Extensions',
  'leg curl': 'Lying Leg Curls',
  'hip thrust': 'Barbell Hip Thrust',
  'розведення гантелей лежачи': 'Dumbbell Flyes',
  'пуловер з гантеллю': 'Bent-Arm Dumbbell Pullover',
  'concentration curl': 'Concentration Curls',
};
for (const [alias, canonical] of Object.entries(LEGACY_NAME_ALIASES)) {
  const ex = BY_NAME.get(canonical.toLowerCase());
  if (ex) BY_NAME.set(alias, ex);
}

/**
 * English catalog name for a name typed in any locale; the input is returned
 * untouched for names the catalog does not know.
 */
export function canonicalExerciseName(name: string): string {
  const key = name.trim().toLowerCase();
  return BY_NAME.get(key)?.names[0] ?? name.trim();
}

/** True when the name is a built-in library exercise from free-exercise-db. */
export function isBuiltInExercise(name: string): boolean {
  return BY_NAME.has(name.trim().toLowerCase());
}

export function richExerciseById(id: string | null | undefined): RichExercise | null {
  return id ? (RICH_BY_ID.get(id) ?? null) : null;
}

export function richExerciseByName(name: string | null | undefined): RichExercise | null {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  const ex = BY_NAME.get(key);
  return (ex ? RICH_BY_ID.get(ex.id) : null) ?? RICH_BY_NAME.get(key) ?? null;
}

// --- Server catalog: custom exercises authored by admins/trainers -----------
// The hub keeps a shared exercise_catalog table; entries land here on sync
// and win over the built-in lists, so a just-created exercise resolves its
// muscles and equipment immediately on every device.

export interface CustomExercise {
  id: string;
  name: string;
  kind?: string;
  primaryMuscle: MuscleGroup | null;
  secondaryMuscles: MuscleGroup[];
  equipment: string[];
}

const CUSTOM_CACHE_KEY = 'gym.catalog';
const customByName = new Map<string, CustomExercise>();
let customList: CustomExercise[] = [];

export function registerCustomExercises(list: CustomExercise[]): void {
  customList = list;
  customByName.clear();
  for (const e of list) {
    const key = e.name.trim().toLowerCase();
    if (key) customByName.set(key, e);
  }
  try {
    localStorage.setItem(CUSTOM_CACHE_KEY, JSON.stringify(list));
  } catch {
    /* quota */
  }
}

/** Add/replace one entry locally (right after a PUT, before the next sync). */
export function registerCustomExercise(e: CustomExercise): void {
  registerCustomExercises([...customList.filter((x) => x.id !== e.id), e]);
}

export function customExercises(): CustomExercise[] {
  return customList;
}

try {
  const raw = localStorage.getItem(CUSTOM_CACHE_KEY);
  if (raw) {
    const list = JSON.parse(raw) as CustomExercise[];
    if (Array.isArray(list)) registerCustomExercises(list);
  }
} catch {
  /* corrupted cache — server sync repopulates it */
}

function customAsCatalogEntry(e: CustomExercise): CatalogExercise {
  return {
    id: `custom-${e.id}`,
    muscle: e.primaryMuscle ?? 'fullbody',
    names: [e.name, e.name, e.name, e.name, e.name],
    equipment: (e.equipment[0] as EquipmentId | undefined) ?? null,
  };
}

function CUSTOM_SECONDARIES(id: string): MuscleGroup[] | null {
  const raw = id.startsWith('custom-') ? id.slice('custom-'.length) : null;
  const hit = raw ? customList.find((e) => e.id === raw) : undefined;
  return hit ? hit.secondaryMuscles : null;
}

/** Catalog lookup by (any-locale) exercise name; null for unknown names. */
export function muscleInfoByName(name: string): MuscleInfo | null {
  const key = name.trim().toLowerCase();
  const custom = customByName.get(key);
  if (custom && custom.primaryMuscle) {
    return {
      primary: custom.primaryMuscle,
      secondary: custom.secondaryMuscles,
      equipment: (custom.equipment[0] as EquipmentId | undefined) ?? null,
    };
  }
  const ex = BY_NAME.get(key);
  if (!ex) return null;
  const rich = RICH_BY_ID.get(ex.id) ?? RICH_BY_NAME.get(ex.names[0].trim().toLowerCase());
  if (rich) {
    return {
      primary: richPrimary(rich),
      secondary: rich.secondaryMuscles,
      equipment: rich.equipment,
    };
  }
  return {
    primary: ex.muscle,
    secondary: secondaryMusclesOf(ex),
    equipment: ex.equipment ?? null,
  };
}

/**
 * Case-insensitive search across imported names. `equipment` narrows results
 * to one type.
 */
export function searchCatalog(
  query: string,
  limit = 8,
  equipment?: EquipmentId | null,
  muscle?: MuscleGroup,
): CatalogExercise[] {
  const q = query.trim().toLowerCase();
  if (!q && equipment === undefined && muscle === undefined) return [];
  const custom = customList.map(customAsCatalogEntry);
  // Browsing by filter only draws from custom exercises and the rich import.
  const base = [...custom, ...BUILT_IN_CATALOG];
  let pool =
    equipment === undefined ? base : base.filter((e) => (e.equipment ?? null) === equipment);
  if (muscle !== undefined) {
    pool = pool.filter((e) => e.muscle === muscle || secondaryMusclesOf(e).includes(muscle));
  }
  if (!q) return pool.slice(0, limit);
  const starts: CatalogExercise[] = [];
  const contains: CatalogExercise[] = [];
  for (const ex of pool) {
    const names = ex.names.map((n) => n.toLowerCase());
    if (names.some((n) => n.startsWith(q))) starts.push(ex);
    else if (names.some((n) => n.includes(q))) contains.push(ex);
    if (starts.length >= limit * 2) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
