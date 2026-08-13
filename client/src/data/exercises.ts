/**
 * Built-in exercise catalog: curated, offline, fully localised (en/uk/pl/lt/et).
 * Search matches any language. History entries always rank above the catalog.
 * Names tuple order: [en, uk, pl, lt, et].
 */
import DB_RAW from './exercises.db.json';
import RICH_RAW from './exercises.rich.json';
import type { EquipmentId } from './equipment';

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
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

const x = (id: string, muscle: MuscleGroup, en: string): CatalogExercise => ({
  id,
  muscle,
  names: [en, en, en, en, en],
});

export const EXERCISE_CATALOG: CatalogExercise[] = [
  // --- Chest ---------------------------------------------------------------
  x('bench-press', 'chest', 'Bench Press'),
  x('incline-bench-press', 'chest', 'Incline Bench Press'),
  x('decline-bench-press', 'chest', 'Decline Bench Press'),
  x('dumbbell-bench-press', 'chest', 'Dumbbell Bench Press'),
  x('incline-dumbbell-press', 'chest', 'Incline Dumbbell Press'),
  x('dumbbell-fly', 'chest', 'Dumbbell Fly'),
  x('incline-dumbbell-fly', 'chest', 'Incline Dumbbell Fly'),
  x('cable-crossover', 'chest', 'Cable Crossover'),
  x('pec-deck', 'chest', 'Pec Deck (Machine Fly)'),
  x('chest-press-machine', 'chest', 'Chest Press Machine'),
  x('push-up', 'chest', 'Push-Up'),
  x('weighted-push-up', 'chest', 'Weighted Push-Up'),
  x('dips-chest', 'chest', 'Chest Dips'),
  x('smith-bench-press', 'chest', 'Smith Machine Bench Press'),
  x('svend-press', 'chest', 'Svend Press'),
  x('floor-press', 'chest', 'Floor Press'),
  x('pullover', 'chest', 'Dumbbell Pullover'),

  // --- Back ----------------------------------------------------------------
  x('deadlift', 'back', 'Deadlift'),
  x('romanian-deadlift', 'hamstrings', 'Romanian Deadlift'),
  x('sumo-deadlift', 'back', 'Sumo Deadlift'),
  x('pull-up', 'back', 'Pull-Up'),
  x('chin-up', 'back', 'Chin-Up'),
  x('weighted-pull-up', 'back', 'Weighted Pull-Up'),
  x('lat-pulldown', 'back', 'Lat Pulldown'),
  x('close-grip-pulldown', 'back', 'Close-Grip Pulldown'),
  x('barbell-row', 'back', 'Barbell Row'),
  x('pendlay-row', 'back', 'Pendlay Row'),
  x('dumbbell-row', 'back', 'One-Arm Dumbbell Row'),
  x('seated-cable-row', 'back', 'Seated Cable Row'),
  x('t-bar-row', 'back', 'T-Bar Row'),
  x('chest-supported-row', 'back', 'Chest-Supported Row'),
  x('machine-row', 'back', 'Machine Row'),
  x('straight-arm-pulldown', 'back', 'Straight-Arm Pulldown'),
  x('rack-pull', 'back', 'Rack Pull'),
  x('good-morning', 'hamstrings', 'Good Morning'),
  x('back-extension', 'back', 'Back Extension'),
  x('shrug', 'back', 'Barbell Shrug'),
  x('dumbbell-shrug', 'back', 'Dumbbell Shrug'),
  x('inverted-row', 'back', 'Inverted Row'),

  // --- Shoulders -----------------------------------------------------------
  x('overhead-press', 'shoulders', 'Overhead Press'),
  x('seated-dumbbell-press', 'shoulders', 'Seated Dumbbell Press'),
  x('arnold-press', 'shoulders', 'Arnold Press'),
  x('push-press', 'shoulders', 'Push Press'),
  x('lateral-raise', 'shoulders', 'Lateral Raise'),
  x('cable-lateral-raise', 'shoulders', 'Cable Lateral Raise'),
  x('front-raise', 'shoulders', 'Front Raise'),
  x('rear-delt-fly', 'shoulders', 'Rear Delt Fly'),
  x('face-pull', 'shoulders', 'Face Pull'),
  x('upright-row', 'shoulders', 'Upright Row'),
  x('machine-shoulder-press', 'shoulders', 'Machine Shoulder Press'),
  x('reverse-pec-deck', 'shoulders', 'Reverse Pec Deck'),

  // --- Biceps --------------------------------------------------------------
  x('barbell-curl', 'biceps', 'Barbell Curl'),
  x('ez-bar-curl', 'biceps', 'EZ-Bar Curl'),
  x('dumbbell-curl', 'biceps', 'Dumbbell Curl'),
  x('hammer-curl', 'biceps', 'Hammer Curl'),
  x('incline-curl', 'biceps', 'Incline Dumbbell Curl'),
  x('preacher-curl', 'biceps', 'Preacher Curl'),
  x('concentration-curl', 'biceps', 'Concentration Curl'),
  x('cable-curl', 'biceps', 'Cable Curl'),
  x('spider-curl', 'biceps', 'Spider Curl'),

  // --- Triceps -------------------------------------------------------------
  x('close-grip-bench', 'triceps', 'Close-Grip Bench Press'),
  x('dips-triceps', 'triceps', 'Triceps Dips'),
  x('bench-dips', 'triceps', 'Bench Dips'),
  x('triceps-pushdown', 'triceps', 'Triceps Pushdown'),
  x('rope-pushdown', 'triceps', 'Rope Pushdown'),
  x('overhead-triceps-extension', 'triceps', 'Overhead Triceps Extension'),
  x('skull-crusher', 'triceps', 'Skull Crusher'),
  x('triceps-kickback', 'triceps', 'Triceps Kickback'),

  // --- Forearms ------------------------------------------------------------
  x('wrist-curl', 'forearms', 'Wrist Curl'),
  x('reverse-curl', 'forearms', 'Reverse Curl'),
  x('farmers-walk', 'forearms', "Farmer's Walk"),
  x('dead-hang', 'forearms', 'Dead Hang'),

  // --- Quads / legs --------------------------------------------------------
  x('back-squat', 'quads', 'Back Squat'),
  x('front-squat', 'quads', 'Front Squat'),
  x('goblet-squat', 'quads', 'Goblet Squat'),
  x('smith-squat', 'quads', 'Smith Machine Squat'),
  x('hack-squat', 'quads', 'Hack Squat'),
  x('leg-press', 'quads', 'Leg Press'),
  x('bulgarian-split-squat', 'quads', 'Bulgarian Split Squat'),
  x('lunge', 'quads', 'Lunge'),
  x('walking-lunge', 'quads', 'Walking Lunge'),
  x('reverse-lunge', 'quads', 'Reverse Lunge'),
  x('step-up', 'quads', 'Step-Up'),
  x('leg-extension', 'quads', 'Leg Extension'),
  x('sissy-squat', 'quads', 'Sissy Squat'),
  x('box-squat', 'quads', 'Box Squat'),
  x('pause-squat', 'quads', 'Pause Squat'),
  x('pistol-squat', 'quads', 'Pistol Squat'),

  // --- Hamstrings / glutes -------------------------------------------------
  x('leg-curl', 'hamstrings', 'Lying Leg Curl'),
  x('seated-leg-curl', 'hamstrings', 'Seated Leg Curl'),
  x('nordic-curl', 'hamstrings', 'Nordic Hamstring Curl'),
  x('stiff-leg-deadlift', 'hamstrings', 'Stiff-Leg Deadlift'),
  x('hip-thrust', 'glutes', 'Hip Thrust'),
  x('glute-bridge', 'glutes', 'Glute Bridge'),
  x('cable-kickback', 'glutes', 'Cable Glute Kickback'),
  x('hip-abduction', 'glutes', 'Hip Abduction Machine'),
  x('hip-adduction', 'glutes', 'Hip Adduction Machine'),
  x('kettlebell-swing', 'glutes', 'Kettlebell Swing'),

  // --- Calves --------------------------------------------------------------
  x('standing-calf-raise', 'calves', 'Standing Calf Raise'),
  x('seated-calf-raise', 'calves', 'Seated Calf Raise'),
  x('calf-press', 'calves', 'Calf Press (Leg Press)'),

  // --- Core ----------------------------------------------------------------
  x('plank', 'core', 'Plank'),
  x('side-plank', 'core', 'Side Plank'),
  x('crunch', 'core', 'Crunch'),
  x('cable-crunch', 'core', 'Cable Crunch'),
  x('sit-up', 'core', 'Sit-Up'),
  x('hanging-leg-raise', 'core', 'Hanging Leg Raise'),
  x('hanging-knee-raise', 'core', 'Hanging Knee Raise'),
  x('leg-raise', 'core', 'Lying Leg Raise'),
  x('russian-twist', 'core', 'Russian Twist'),
  x('ab-wheel', 'core', 'Ab Wheel Rollout'),
  x('dead-bug', 'core', 'Dead Bug'),
  x('bird-dog', 'core', 'Bird Dog'),
  x('mountain-climbers', 'core', 'Mountain Climbers'),
  x('pallof-press', 'core', 'Pallof Press'),
  x('woodchopper', 'core', 'Cable Woodchopper'),
  x('hyperextension-oblique', 'core', 'Side Bend'),

  // --- Full body / olympic -------------------------------------------------
  x('clean-and-jerk', 'fullbody', 'Clean and Jerk'),
  x('snatch', 'fullbody', 'Snatch'),
  x('power-clean', 'fullbody', 'Power Clean'),
  x('thruster', 'fullbody', 'Thruster'),
  x('burpee', 'fullbody', 'Burpee'),
  x('turkish-get-up', 'fullbody', 'Turkish Get-Up'),
  x('sled-push', 'fullbody', 'Sled Push'),
  x('battle-ropes', 'fullbody', 'Battle Ropes'),
  x('box-jump', 'fullbody', 'Box Jump'),
  x('wall-ball', 'fullbody', 'Wall Ball'),
  x('medicine-ball-slam', 'fullbody', 'Medicine Ball Slam'),

  // --- Cardio --------------------------------------------------------------
  x('treadmill-run', 'cardio', 'Treadmill Run'),
  x('treadmill-walk-incline', 'cardio', 'Incline Treadmill Walk'),
  x('stationary-bike', 'cardio', 'Stationary Bike'),
  x('rowing-machine', 'cardio', 'Rowing Machine'),
  x('elliptical', 'cardio', 'Elliptical'),
  x('stair-climber', 'cardio', 'Stair Climber'),
  x('assault-bike', 'cardio', 'Assault Bike'),
  x('ski-erg', 'cardio', 'Ski Erg'),
  x('bent-over-row', 'back', 'Bent-over Row'),
  x('leg-curl', 'hamstrings', 'Leg Curl'),
  x('calf-raise', 'calves', 'Calf Raise'),
  x('jump-rope', 'cardio', 'Jump Rope'),
];

