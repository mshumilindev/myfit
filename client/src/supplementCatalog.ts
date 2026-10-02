/**
 * Supplements: the bundled catalog and the pure arithmetic around it (no React, no store, no
 * I/O). The user cannot create items: every entry points at one of the 31 items here, which
 * carry the unit, the dose presets, the usual timing and schedule, the evidence level and the
 * kind of effect (if any) the app models. Same shape as `alcoholCatalog.ts`.
 *
 * Evidence tags follow the design canvas: Strong / Moderate / Weak. Only creatine, caffeine
 * and protein carry a modelled effect (`effect`); everything else is "tracked, no estimated
 * effect" (it is saved, shown, and may carry safety warnings, but moves no number).
 *
 * Figures marked "assumption" (the protein share of a powder, the caffeine in a scoop of
 * pre-workout) are typical label values, not research results.
 */
import type {
  SupplementEntry,
  SupplementGroup,
  SupplementId,
  SupplementSchedule,
  SupplementTiming,
  SupplementUnit,
} from './types';

export type SupplementEvidence = 'strong' | 'moderate' | 'weak';

/** Which calculation, if any, an item feeds (see `supplements.ts`). */
export type SupplementEffectKind = 'creatine' | 'caffeine' | 'protein' | 'none';

/** Safety flags an item carries (the UI maps each key to a translated text). */
export type SupplementWarningKey =
  | 'kidney'
  | 'hypertension'
  | 'anticoagulants'
  | 'wada'
  | 'pregnancy'
  | 'minors'
  | 'antioxidantBlunt'
  | 'ashwagandha'
  | 'deficiencyOnly'
  | 'giUpset';

export const SUPPLEMENT_WARNING_KEYS: readonly SupplementWarningKey[] = [
  'kidney',
  'hypertension',
  'anticoagulants',
  'wada',
  'pregnancy',
  'minors',
  'antioxidantBlunt',
  'ashwagandha',
  'deficiencyOnly',
  'giUpset',
];

// --- Sources -----------------------------------------------------------------------------------

export type SupplementSourceKey =
  | 'creatine'
  | 'caffeine'
  | 'protein'
  | 'betaAlanine'
  | 'bicarbonate'
  | 'melatonin'
  | 'vitaminD'
  | 'antioxidants';

export interface SupplementSource {
  /** Short citation (not translated). */
  cite: string;
  /** Not verified against the paper: shown with "approx.". */
  approx: boolean;
}

export const SUPPLEMENT_SOURCES: Record<SupplementSourceKey, SupplementSource> = {
  creatine: { cite: 'Creatine: Kreider 2017, JISSN; Lanhers 2017, Sports Med', approx: false },
  caffeine: { cite: 'Caffeine: Guest 2021, JISSN; Gardiner 2023, Sleep Med Rev', approx: false },
  protein: { cite: 'Protein: Jäger 2017, JISSN; Morton 2018, BJSM', approx: false },
  betaAlanine: { cite: 'Beta-alanine: Saunders 2017, BJSM', approx: false },
  bicarbonate: { cite: 'Bicarbonate: Grgic 2021, JISSN', approx: false },
  melatonin: {
    cite: 'Melatonin: Ferracioli-Oda 2013, PLoS One (not re-verified)',
    approx: true,
  },
  vitaminD: { cite: 'Vitamin D: Beaudart 2014, JCEM; Tomlinson 2015, JSAMS', approx: false },
  antioxidants: { cite: 'Antioxidants: Paulsen 2014, J Physiol', approx: false },
};

/** The one disclaimer the UI shows under every effect (English fallback). */
export const SUPPLEMENT_DISCLAIMER_KEY = 'supplementDisclaimer';
export const SUPPLEMENT_DISCLAIMER_EN =
  'Supplement effects are small, vary between people, and come from studies, not guarantees. This app does not change your training load because of a supplement. Not medical advice. Ask a doctor if you have a condition or take medication.';

/** What a tracked item with no modelled effect says (English fallback). */
export const SUPPLEMENT_NO_EFFECT_EN = 'Tracked, no estimated effect';

// --- Items ------------------------------------------------------------------------------------

