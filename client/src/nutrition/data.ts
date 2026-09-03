import type { CookingMethod, Food } from './types';
import { tokenMatch } from '../search';

/** Seed product database (per 100 g unless basis 100ml). Stand-in for Open Food Facts. */
export const PRODUCTS: Food[] = [
  {
    id: 'p-chicken',
    name: 'Chicken breast',
    emoji: '🍗',
    basis: '100g',
    kind: 'product',
    per: { kcal: 165, protein: 31, fat: 3.6, carbs: 0 },
  },
  {
    id: 'p-egg',
    name: 'Egg',
    emoji: '🥚',
    basis: '100g',
    kind: 'product',
    per: { kcal: 143, protein: 13, fat: 9.5, carbs: 1.1 },
    barcode: '4820000000017',
  },
  {
    id: 'p-rice',
    name: 'Rice, cooked',
    emoji: '🍚',
    basis: '100g',
    kind: 'product',
    per: { kcal: 130, protein: 2.7, fat: 0.3, carbs: 28 },
  },
  {
    id: 'p-oats',
    name: 'Oats',
    emoji: '🌾',
    basis: '100g',
    kind: 'product',
    per: { kcal: 389, protein: 17, fat: 7, carbs: 66 },
  },
  {
    id: 'p-banana',
    name: 'Banana',
    emoji: '🍌',
    basis: '100g',
    kind: 'product',
    per: { kcal: 89, protein: 1.1, fat: 0.3, carbs: 23 },
  },
  {
    id: 'p-apple',
    name: 'Apple',
    emoji: '🍎',
    basis: '100g',
    kind: 'product',
    per: { kcal: 52, protein: 0.3, fat: 0.2, carbs: 14 },
  },
  {
    id: 'p-yogurt',
    name: 'Greek yogurt',
    emoji: '🥛',
    basis: '100g',
    kind: 'product',
    per: { kcal: 59, protein: 10, fat: 0.4, carbs: 3.6 },
  },
  {
    id: 'p-salmon',
    name: 'Salmon',
    emoji: '🐟',
    basis: '100g',
    kind: 'product',
    per: { kcal: 208, protein: 20, fat: 13, carbs: 0 },
  },
  {
    id: 'p-beef',
    name: 'Beef, lean',
    emoji: '🥩',
    basis: '100g',
    kind: 'product',
    per: { kcal: 217, protein: 26, fat: 12, carbs: 0 },
  },
  {
    id: 'p-potato',
    name: 'Potato',
    emoji: '🥔',
    basis: '100g',
    kind: 'product',
    per: { kcal: 77, protein: 2, fat: 0.1, carbs: 17 },
  },
  {
    id: 'p-bread',
    name: 'Bread',
    emoji: '🍞',
    basis: '100g',
    kind: 'product',
    per: { kcal: 265, protein: 9, fat: 3.2, carbs: 49 },
    barcode: '4820000000024',
  },
  {
    id: 'p-pasta',
    name: 'Pasta, cooked',
    emoji: '🍝',
    basis: '100g',
    kind: 'product',
    per: { kcal: 158, protein: 6, fat: 0.9, carbs: 31 },
  },
  {
    id: 'p-cheese',
    name: 'Cheese',
    emoji: '🧀',
    basis: '100g',
    kind: 'product',
    per: { kcal: 402, protein: 25, fat: 33, carbs: 1.3 },
  },
  {
    id: 'p-almonds',
    name: 'Almonds',
    emoji: '🌰',
    basis: '100g',
    kind: 'product',
    per: { kcal: 579, protein: 21, fat: 50, carbs: 22 },
  },
  {
    id: 'p-oliveoil',
    name: 'Olive oil',
    emoji: '🫒',
    basis: '100ml',
    kind: 'product',
    per: { kcal: 884, protein: 0, fat: 100, carbs: 0 },
  },
  {
    id: 'p-avocado',
    name: 'Avocado',
    emoji: '🥑',
    basis: '100g',
    kind: 'product',
    per: { kcal: 160, protein: 2, fat: 15, carbs: 9 },
  },
  {
    id: 'p-broccoli',
    name: 'Broccoli',
    emoji: '🥦',
    basis: '100g',
    kind: 'product',
    per: { kcal: 34, protein: 2.8, fat: 0.4, carbs: 7 },
  },
  {
    id: 'p-tuna',
    name: 'Tuna',
    emoji: '🐟',
    basis: '100g',
    kind: 'product',
    per: { kcal: 132, protein: 28, fat: 1, carbs: 0 },
  },
  {
    id: 'p-cottage',
    name: 'Cottage cheese',
    emoji: '🧀',
    basis: '100g',
    kind: 'product',
    per: { kcal: 98, protein: 11, fat: 4.3, carbs: 3.4 },
  },
  {
    id: 'p-whey',
    name: 'Whey scoop',
    emoji: '💪',
    basis: 'portion',
    kind: 'product',
    per: { kcal: 120, protein: 24, fat: 1.5, carbs: 3 },
  },
  {
    id: 'p-peanut',
    name: 'Peanut butter',
    emoji: '🥜',
    basis: '100g',
    kind: 'product',
    per: { kcal: 588, protein: 25, fat: 50, carbs: 20 },
  },
  {
    id: 'p-sweetpotato',
    name: 'Sweet potato',
    emoji: '🍠',
    basis: '100g',
    kind: 'product',
    per: { kcal: 86, protein: 1.6, fat: 0.1, carbs: 20 },
  },
  {
    id: 'p-tofu',
    name: 'Tofu',
    emoji: '⬜',
    basis: '100g',
    kind: 'product',
    per: { kcal: 76, protein: 8, fat: 4.8, carbs: 1.9 },
  },
  {
    id: 'p-lentils',
    name: 'Lentils, cooked',
    emoji: '🫘',
    basis: '100g',
    kind: 'product',
    per: { kcal: 116, protein: 9, fat: 0.4, carbs: 20 },
  },
];