// --- free-exercise-db import (public domain, 873 entries) -------------------
// Compact rows [name, equipment|null, muscle]. English-only names; the curated
// localized catalog above stays first-class and DB rows fill the long tail.

type DbRow = [string, EquipmentId | null, MuscleGroup];
const DB_ROWS = DB_RAW as DbRow[];
const RICH_EXERCISES = RICH_RAW as RichExercise[];

const RICH_BY_ID = new Map<string, RichExercise>(RICH_EXERCISES.map((e) => [e.id, e]));
const RICH_BY_NAME = new Map<string, RichExercise>(
  RICH_EXERCISES.map((e) => [e.name.trim().toLowerCase(), e]),
);

/** Curated EN name (lowercased) → equipment, learned from the DB by name. */
const DB_EQUIP_BY_NAME = new Map<string, EquipmentId | null>([
  ...DB_ROWS.map((r): [string, EquipmentId | null] => [r[0].toLowerCase(), r[1]]),
  ...RICH_EXERCISES.map((r): [string, EquipmentId | null] => [
    r.name.trim().toLowerCase(),
    r.equipment,
  ]),
]);

/**
 * Equipment for curated entries the DB cannot match by name (its names differ:
 * "Dumbbell Fly" vs "Dumbbell Flyes"). Equipment drives the per-hand factor and
 * the gym-inventory check, so a blank here silently under-counts volume.
 */