export interface SupplementItem {
  id: SupplementId;
  group: SupplementGroup;
  /** English name (fallback). */
  label: string;
  /** Short name for summaries ("Creatine", "Whey"). */
  short: string;
  /** One line of what it is used for (fallback). */
  blurb: string;
  /** Phosphor icon key in the ICONS registry (`ui.tsx`). */
  icon: string;
  unit: SupplementUnit;
  /** Dose presets (sorted, distinct, within min..max). */
  presets: readonly number[];
  defaultDose: number;
  minDose: number;
  maxDose: number;
  /** Stepper increment. */
  step: number;
  /** The usual range in the item's unit, for the "Typical serving" row. */
  typical: readonly [number, number];
  /** Per kg of body weight instead (sodium bicarbonate), same unit. */
  typicalPerKg?: readonly [number, number];
  timing: SupplementTiming;
  schedule: SupplementSchedule;
  evidence: SupplementEvidence;
  /** Key into `SUPPLEMENT_SOURCES`; null = no citation (tracked, no estimated effect). */
  source: SupplementSourceKey | null;
  effect: SupplementEffectKind;
  /**
   * Protein effect only: grams of protein in ONE `defaultDose`. ASSUMPTION: typical label
   * values (whey / casein about 80 % protein by weight, plant blends 75 %, EAA mixes 90 %).
   */
  proteinGramsPerServing?: number;
  /**
   * Caffeine effect only: mg of caffeine per 1 unit of dose. Caffeine itself 1 mg per mg;
   * a pre-workout scoop is an ASSUMPTION (200 mg, a typical label value).
   */
  caffeineMgPerUnit?: number;
  warnings: readonly SupplementWarningKey[];
}

type ItemInput = Omit<SupplementItem, 'effect' | 'warnings' | 'source'> &
  Partial<Pick<SupplementItem, 'effect' | 'warnings' | 'source'>>;
const def = (i: ItemInput): SupplementItem => ({
  effect: 'none',
  warnings: [],
  source: null,
  ...i,
});