/** Named dishes — approximate per-portion values (eat-out fallback). */
export const DISHES: Food[] = [
  {
    id: 'd-borscht',
    name: 'Borscht (bowl)',
    emoji: '🍲',
    basis: 'portion',
    kind: 'dish',
    approx: true,
    per: { kcal: 320, protein: 12, fat: 14, carbs: 34 },
  },
  {
    id: 'd-pizza',
    name: 'Pizza slice',
    emoji: '🍕',
    basis: 'portion',
    kind: 'dish',
    approx: true,
    per: { kcal: 285, protein: 12, fat: 10, carbs: 36 },
  },
  {
    id: 'd-caesar',
    name: 'Caesar salad',
    emoji: '🥗',
    basis: 'portion',
    kind: 'dish',
    approx: true,
    per: { kcal: 470, protein: 26, fat: 34, carbs: 12 },
  },
  {
    id: 'd-burger',
    name: 'Cheeseburger',
    emoji: '🍔',
    basis: 'portion',
    kind: 'dish',
    approx: true,
    per: { kcal: 540, protein: 25, fat: 29, carbs: 43 },
  },
  {
    id: 'd-sushi',
    name: 'Sushi roll (8 pc)',
    emoji: '🍣',
    basis: 'portion',
    kind: 'dish',
    approx: true,
    per: { kcal: 350, protein: 12, fat: 8, carbs: 56 },
  },
  {
    id: 'd-shawarma',
    name: 'Shawarma',
    emoji: '🌯',
    basis: 'portion',
    kind: 'dish',
    approx: true,
    per: { kcal: 620, protein: 30, fat: 32, carbs: 52 },
  },
  {
    id: 'd-bolognese',
    name: 'Pasta bolognese',
    emoji: '🍝',
    basis: 'portion',
    kind: 'dish',
    approx: true,
    per: { kcal: 560, protein: 24, fat: 18, carbs: 72 },
  },
  {
    id: 'd-pancakes',
    name: 'Pancakes (3)',
    emoji: '🥞',
    basis: 'portion',
    kind: 'dish',
    approx: true,
    per: { kcal: 430, protein: 11, fat: 16, carbs: 60 },
  },
];