const EXTRA_EQUIP: Record<string, EquipmentId> = {
  'bent-over-row': 'barbell',
  'leg-curl': 'machine',
  'calf-raise': 'body',
  // chest
  'bench-press': 'barbell',
  'incline-bench-press': 'barbell',
  'decline-bench-press': 'barbell',
  'dumbbell-fly': 'dumbbell',
  'incline-dumbbell-fly': 'dumbbell',
  'pec-deck': 'machine',
  'chest-press-machine': 'machine',
  'push-up': 'body',
  'weighted-push-up': 'body',
  'dips-chest': 'body',
  pullover: 'dumbbell',
  // back
  deadlift: 'barbell',
  'pull-up': 'body',
  'weighted-pull-up': 'body',
  'lat-pulldown': 'cable',
  'close-grip-pulldown': 'cable',
  'barbell-row': 'barbell',
  'pendlay-row': 'barbell',
  'seated-cable-row': 'cable',
  't-bar-row': 'barbell',
  'chest-supported-row': 'machine',
  'machine-row': 'machine',
  'rack-pull': 'barbell',
  'back-extension': 'body',
  'inverted-row': 'body',
  'dead-hang': 'body',
  // shoulders
  'overhead-press': 'barbell',
  'arnold-press': 'dumbbell',
  'lateral-raise': 'dumbbell',
  'cable-lateral-raise': 'cable',
  'front-raise': 'dumbbell',
  'rear-delt-fly': 'dumbbell',
  'upright-row': 'barbell',
  'machine-shoulder-press': 'machine',
  'reverse-pec-deck': 'machine',
  // arms
  'dumbbell-curl': 'dumbbell',
  'hammer-curl': 'dumbbell',
  'concentration-curl': 'dumbbell',
  'cable-curl': 'cable',
  'close-grip-bench': 'barbell',
  'dips-triceps': 'body',
  'rope-pushdown': 'cable',
  'overhead-triceps-extension': 'dumbbell',
  'skull-crusher': 'ezBar',
  'triceps-kickback': 'dumbbell',
  'wrist-curl': 'barbell',
  'reverse-curl': 'barbell',
  // legs & glutes
  'back-squat': 'barbell',
  'front-squat': 'barbell',
  'bulgarian-split-squat': 'dumbbell',
  lunge: 'dumbbell',
  'walking-lunge': 'dumbbell',
  'reverse-lunge': 'dumbbell',
  'step-up': 'dumbbell',
  'leg-extension': 'machine',
  'sissy-squat': 'body',
  'pause-squat': 'barbell',
  'pistol-squat': 'body',
  'nordic-curl': 'body',
  'stiff-leg-deadlift': 'barbell',
  'hip-thrust': 'barbell',
  'glute-bridge': 'body',
  'cable-kickback': 'cable',
  'hip-abduction': 'machine',
  'hip-adduction': 'machine',
  'kettlebell-swing': 'kettlebell',
  'standing-calf-raise': 'body',
  'calf-press': 'machine',
  // core
  'side-plank': 'body',
  crunch: 'body',
  'hanging-knee-raise': 'body',
  'leg-raise': 'body',
  'ab-wheel': 'other',
  'bird-dog': 'body',
  'mountain-climbers': 'body',
  woodchopper: 'cable',
  'hyperextension-oblique': 'dumbbell',
  // full body & cardio
  thruster: 'barbell',
  burpee: 'body',
  'turkish-get-up': 'kettlebell',
  'battle-ropes': 'other',
  'box-jump': 'body',
  'wall-ball': 'medicineBall',
  'medicine-ball-slam': 'medicineBall',
  'treadmill-run': 'machine',
  'treadmill-walk-incline': 'machine',
  'stationary-bike': 'machine',
  'rowing-machine': 'machine',
  elliptical: 'machine',
  'stair-climber': 'machine',
  'assault-bike': 'machine',
  'ski-erg': 'machine',
  'jump-rope': 'other',
};