export const SUPPLEMENT_ITEMS: readonly SupplementItem[] = [
  // --- Performance (7) ---
  def({
    id: 'creatine',
    group: 'performance',
    label: 'Creatine monohydrate',
    short: 'Creatine',
    blurb: 'Strength and power in short, hard efforts',
    icon: 'barbell',
    unit: 'g',
    presets: [3, 4, 5],
    defaultDose: 5,
    minDose: 1,
    maxDose: 20,
    step: 1,
    typical: [3, 5],
    timing: 'anytime',
    schedule: 'daily',
    evidence: 'strong',
    source: 'creatine',
    effect: 'creatine',
    warnings: ['kidney'],
  }),
  def({
    id: 'caffeine',
    group: 'performance',
    label: 'Caffeine',
    short: 'Caffeine',
    blurb: 'Alertness and a little more output when you train',
    icon: 'coffee',
    unit: 'mg',
    presets: [100, 200, 300, 400],
    defaultDose: 200,
    minDose: 25,
    maxDose: 800,
    step: 25,
    typical: [100, 400],
    timing: 'preWorkout',
    schedule: 'trainingDays',
    evidence: 'strong',
    source: 'caffeine',
    effect: 'caffeine',
    caffeineMgPerUnit: 1,
    warnings: ['pregnancy', 'minors', 'hypertension'],
  }),
  def({
    id: 'preWorkout',
    group: 'performance',
    label: 'Pre-workout blend',
    short: 'Pre-workout',
    blurb: 'A mix, usually with caffeine; check the label',
    icon: 'lightning',
    unit: 'scoop',
    presets: [0.5, 1, 1.5],
    defaultDose: 1,
    minDose: 0.5,
    maxDose: 3,
    step: 0.5,
    typical: [1, 1],
    timing: 'preWorkout',
    schedule: 'trainingDays',
    evidence: 'moderate',
    source: 'caffeine',
    effect: 'caffeine',
    caffeineMgPerUnit: 200, // assumption: a typical label value per scoop
    warnings: ['hypertension', 'pregnancy', 'minors', 'wada'],
  }),
  def({
    id: 'betaAlanine',
    group: 'performance',
    label: 'Beta-alanine',
    short: 'Beta-alanine',
    blurb: 'Hard efforts of one to four minutes',
    icon: 'flask',
    unit: 'g',
    presets: [3.2, 4.8, 6.4],
    defaultDose: 3.2,
    minDose: 0.8,
    maxDose: 12,
    step: 0.8,
    typical: [3.2, 6.4],
    timing: 'withMeal',
    schedule: 'daily',
    evidence: 'moderate',
    source: 'betaAlanine',
  }),
  def({
    id: 'citrulline',
    group: 'performance',
    label: 'Citrulline',
    short: 'Citrulline',
    blurb: 'Used for blood flow and endurance in repeated sets',
    icon: 'test-tube',
    unit: 'g',
    presets: [6, 8],
    defaultDose: 6,
    minDose: 1,
    maxDose: 15,
    step: 1,
    typical: [6, 8],
    timing: 'preWorkout',
    schedule: 'trainingDays',
    evidence: 'moderate',
  }),
  def({
    id: 'nitrate',
    group: 'performance',
    label: 'Nitrates (beetroot)',
    short: 'Nitrates',
    blurb: 'Endurance efforts; a beetroot shot',
    icon: 'drop',
    unit: 'ml',
    presets: [70, 140],
    defaultDose: 70,
    minDose: 35,
    maxDose: 280,
    step: 35,
    typical: [70, 70],
    timing: 'preWorkout',
    schedule: 'trainingDays',
    evidence: 'moderate',
  }),
  def({
    id: 'bicarbonate',
    group: 'performance',
    label: 'Sodium bicarbonate',
    short: 'Bicarbonate',
    blurb: 'Short, very hard efforts',
    icon: 'flask',
    unit: 'g',
    presets: [10, 15, 20],
    defaultDose: 15,
    minDose: 2,
    maxDose: 40,
    step: 1,
    typical: [10, 20],
    typicalPerKg: [0.2, 0.3],
    timing: 'preWorkout',
    schedule: 'trainingDays',
    evidence: 'moderate',
    source: 'bicarbonate',
    warnings: ['kidney', 'hypertension', 'giUpset'],
  }),
  // --- Protein and aminos (8) ---
  def({
    id: 'whey',
    group: 'protein',
    label: 'Whey protein',
    short: 'Whey',
    blurb: 'A convenient way to reach your protein target',
    icon: 'barbell',
    unit: 'g',
    presets: [20, 25, 30],
    defaultDose: 25,
    minDose: 5,
    maxDose: 100,
    step: 5,
    typical: [20, 30],
    timing: 'postWorkout',
    schedule: 'daily',
    evidence: 'strong',
    source: 'protein',
    effect: 'protein',
    proteinGramsPerServing: 20, // assumption: about 80 % protein by weight
    warnings: ['kidney'],
  }),
  def({
    id: 'casein',
    group: 'protein',
    label: 'Casein',
    short: 'Casein',
    blurb: 'Slow protein, often taken in the evening',
    icon: 'barbell',
    unit: 'g',
    presets: [25, 30, 40],
    defaultDose: 30,
    minDose: 5,
    maxDose: 100,
    step: 5,
    typical: [25, 40],
    timing: 'evening',
    schedule: 'daily',
    evidence: 'moderate',
    source: 'protein',
    effect: 'protein',
    proteinGramsPerServing: 24, // assumption: about 80 % protein by weight
    warnings: ['kidney'],
  }),
  def({
    id: 'plantProtein',
    group: 'protein',
    label: 'Plant protein',
    short: 'Plant protein',
    blurb: 'Pea, rice or soy blends',
    icon: 'grains',
    unit: 'g',
    presets: [25, 30],
    defaultDose: 30,
    minDose: 5,
    maxDose: 100,
    step: 5,
    typical: [25, 30],
    timing: 'withMeal',
    schedule: 'daily',
    evidence: 'moderate',
    source: 'protein',
    effect: 'protein',
    proteinGramsPerServing: 22, // assumption: about 75 % protein by weight
    warnings: ['kidney'],
  }),
  def({
    id: 'eaa',
    group: 'protein',
    label: 'Essential amino acids (EAA)',
    short: 'EAA',
    blurb: 'The amino acids you cannot make yourself',
    icon: 'flask',
    unit: 'g',
    presets: [10, 15],
    defaultDose: 10,
    minDose: 2,
    maxDose: 40,
    step: 1,
    typical: [10, 15],
    timing: 'postWorkout',
    schedule: 'daily',
    evidence: 'weak',
    source: 'protein',
    effect: 'protein',
    proteinGramsPerServing: 9, // assumption: about 90 % amino acids by weight
  }),
  def({
    id: 'bcaa',
    group: 'protein',
    label: 'BCAA',
    short: 'BCAA',
    blurb: 'Three of the essential amino acids',
    icon: 'flask',
    unit: 'g',
    presets: [5, 10],
    defaultDose: 5,
    minDose: 1,
    maxDose: 30,
    step: 1,
    typical: [5, 10],
    timing: 'preWorkout',
    schedule: 'trainingDays',
    evidence: 'weak',
  }),
  def({
    id: 'glutamine',
    group: 'protein',
    label: 'Glutamine',
    short: 'Glutamine',
    blurb: 'Popular for recovery; little evidence for training',
    icon: 'flask',
    unit: 'g',
    presets: [5, 10],
    defaultDose: 5,
    minDose: 1,
    maxDose: 30,
    step: 1,
    typical: [5, 10],
    timing: 'postWorkout',
    schedule: 'daily',
    evidence: 'weak',
  }),
  def({
    id: 'hmb',
    group: 'protein',
    label: 'HMB',
    short: 'HMB',
    blurb: 'A leucine metabolite; weak evidence in trained people',
    icon: 'pill',
    unit: 'g',
    presets: [1.5, 3],
    defaultDose: 3,
    minDose: 0.5,
    maxDose: 6,
    step: 0.5,
    typical: [3, 3],
    timing: 'anytime',
    schedule: 'daily',
    evidence: 'weak',
  }),
  def({
    id: 'collagen',
    group: 'protein',
    label: 'Collagen',
    short: 'Collagen',
    blurb: 'Tendons and joints; not a complete protein',
    icon: 'egg',
    unit: 'g',
    presets: [10, 15, 20],
    defaultDose: 10,
    minDose: 2,
    maxDose: 40,
    step: 1,
    typical: [10, 20],
    timing: 'anytime',
    schedule: 'daily',
    evidence: 'weak',
  }),
  // --- Recovery and sleep (7) ---
  def({
    id: 'magnesium',
    group: 'recovery',
    label: 'Magnesium',
    short: 'Magnesium',
    blurb: 'Cramps and sleep; weak evidence',
    icon: 'moon-stars',
    unit: 'mg',
    presets: [200, 300, 400],
    defaultDose: 300,
    minDose: 50,
    maxDose: 800,
    step: 50,
    typical: [200, 400],
    timing: 'evening',
    schedule: 'daily',
    evidence: 'weak',
    warnings: ['kidney'],
  }),
  def({
    id: 'melatonin',
    group: 'recovery',
    label: 'Melatonin',
    short: 'Melatonin',
    blurb: 'Falling asleep a little sooner',
    icon: 'moon',
    unit: 'mg',
    presets: [0.5, 1, 3],
    defaultDose: 1,
    minDose: 0.1,
    maxDose: 10,
    step: 0.5,
    typical: [0.5, 3],
    timing: 'evening',
    schedule: 'daily',
    evidence: 'moderate',
    source: 'melatonin',
    warnings: ['pregnancy', 'minors'],
  }),
  def({
    id: 'glycine',
    group: 'recovery',
    label: 'Glycine',
    short: 'Glycine',
    blurb: 'Sleep quality; early evidence',
    icon: 'moon-stars',
    unit: 'g',
    presets: [3, 5],
    defaultDose: 3,
    minDose: 1,
    maxDose: 10,
    step: 1,
    typical: [3, 3],
    timing: 'evening',
    schedule: 'daily',
    evidence: 'weak',
  }),
  def({
    id: 'ashwagandha',
    group: 'recovery',
    label: 'Ashwagandha',
    short: 'Ashwagandha',
    blurb: 'Stress and sleep; early or mixed results',
    icon: 'leaf',
    unit: 'mg',
    presets: [300, 600],
    defaultDose: 300,
    minDose: 100,
    maxDose: 1200,
    step: 100,
    typical: [300, 600],
    timing: 'evening',
    schedule: 'daily',
    evidence: 'weak',
    warnings: ['ashwagandha', 'pregnancy'],
  }),
  def({
    id: 'omega3',
    group: 'recovery',
    label: 'Omega-3',
    short: 'Omega-3',
    blurb: 'Fish oil; soreness and general health',
    icon: 'fish',
    unit: 'g',
    presets: [1, 2, 3],
    defaultDose: 1,
    minDose: 0.25,
    maxDose: 5,
    step: 0.25,
    typical: [1, 3],
    timing: 'withMeal',
    schedule: 'daily',
    evidence: 'weak',
    warnings: ['anticoagulants'],
  }),
  def({
    id: 'tartCherry',
    group: 'recovery',
    label: 'Tart cherry',
    short: 'Tart cherry',
    blurb: 'Soreness after hard sessions; early evidence',
    icon: 'orange',
    unit: 'ml',
    presets: [30, 60],
    defaultDose: 30,
    minDose: 10,
    maxDose: 120,
    step: 10,
    typical: [30, 60],
    timing: 'anytime',
    schedule: 'daily',
    evidence: 'weak',
  }),
  def({
    id: 'curcumin',
    group: 'recovery',
    label: 'Curcumin',
    short: 'Curcumin',
    blurb: 'Soreness and inflammation; early evidence',
    icon: 'leaf',
    unit: 'mg',
    presets: [500, 1000],
    defaultDose: 500,
    minDose: 100,
    maxDose: 3000,
    step: 100,
    typical: [500, 1000],
    timing: 'withMeal',
    schedule: 'daily',
    evidence: 'weak',
    warnings: ['anticoagulants'],
  }),
  // --- Health basics (9) ---
  def({
    id: 'vitaminD',
    group: 'health',
    label: 'Vitamin D',
    short: 'Vitamin D',
    blurb: 'Useful if you are low; ask for a blood test',
    icon: 'shield-check',
    unit: 'µg',
    presets: [10, 25, 50],
    defaultDose: 25,
    minDose: 5,
    maxDose: 100,
    step: 5,
    typical: [10, 50],
    timing: 'morning',
    schedule: 'daily',
    evidence: 'weak',
    source: 'vitaminD',
    warnings: ['deficiencyOnly'],
  }),
  def({
    id: 'multivitamin',
    group: 'health',
    label: 'Multivitamin',
    short: 'Multivitamin',
    blurb: 'A safety net for a limited diet',
    icon: 'pill',
    unit: 'serving',
    presets: [1],
    defaultDose: 1,
    minDose: 1,
    maxDose: 3,
    step: 1,
    typical: [1, 1],
    timing: 'morning',
    schedule: 'daily',
    evidence: 'weak',
  }),
  def({
    id: 'zinc',
    group: 'health',
    label: 'Zinc',
    short: 'Zinc',
    blurb: 'Only helps if your diet is short of it',
    icon: 'pill',
    unit: 'mg',
    presets: [8, 15, 25],
    defaultDose: 15,
    minDose: 2,
    maxDose: 40,
    step: 1,
    typical: [8, 25],
    timing: 'withMeal',
    schedule: 'daily',
    evidence: 'weak',
  }),
  def({
    id: 'iron',
    group: 'health',
    label: 'Iron',
    short: 'Iron',
    blurb: 'Only if a blood test shows you are low',
    icon: 'pill',
    unit: 'mg',
    presets: [14, 28],
    defaultDose: 14,
    minDose: 5,
    maxDose: 45,
    step: 1,
    typical: [14, 28],
    timing: 'morning',
    schedule: 'daily',
    evidence: 'weak',
    warnings: ['deficiencyOnly'],
  }),
  def({
    id: 'vitaminC',
    group: 'health',
    label: 'Vitamin C',
    short: 'Vitamin C',
    blurb: 'High doses can blunt training adaptation',
    icon: 'orange',
    unit: 'mg',
    presets: [250, 500, 1000],
    defaultDose: 500,
    minDose: 50,
    maxDose: 2000,
    step: 50,
    typical: [250, 500],
    timing: 'morning',
    schedule: 'daily',
    evidence: 'weak',
    source: 'antioxidants',
    warnings: ['antioxidantBlunt'],
  }),
  def({
    id: 'vitaminE',
    group: 'health',
    label: 'Vitamin E',
    short: 'Vitamin E',
    blurb: 'High doses can blunt training adaptation',
    icon: 'leaf',
    unit: 'mg',
    presets: [15, 100, 200],
    defaultDose: 15,
    minDose: 5,
    maxDose: 400,
    step: 5,
    typical: [15, 100],
    timing: 'withMeal',
    schedule: 'daily',
    evidence: 'weak',
    source: 'antioxidants',
    warnings: ['antioxidantBlunt', 'anticoagulants'],
  }),
  def({
    id: 'probiotics',
    group: 'health',
    label: 'Probiotics',
    short: 'Probiotics',
    blurb: 'Gut health; results depend on the strain',
    icon: 'pill',
    unit: 'serving',
    presets: [1],
    defaultDose: 1,
    minDose: 1,
    maxDose: 3,
    step: 1,
    typical: [1, 1],
    timing: 'morning',
    schedule: 'daily',
    evidence: 'weak',
  }),
  def({
    id: 'vitaminB12',
    group: 'health',
    label: 'Vitamin B12',
    short: 'Vitamin B12',
    blurb: 'Mainly for vegans and vegetarians',
    icon: 'pill',
    unit: 'µg',
    presets: [25, 100, 250],
    defaultDose: 25,
    minDose: 2,
    maxDose: 1000,
    step: 25,
    typical: [25, 250],
    timing: 'morning',
    schedule: 'daily',
    evidence: 'weak',
  }),
  def({
    id: 'calcium',
    group: 'health',
    label: 'Calcium',
    short: 'Calcium',
    blurb: 'Only if your diet is short of it',
    icon: 'pill',
    unit: 'mg',
    presets: [250, 500],
    defaultDose: 500,
    minDose: 100,
    maxDose: 1500,
    step: 50,
    typical: [250, 500],
    timing: 'withMeal',
    schedule: 'daily',
    evidence: 'weak',
    warnings: ['kidney'],
  }),
];

