/* Which side(s) a logged weight covers (pure). Leaf module: store.ts wraps it with the per-exercise pin. */
import PER_SIDE from './data/per-side.json';
import { canonicalExerciseName } from './data/exercises';
import type { Exercise } from './types';

/**
 * Per-side entry doubling: ×2 means the logged weight is one side's load.
 *  - `per-side.json` decides first — the only place a move is classified by hand.
 *  - Dumbbells / kettlebell pairs: ×2, unless one implement is shared by both hands.
 *  - Cables: one stack ×1 (a cable crunch is not doubled); two-stack moves ×2.
 * Names are matched on the English catalog name, so the factor does not depend
 * on the interface language the set was logged in.
 */
export const ONE_ARM_NAME = /\b(one|single)[- ](arm|hand|leg)\b|unilateral|одн(ією|у|ой)\s*рук/i;
const SINGLE_IMPLEMENT = /goblet|pull[- ]?over|two[- ]?hand|both hands|svend|\bskull\s*crusher\b/i;
const BILATERAL_CABLE = /\bfly(e|es|s)?\b|cross[- ]?over|\biron cross\b|\bpec\b/i;
const PAIRED_KETTLEBELL = /\bdouble\b|two[- ]arm|two kettlebells|alternating|seesaw/i;
const TWO_SIDED = new Set(PER_SIDE.twoSided);
const ONE_SIDED = new Set(PER_SIDE.oneSided);

/**
 * How a lift's logged weight relates to both sides of the body:
 *  - 'pair'       two implements / two stacks at once — the weight is per hand
 *                 (dumbbell press, cable crossover, iso-lateral machine).
 *  - 'unilateral' one side at a time — you log one side's set, the other side
 *                 does the same (one-arm row, single-leg press, lunge).
 *  - 'single'     one load moved by both sides together (barbell, stack).
 * 'pair' and 'unilateral' both count ×2 toward volume.
 */
export type SidesMode = 'pair' | 'unilateral' | 'single';

const UNILATERAL_NAME =
  /\b(one|single)[- ]?(arm|hand|leg|side)d?\b|\bunilateral\b|\bsplit squat\b|\blunge|\bstep[- ]?ups?\b|\bpistol\b|bulgarian|concentration|одн(ією|у|ой)\s*(рук|ног)/i;
const ISO_LATERAL = /iso[- ]?lateral|independent arms?/i;

export function resolveSidesMode(
  ex: Pick<Exercise, 'name' | 'equipment'>,
  pinned: 'one' | 'both' | null,
  equipmentOf: () => string[],
): SidesMode {
  // An explicit per-exercise Sides choice is the single source of truth.
  if (pinned === 'both') return 'single';
  const name = ex.name;
  const canon = canonicalExerciseName(name).toLowerCase();
  const eq = equipmentOf();
  const unilateral = UNILATERAL_NAME.test(name) || UNILATERAL_NAME.test(canon);
  if (pinned === 'one') return unilateral || !eq.includes('dumbbell') ? 'unilateral' : 'pair';
  // Hand-classified moves first (per-side.json).
  if (TWO_SIDED.has(canon) || TWO_SIDED.has(name.trim().toLowerCase())) return 'pair';
  if (ONE_SIDED.has(canon) || ONE_SIDED.has(name.trim().toLowerCase())) return 'single';
  // One side at a time: you log one side, the other side matches it.
  if (unilateral || ONE_ARM_NAME.test(name) || ONE_ARM_NAME.test(canon)) return 'unilateral';
  if (ISO_LATERAL.test(canon) || ISO_LATERAL.test(name)) return 'pair';
  if (eq.includes('dumbbell')) return SINGLE_IMPLEMENT.test(canon) ? 'single' : 'pair';
  if (eq.includes('kettlebell')) return PAIRED_KETTLEBELL.test(canon) ? 'pair' : 'single';
  if (eq.includes('cable')) return BILATERAL_CABLE.test(canon) ? 'pair' : 'single';
  return 'single';
}
