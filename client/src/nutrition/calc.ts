import type {
  Activity,
  BodyMetrics,
  CookingMethod,
  Food,
  GoalType,
  LoggedItem,
  Macros,
  NutritionProfile,
  SpotterBody,
} from './types';

export const ZERO: Macros = { kcal: 0, protein: 0, fat: 0, carbs: 0 };

export function round(n: number, d = 0): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

export function sumMacros(items: { macros: Macros }[]): Macros {
  return items.reduce<Macros>(
    (a, it) => ({
      kcal: a.kcal + it.macros.kcal,
      protein: a.protein + it.macros.protein,
      fat: a.fat + it.macros.fat,
      carbs: a.carbs + it.macros.carbs,
    }),
    { ...ZERO },
  );
}

export function roundMacros(m: Macros): Macros {
  return {
    kcal: round(m.kcal),
    protein: round(m.protein, 1),
    fat: round(m.fat, 1),
    carbs: round(m.carbs, 1),
  };
}

/** Cooking method as a simple energy modifier — not lab-accurate, honest estimate. */
const METHOD_FACTOR: Record<CookingMethod, number> = {
  raw: 1,
  boiled: 1,
  baked: 1.05,
  grilled: 1.05,
  fried: 1.25,
};

/** Scale a food's per-basis macros to an amount (+ optional cooking method). */
export function scaleFood(food: Food, amount: number, method?: CookingMethod): Macros {
  const unit = food.basis === 'portion' ? 1 : 100; // per 100 g/ml, or per portion
  const k = amount / unit;
  const f = method ? METHOD_FACTOR[method] : 1;
  return roundMacros({
    kcal: food.per.kcal * k * f,
    protein: food.per.protein * k,
    fat: food.per.fat * k * (method === 'fried' ? 1.2 : 1),
    carbs: food.per.carbs * k,
  });
}

export function makeItem(food: Food, amount: number, method?: CookingMethod): LoggedItem {
  return {
    foodId: food.id,
    name: food.name,
    emoji: food.emoji,
    amount,
    basis: food.basis,
    method,
    macros: scaleFood(food, amount, method),
  };
}

const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

/** Mifflin–St Jeor BMR. */
export function bmr(b: BodyMetrics): number {
  const base = 10 * b.weightKg + 6.25 * b.heightCm - 5 * b.age;
  return b.sex === 'male' ? base + 5 : base - 161;
}

export function tdee(b: BodyMetrics): number {
  return round(bmr(b) * ACTIVITY_FACTOR[b.activity]);
}

/** kcal delta and protein g/kg per goal — deliberately moderate (well-being). */
const GOAL_SPEC: Record<GoalType, { kcalDelta: number; proteinPerKg: number; fatPct: number }> = {
  bulk: { kcalDelta: 0.12, proteinPerKg: 1.8, fatPct: 0.25 },
  recomp: { kcalDelta: 0, proteinPerKg: 2.0, fatPct: 0.28 },
  maintain: { kcalDelta: 0, proteinPerKg: 1.6, fatPct: 0.3 },
  cut: { kcalDelta: -0.18, proteinPerKg: 2.0, fatPct: 0.28 },
};

/** Full KBJU target from body + goal. Returns a factual estimate, not a prescription. */
export function targetMacros(b: BodyMetrics, goalType: GoalType): Macros {
  const spec = GOAL_SPEC[goalType];
  const kcal = round(tdee(b) * (1 + spec.kcalDelta));
  const protein = round(spec.proteinPerKg * b.weightKg);
  const fat = round((kcal * spec.fatPct) / 9);
  const carbs = round((kcal - protein * 4 - fat * 9) / 4);
  return { kcal, protein, fat: Math.max(fat, 0), carbs: Math.max(carbs, 0) };
}

export function localDay(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, round((part / whole) * 100));
}

/** Latest weigh-in from the shared Spotter body doc. */
export function latestWeight(body: SpotterBody | null): number | null {
  if (!body?.weights?.length) return null;
  return body.weights.reduce((a, b) => (b.at >= a.at ? b : a)).weight;
}

/** Age in whole years from an ISO YYYY-MM-DD date of birth. */
export function ageFromDob(dob?: string | null): number | null {
  if (!dob) return null;
  const b = new Date(dob + 'T00:00:00');
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age > 0 && age < 130 ? age : null;
}

/** Compose the five TDEE inputs from Spotter's body doc + nutrition profile.
 *  Height/weight prefer the shared Spotter data; sex/age/activity are
 *  nutrition-owned. Returns null until all five are known. */
export function composeBody(
  spotter: SpotterBody | null,
  profile: NutritionProfile | null,
): BodyMetrics | null {
  const heightCm = spotter?.heightCm ?? profile?.heightCm;
  const weightKg = latestWeight(spotter) ?? profile?.weightKg;
  // Sex and age come from the shared suite Profile (People app); nutrition only
  // falls back to its own profile if the suite doc has not been filled in.
  const sex = spotter?.sex ?? profile?.sex;
  const age = ageFromDob(spotter?.dob) ?? profile?.age;
  // Activity level is the one input the suite does not track — nutrition owns it.
  const activity = profile?.activity;
  if (!heightCm || !weightKg || !sex || !age || !activity) return null;
  return { heightCm, weightKg, sex, age, activity };
}