const ITEM_BY_ID = new Map<string, SupplementItem>(SUPPLEMENT_ITEMS.map((i) => [i.id, i]));
export const isSupplementId = (v: unknown): v is SupplementId =>
  typeof v === 'string' && ITEM_BY_ID.has(v);
export const supplementItem = (id: SupplementId): SupplementItem => ITEM_BY_ID.get(id)!;

// --- Groups ---------------------------------------------------------------------------------------

/** Row order of the "What I take" list (board A3). */
export const SUPPLEMENT_GROUPS: readonly SupplementGroup[] = [
  'performance',
  'protein',
  'recovery',
  'health',
];

/** English names, the fallback when the UI has no translation. */
export const GROUP_LABELS: Record<SupplementGroup, string> = {
  performance: 'Performance',
  protein: 'Protein and aminos',
  recovery: 'Recovery and sleep',
  health: 'Health basics',
};
/** Short chip names of the catalog browser. */
export const GROUP_SHORT_LABELS: Record<SupplementGroup, string> = {
  performance: 'Performance',
  protein: 'Protein',
  recovery: 'Recovery',
  health: 'Health',
};
export const GROUP_BLURBS: Record<SupplementGroup, string> = {
  performance: 'Creatine, caffeine, pre-workout, nitrates…',
  protein: 'Whey, casein, plant protein, EAA, collagen…',
  recovery: 'Magnesium, melatonin, omega-3, tart cherry…',
  health: 'Vitamin D, multivitamin, zinc, iron…',
};
/** Phosphor icon key of each group row. */
export const GROUP_ICONS: Record<SupplementGroup, string> = {
  performance: 'lightning',
  protein: 'barbell',
  recovery: 'moon-stars',
  health: 'shield-check',
};