const CURATED_EN = new Set(EXERCISE_CATALOG.map((e) => e.names[0].toLowerCase()));
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

/** Curated entries enriched with equipment where the DB knows the same name. */
export const CURATED: CatalogExercise[] = EXERCISE_CATALOG.map((e) => ({
  ...e,
  equipment:
    e.equipment ?? EXTRA_EQUIP[e.id] ?? DB_EQUIP_BY_NAME.get(e.names[0].toLowerCase()) ?? null,
}));

/** Rich DB records as catalog entries (EN name in every slot), minus curated dupes. */
const RICH_ENTRIES: CatalogExercise[] = RICH_EXERCISES.filter(
  (r) => !CURATED_EN.has(r.name.trim().toLowerCase()),
).map(richAsCatalogEntry);

/** Compact DB rows stay as a back-compat fallback when rich data is missing. */
const DB_ENTRIES: CatalogExercise[] = DB_ROWS.filter(
  (r) => !CURATED_EN.has(r[0].toLowerCase()) && !RICH_EN.has(r[0].toLowerCase()),
).map((r, i) => ({
  id: `db-${i}`,
  muscle: r[2],
  names: [r[0], r[0], r[0], r[0], r[0]],
  equipment: r[1],
}));

export const BUILT_IN_CATALOG: CatalogExercise[] = [...CURATED, ...RICH_ENTRIES, ...DB_ENTRIES];