export interface DrinkDef extends Food {
  abv?: number; // alcohol by volume fraction, e.g. 0.05
}

/** Drinks — per 100 ml. Water = 0. Alcohol carries abv for gram/kcal estimate. */
export const DRINKS: DrinkDef[] = [
  {
    id: 'dr-water',
    name: 'Water',
    emoji: '💧',
    basis: '100ml',
    kind: 'drink',
    per: { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  },
  {
    id: 'dr-coffee',
    name: 'Coffee, black',
    emoji: '☕',
    basis: '100ml',
    kind: 'drink',
    per: { kcal: 2, protein: 0.1, fat: 0, carbs: 0 },
  },
  {
    id: 'dr-latte',
    name: 'Latte',
    emoji: '☕',
    basis: '100ml',
    kind: 'drink',
    per: { kcal: 55, protein: 3, fat: 3, carbs: 4.5 },
  },
  {
    id: 'dr-tea',
    name: 'Tea',
    emoji: '🍵',
    basis: '100ml',
    kind: 'drink',
    per: { kcal: 1, protein: 0, fat: 0, carbs: 0.2 },
  },
  {
    id: 'dr-juice',
    name: 'Orange juice',
    emoji: '🧃',
    basis: '100ml',
    kind: 'drink',
    per: { kcal: 45, protein: 0.7, fat: 0.2, carbs: 10 },
  },
  {
    id: 'dr-cola',
    name: 'Cola',
    emoji: '🥤',
    basis: '100ml',
    kind: 'drink',
    per: { kcal: 42, protein: 0, fat: 0, carbs: 10.6 },
  },
  {
    id: 'dr-milk',
    name: 'Milk',
    emoji: '🥛',
    basis: '100ml',
    kind: 'drink',
    per: { kcal: 61, protein: 3.2, fat: 3.3, carbs: 4.8 },
  },
  {
    id: 'dr-beer',
    name: 'Beer',
    emoji: '🍺',
    basis: '100ml',
    kind: 'drink',
    abv: 0.05,
    per: { kcal: 43, protein: 0.5, fat: 0, carbs: 3.6 },
  },
  {
    id: 'dr-wine',
    name: 'Wine',
    emoji: '🍷',
    basis: '100ml',
    kind: 'drink',
    abv: 0.12,
    per: { kcal: 83, protein: 0.1, fat: 0, carbs: 2.6 },
  },
];

export interface VolumeUnit {
  id: string;
  labelKey: 'ml' | 'glass' | 'bottle' | 'cup' | 'shot';
  ml: number;
}
export const VOLUME_UNITS: VolumeUnit[] = [
  { id: 'ml', labelKey: 'ml', ml: 1 },
  { id: 'glass', labelKey: 'glass', ml: 250 },
  { id: 'cup', labelKey: 'cup', ml: 200 },
  { id: 'bottle', labelKey: 'bottle', ml: 500 },
  { id: 'shot', labelKey: 'shot', ml: 40 },
];

export const COOKING_METHODS: CookingMethod[] = ['raw', 'boiled', 'fried', 'baked', 'grilled'];

const ALCOHOL_DENSITY = 0.789; // g/ml

export function alcoholGrams(drink: DrinkDef, ml: number): number {
  if (!drink.abv) return 0;
  return Math.round(ml * drink.abv * ALCOHOL_DENSITY * 10) / 10;
}

export function searchFoods(q: string, custom: Food[], scope: 'product' | 'dish'): Food[] {
  const pool =
    scope === 'dish' ? DISHES : [...custom.filter((f) => f.kind === 'product'), ...PRODUCTS];
  const s = q.trim().toLowerCase();
  if (!s) return pool.slice(0, 12);
  return pool.filter((f) => tokenMatch(f.name, s)).slice(0, 20);
}

export function findByBarcode(code: string, custom: Food[]): Food | null {
  return [...custom, ...PRODUCTS].find((f) => f.barcode === code) ?? null;
}