export const itemsInGroup = (g: SupplementGroup): SupplementItem[] =>
  SUPPLEMENT_ITEMS.filter((i) => i.group === g);
export const groupOf = (id: SupplementId): SupplementGroup => supplementItem(id).group;
/** The entries (any state) whose item is in a group. */
export const entriesInGroup = (
  entries: readonly SupplementEntry[],
  g: SupplementGroup,
): SupplementEntry[] => entries.filter((e) => isSupplementId(e.itemId) && groupOf(e.itemId) === g);

export const SCHEDULES: readonly SupplementSchedule[] = ['daily', 'trainingDays'];
export const SCHEDULE_LABELS: Record<SupplementSchedule, string> = {
  daily: 'Daily',
  trainingDays: 'Training days',
};
export const TIMINGS: readonly SupplementTiming[] = [
  'anytime',
  'morning',
  'preWorkout',
  'withMeal',
  'postWorkout',
  'evening',
];
export const TIMING_LABELS: Record<SupplementTiming, string> = {
  anytime: 'Any time',
  morning: 'Morning',
  preWorkout: 'Pre-workout',
  withMeal: 'With a meal',
  postWorkout: 'Post-workout',
  evening: 'Evening',
};
export const EVIDENCE_LABELS: Record<SupplementEvidence, string> = {
  strong: 'Strong',
  moderate: 'Moderate',
  weak: 'Weak',
};
export const UNIT_LABELS: Record<SupplementUnit, string> = {
  g: 'g',
  mg: 'mg',
  µg: 'µg',
  ml: 'ml',
  scoop: 'scoop',
  serving: 'serving',
};

