/**
 * Fine muscle sub-regions (design "My Fit / Goals" GL-01…GL-04). The app models
 * muscles as the coarse `MuscleGroup` enum, but goals, volume attribution and
 * exercise suggestions want finer resolution where it matters most: the three
 * deltoid heads and the two chest regions. Everything else is a 1:1 pass-through
 * of an existing group, so this layer stays thin.
 *
 * Only `shoulders` and `chest` actually split. `focusToGroup` folds a fine id
 * back to its coarse group so all existing volume/radar math keeps working
 * unchanged; the fine layer only ADDS resolution, it never replaces the coarse
 * model. Rendering: the two split regions map to library SVG ids the
 * `body-muscles` figure already draws (see FOCUS_LIB_IDS); non-split fine ids
 * render through the existing coarse group → library map.
 *
 * Pure data + pure functions. No React/store imports.
 */
import type { MuscleGroup } from './exercises';

export type FocusMuscle =
  // Shoulders split into the three deltoid heads
  | 'delt-front'
  | 'delt-side'
  | 'delt-rear'
  // Chest splits into upper / lower
  | 'chest-upper'
  | 'chest-lower'
  // 1:1 pass-through of an existing MuscleGroup
  | 'lats'
  | 'traps'
  | 'lower_back'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'adductors'
  | 'abductors'
  | 'calves'
  | 'abs';

export const FOCUS_MUSCLES: FocusMuscle[] = [
  'delt-front',
  'delt-side',
  'delt-rear',
  'chest-upper',
  'chest-lower',
  'lats',
  'traps',
  'lower_back',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'abductors',
  'calves',
  'abs',
];

/** Coarse groups that split into fine sub-regions, and into which. */
export const SPLIT_GROUPS: Partial<Record<MuscleGroup, FocusMuscle[]>> = {
  shoulders: ['delt-front', 'delt-side', 'delt-rear'],
  chest: ['chest-upper', 'chest-lower'],
};

/** Fine id → coarse group (so existing MuscleGroup-keyed math still applies). */
const TO_GROUP: Record<FocusMuscle, MuscleGroup> = {
  'delt-front': 'shoulders',
  'delt-side': 'shoulders',
  'delt-rear': 'shoulders',
  'chest-upper': 'chest',
  'chest-lower': 'chest',
  lats: 'lats',
  traps: 'traps',
  lower_back: 'lower_back',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  quads: 'quads',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  adductors: 'adductors',
  abductors: 'abductors',
  calves: 'calves',
  abs: 'core',
};

export function focusToGroup(f: FocusMuscle): MuscleGroup {
  return TO_GROUP[f];
}

/**
 * Coarse group → its fine members. Split groups expand to their sub-regions;
 * groups that have a direct fine id return that single id; groups with no fine
 * representation (e.g. `back`, `neck`, `fullbody`, `cardio`) return [].
 */
export function groupToFocus(g: MuscleGroup): FocusMuscle[] {
  if (SPLIT_GROUPS[g]) return SPLIT_GROUPS[g]!;
  const direct = FOCUS_MUSCLES.filter((f) => TO_GROUP[f] === g);
  return direct;
}

/**
 * `body-muscles` library region ids for the two SPLIT sub-regions, per view.
 * Non-split fine ids are drawn via the coarse group map already living in
 * components/Muscle.tsx, so they are intentionally absent here.
 */
export const FOCUS_LIB_IDS: Partial<Record<FocusMuscle, { front: string[]; back: string[] }>> = {
  'delt-front': { front: ['shoulder-front-left', 'shoulder-front-right'], back: [] },
  'delt-side': { front: ['shoulder-side-left', 'shoulder-side-right'], back: [] },
  'delt-rear': { front: [], back: ['deltoid-rear-left', 'deltoid-rear-right'] },
  'chest-upper': { front: ['chest-upper-left', 'chest-upper-right'], back: [] },
  'chest-lower': { front: ['chest-lower-left', 'chest-lower-right'], back: [] },
};

/** English fallback labels (real i18n lives in the strings dictionary). */
export const FOCUS_LABEL_EN: Record<FocusMuscle, string> = {
  'delt-front': 'Front delt',
  'delt-side': 'Side delt',
  'delt-rear': 'Rear delt',
  'chest-upper': 'Upper chest',
  'chest-lower': 'Lower chest',
  lats: 'Lats',
  traps: 'Traps',
  lower_back: 'Lower back',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  adductors: 'Adductors',
  abductors: 'Abductors',
  calves: 'Calves',
  abs: 'Abs',
};

/** Exercise-level sub-region attribution, stored additively on rich records. */
export interface ExerciseSubRegions {
  /** Fine regions of the exercise's PRIMARY split group(s). */
  primary: FocusMuscle[];
  /** Fine regions of any SECONDARY split group(s). */
  secondary?: FocusMuscle[];
}