// --- Muscle metadata (design MG/EQ) -----------------------------------------
// An exercise carries one primary group and any number of secondary ones
// (EQ-4). Secondaries for curated entries are listed explicitly where the
// boards show them; the long tail falls back to movement-pattern keywords.

const SECONDARY_BY_ID: Record<string, MuscleGroup[]> = {
  'bent-over-row': ['biceps'],
  'leg-curl': [],
  'calf-raise': [],
  'back-squat': ['glutes', 'core'],
  'front-squat': ['core'],
  'bulgarian-split-squat': ['glutes'],
  'goblet-squat': ['core'],
  'zercher-squat': ['core', 'back'],
  'hack-squat': ['glutes'],
  'barbell-lunge': ['glutes'],
  'leg-press': ['glutes'],
  'bench-press': ['triceps'],
  'incline-bench-press': ['triceps', 'shoulders'],
  'decline-bench-press': ['triceps'],
  'dumbbell-bench-press': ['triceps'],
  'incline-dumbbell-press': ['triceps', 'shoulders'],
  'romanian-deadlift': ['glutes', 'back'],
  deadlift: ['glutes', 'hamstrings', 'back'],
  'hip-thrust': ['hamstrings'],
};

const SECONDARY_RULES: Array<[RegExp, MuscleGroup, MuscleGroup[]]> = [
  [/squat|lunge|leg press/i, 'quads', ['glutes']],
  [/bench|push-?up|press/i, 'chest', ['triceps']],
  [/row|pull-?up|pulldown|chin/i, 'back', ['biceps']],
  [/deadlift/i, 'hamstrings', ['glutes', 'back']],
  [/deadlift/i, 'back', ['glutes', 'hamstrings']],
  [/overhead|shoulder press|military/i, 'shoulders', ['triceps']],
  [/dip/i, 'triceps', ['chest']],
  [/thrust|bridge/i, 'glutes', ['hamstrings']],
];

/** Secondary muscle groups for a catalog entry (possibly empty). */
export function secondaryMusclesOf(ex: CatalogExercise): MuscleGroup[] {
  const custom = CUSTOM_SECONDARIES(ex.id);
  if (custom) return custom;
  const rich = RICH_BY_ID.get(ex.id) ?? RICH_BY_NAME.get(ex.names[0].trim().toLowerCase());
  if (rich) return rich.secondaryMuscles;
  const explicit = SECONDARY_BY_ID[ex.id];
  if (explicit) return explicit;
  for (const [re, primary, secondaries] of SECONDARY_RULES) {
    if (primary === ex.muscle && re.test(ex.names[0])) return secondaries;
  }
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
  'розведення гантелей лежачи': 'Dumbbell Fly',
  'пуловер з гантеллю': 'Dumbbell Pullover',
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

/** True when the name is a built-in library exercise (curated or free-db). */
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
 * Case-insensitive search across every locale name (curated first, then the
 * free-exercise-db long tail). `equipment` narrows results to one type.
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
  // Browsing by filter only (no typed query) draws from the hand-verified
  // curated list + the user's own custom exercises. The rich free-exercise-db
  // import has cleaned muscle tags, so the long tail is safe to browse.
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