// --- Dose maths -----------------------------------------------------------------------------------

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const round = (n: number, d = 1): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};
const trimNum = (n: number): string => String(round(n, 2));

/** A dose clamped into the item's range and snapped to two decimals. */
export function clampDose(item: SupplementItem, dose: number): number {
  return round(clamp(finite(dose) ? dose : item.defaultDose, item.minDose, item.maxDose), 2);
}

/** "5 g", "1 scoop", "2 scoops", "70 ml", "1 serving". */
export function formatDose(dose: number, unit: SupplementUnit): string {
  const n = trimNum(dose);
  if ((unit === 'scoop' || unit === 'serving') && dose !== 1) return `${n} ${unit}s`;
  return `${n} ${UNIT_LABELS[unit]}`;
}

/** "3–5 g", "0.2–0.3 g per kg", or one value when the range is a point ("70 ml"). */
export function typicalText(item: SupplementItem): string {
  const [lo, hi] = item.typicalPerKg ?? item.typical;
  const per = item.typicalPerKg ? ' per kg' : '';
  if (lo === hi) return `${formatDose(lo, item.unit)}${per}`;
  return `${trimNum(lo)}–${trimNum(hi)} ${UNIT_LABELS[item.unit]}${per}`;
}

/** Grams of protein in one entry's serving; 0 for an item with no protein effect. */
export function proteinGramsOf(e: Pick<SupplementEntry, 'itemId' | 'dose'>): number {
  const item = ITEM_BY_ID.get(e.itemId);
  if (!item || item.effect !== 'protein' || !item.proteinGramsPerServing || !finite(e.dose))
    return 0;
  return round(
    (item.proteinGramsPerServing * clamp(e.dose, 0, item.maxDose)) / item.defaultDose,
    1,
  );
}

