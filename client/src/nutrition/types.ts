export interface Macros {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

export type EntryType = 'drink' | 'snack' | 'meal';
export type Basis = '100g' | '100ml' | 'portion';
export type FoodKind = 'product' | 'dish' | 'drink';

export interface Food {
  id: string;
  name: string;
  emoji?: string;
  /** Product photo (Open Food Facts thumbnail), when available. */
  photo?: string;
  basis: Basis;
  per: Macros;
  kind: FoodKind;
  barcode?: string;
  approx?: boolean;
  custom?: boolean;
}

export type CookingMethod = 'raw' | 'boiled' | 'fried' | 'baked' | 'grilled';

export interface LoggedItem {
  foodId: string;
  name: string;
  emoji?: string;
  amount: number;
  basis: Basis;
  method?: CookingMethod;
  macros: Macros;
}

export interface Entry {
  id: string;
  type: EntryType;
  name: string;
  emoji?: string;
  items: LoggedItem[];
  macros: Macros;
  alcoholG?: number;
  approx?: boolean;
  loggedAt: string;
  day: string; // YYYY-MM-DD (local)
}

export type GoalType = 'bulk' | 'recomp' | 'maintain' | 'cut';
export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';

/** The five inputs TDEE needs (composed from Spotter body + nutrition profile). */
export interface BodyMetrics {
  heightCm: number;
  weightKg: number;
  sex: Sex;
  age: number;
  activity: Activity;
}

export interface Goal {
  goalType: GoalType;
  tdee: number;
  target: Macros;
}

export type Role = 'member' | 'trainer' | 'admin';

/** Weigh-in entry as stored by My Fit at users/{uid}/meta/body. */
export interface WeightEntry {
  id: string;
  at: number;
  weight: number;
}

/** Read-only view of the shared Spotter body doc (My Fit owns writes). */
export interface SpotterBody {
  /** Biological sex — set in the suite Profile (People app). */
  sex?: Sex | null;
  /** Date of birth (ISO YYYY-MM-DD) — set in the suite Profile. */
  dob?: string | null;
  heightCm?: number | null;
  weights?: WeightEntry[];
}

/** Nutrition-owned profile: the metrics Spotter does not store (sex/age/
 *  activity) plus height/weight fallbacks when Spotter's body doc is empty. */
export interface NutritionProfile {
  sex?: Sex;
  age?: number;
  activity?: Activity;
  heightCm?: number;
  weightKg?: number;
}

export type Lang = 'en' | 'uk' | 'pl' | 'lt' | 'et';

export interface AppState {
  authReady: boolean;
  uid: string | null;
  username: string | null;
  role: Role;
  loading: boolean;
  failed: boolean;
  entries: Entry[];
  customFoods: Food[];
  goal: Goal | null;
  profile: NutritionProfile | null;
  spotterBody: SpotterBody | null;
  lang: Lang;
  online: boolean;
}
