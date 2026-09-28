/**
 * Topic boundaries between near-duplicates. Some topics are a sharper case of
 * a broader one (a hip-flexor question is a mobility question; "does creatine
 * make you bald" is a supplements question), and a few pairs say the same
 * thing (your best lift / your heaviest lift). The examples of such a pair
 * always score close together, so "the examples lead by a hair" says nothing
 * about which of the two was meant.
 *
 * The rule is one-way on purpose: a SPECIFIC topic picked over its broader
 * parent is not a near miss (the specific one names the question), while the
 * broad topic picked over a specific one still is ("knees caving in" answered
 * with general squat depth instead of the knees-cave fix).
 */

/** child → its broader topics. */
const PARENTS: Record<string, readonly string[]> = {};
function family(parent: string, ...children: string[]): void {
  for (const k of children) PARENTS[k] = [...(PARENTS[k] ?? []), parent];
}

family('technique', 'technique_lift');
family('mobility', 'k_thoracic', 'k_hip_flexors', 'k_hamstring_flex', 'k_ankle_mobility');
family('foam_roll', 'k_massage_gun');
family(
  'supplements',
  'k_creatine_myths',
  'k_teen_supplements',
  'k_beta_alanine',
  'k_fish_oil',
  'k_preworkout',
  'k_bcaa',
  'k_vitamin_d',
  'k_magnesium',
  'k_test_boosters',
  'k_fat_burners',
  'k_joint_supplements',
  'k_protein_powder',
);
family('age', 'k_older_lifter', 'k_teen_lifting');
family('squat_form', 'k_knees_cave', 'k_butt_wink', 'k_knees_over_toes', 'k_ankle_mobility');
family('warmup', 'warmup_lift', 'warmup_sets');
family('swap', 'alternatives');
family('pregnancy', 'k_postpartum');
family('grow_muscle', 'k_calves', 'arms');
family('fat_loss', 'cut_deficit');
family('calories', 'cut_deficit', 'bulk_surplus');
family('water', 'k_intra_workout');
family('protein', 'k_protein_per_meal', 'protein_timing', 'k_protein_powder');
// "Why this workout today?" is the why of today's workout — asked with "why".
family('today', 'why_today');
family('plan', 'why_plan');

/** Pairs that answer the same question — either may stand for the other. */
const SAME: readonly (readonly string[])[] = [
  ['best', 'heaviest'],
  ['k_imbalance', 'unilateral'],
  ['you_dumb', 'insult'],
  ['temper', 'act_temper'],
  ['month', 'range_count'],
];

/**
 * Is `other` no real rival to `picked`: its broader parent, or the same
 * question under another name?
 */
export function kin(picked: string | undefined, other: string): boolean {
  return !!picked && (!!PARENTS[picked]?.includes(other) || twins(picked, other));
}

/** The same question under two names. */
export function twins(a: string, b: string): boolean {
  return SAME.some((s) => s.includes(a) && s.includes(b));
}