/** Milligrams of caffeine in one entry's serving; 0 for an item with none. */
export function caffeineMgOf(e: Pick<SupplementEntry, 'itemId' | 'dose'>): number {
  const item = ITEM_BY_ID.get(e.itemId);
  if (!item || item.effect !== 'caffeine' || !item.caffeineMgPerUnit || !finite(e.dose)) return 0;
  return Math.round(item.caffeineMgPerUnit * clamp(e.dose, 0, item.maxDose));
}

/** Is the entry one that counts at all: active, a known item, a positive dose. */
export const isCountedEntry = (e: SupplementEntry): boolean =>
  !!e && e.active && isSupplementId(e.itemId) && finite(e.dose) && e.dose > 0;

export const activeSupplementEntries = (entries: readonly SupplementEntry[]): SupplementEntry[] =>
  entries.filter(isCountedEntry);

/** Protein grams from the given entries (already filtered to the day), one decimal. */
export function proteinGramsOfEntries(entries: readonly SupplementEntry[]): number {
  let sum = 0;
  for (const e of entries) sum += proteinGramsOf(e);
  return round(sum, 1);
}
/** Caffeine mg from the given entries (already filtered to the day). */
export function caffeineMgOfEntries(entries: readonly SupplementEntry[]): number {
  let sum = 0;
  for (const e of entries) sum += caffeineMgOf(e);
  return Math.round(sum);
}

// --- Describing ----------------------------------------------------------------------------------

export interface SupplementEntryDescription {
  item: SupplementItem;
  /** "5 g" */
  doseText: string;
  /** "5 g · Any time" (the row subtitle). */
  rowText: string;
  scheduleLabel: string;
  timingLabel: string;
  evidenceLabel: string;
  /** Protein this serving counts (0 for non-protein items). */
  proteinGrams: number;
  /** Caffeine in this serving (0 for non-caffeine items). */
  caffeineMg: number;
}

/** Everything the row / sheet of one entry shows. Null for an unknown item. */
export function describeEntry(e: SupplementEntry): SupplementEntryDescription | null {
  const item = ITEM_BY_ID.get(e.itemId);
  if (!item) return null;
  const doseText = formatDose(e.dose, item.unit);
  const timingLabel = TIMING_LABELS[e.timing] ?? TIMING_LABELS.anytime;
  return {
    item,
    doseText,
    rowText: `${doseText} · ${timingLabel}`,
    scheduleLabel: SCHEDULE_LABELS[e.schedule] ?? SCHEDULE_LABELS.daily,
    timingLabel,
    evidenceLabel: EVIDENCE_LABELS[item.evidence],
    proteinGrams: proteinGramsOf(e),
    caffeineMg: caffeineMgOf(e),
  };
}

/** "3 daily · 1 on training days": how many counted entries follow each schedule. */
export function scheduleCounts(entries: readonly SupplementEntry[]): {
  daily: number;
  trainingDays: number;
} {
  const list = activeSupplementEntries(entries);
  return {
    daily: list.filter((e) => e.schedule === 'daily').length,
    trainingDays: list.filter((e) => e.schedule === 'trainingDays').length,
  };
}

// --- Summary text -----------------------------------------------------------------------------------

/** How many names a summary lists before "+ N more". */
export const SUMMARY_NAMES = 2;

/**
 * "Creatine + Whey · 2 items" (more than two: "Creatine + Whey + 2 more · 4 items").
 * `labelOf` supplies the localized short name for an item id, `tail` the localized
 * "2 items" part and `more` the localized "2 more" (the UI passes its translations; the
 * defaults are English). Null when nothing is counted. Order is the order the entries were
 * saved.
 */
export function supplementSummaryText(
  entries: readonly SupplementEntry[],
  labelOf: (id: SupplementId) => string = (id) => supplementItem(id).short,
  tail: (n: number) => string = (n) => `${n} ${n === 1 ? 'item' : 'items'}`,
  more: (n: number) => string = (n) => `${n} more`,
): string | null {
  const list = activeSupplementEntries(entries);
  if (!list.length) return null;
  const names: string[] = [];
  for (const e of list) {
    const n = labelOf(e.itemId);
    if (!names.includes(n)) names.push(n);
  }
  const shown = names.slice(0, SUMMARY_NAMES);
  const rest = names.length - shown.length;
  const head = rest > 0 ? `${shown.join(' + ')} + ${more(rest)}` : shown.join(' + ');
  return `${head} · ${tail(list.length)}`;
}

// --- Validation (used by the tests and a dev check) --------------------------------------------------

/** A list of problems with the catalog; empty when it is sound. */
export function validateSupplementCatalog(
  items: readonly SupplementItem[] = SUPPLEMENT_ITEMS,
): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const i of items) {
    const p = (m: string) => problems.push(`${i.id}: ${m}`);
    if (seen.has(i.id)) p('duplicate id');
    seen.add(i.id);
    if (!SUPPLEMENT_GROUPS.includes(i.group)) p('unknown group');
    if (!i.label || !i.short || !i.blurb || !i.icon) p('missing text or icon');
    if (!(i.minDose > 0 && i.minDose < i.maxDose)) p('bad dose range');
    if (!(i.step > 0)) p('bad step');
    if (!i.presets.length) p('no presets');
    for (let k = 0; k < i.presets.length; k++) {
      const v = i.presets[k];
      if (!(v >= i.minDose && v <= i.maxDose)) p(`preset ${v} outside min..max`);
      if (k > 0 && !(v > i.presets[k - 1])) p('presets not sorted and distinct');
    }
    if (!i.presets.includes(i.defaultDose)) p('default dose is not a preset');
    if (!(i.typical[0] > 0 && i.typical[0] <= i.typical[1])) p('bad typical range');
    if (i.typicalPerKg && !(i.typicalPerKg[0] > 0 && i.typicalPerKg[0] <= i.typicalPerKg[1]))
      p('bad per-kg range');
    if (i.effect === 'protein' && !((i.proteinGramsPerServing ?? 0) > 0))
      p('protein item without grams');
    if (i.effect !== 'protein' && i.proteinGramsPerServing !== undefined) p('stray protein grams');
    if (i.effect === 'caffeine' && !((i.caffeineMgPerUnit ?? 0) > 0)) p('caffeine item without mg');
    if (i.effect !== 'caffeine' && i.caffeineMgPerUnit !== undefined) p('stray caffeine mg');
    if (i.effect === 'protein' && i.unit === 'g' && (i.proteinGramsPerServing ?? 0) > i.defaultDose)
      p('more protein than powder');
    if (i.source !== null && !(i.source in SUPPLEMENT_SOURCES)) p('unknown source');
    if (i.effect !== 'none' && i.source === null) p('modelled effect without a source');
    for (const w of i.warnings) if (!SUPPLEMENT_WARNING_KEYS.includes(w)) p(`unknown warning ${w}`);
    if (!TIMINGS.includes(i.timing)) p('unknown timing');
    if (!SCHEDULES.includes(i.schedule)) p('unknown schedule');
  }
  return problems;
}
