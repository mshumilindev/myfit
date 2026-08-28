/**
 * Fix-it (design FIX-1..W): turn a volume gap into a concrete fix. Given a
 * lagging muscle it proposes real catalog exercises that hit that muscle,
 * ranked so the ones your gym can actually equip come first -- the taxonomy x
 * gym-inventory join. Each carries a ready set/rep scheme so one tap adds real,
 * trainable work rather than just naming the problem.
 */
import { exerciseNeeds, missingAtGym } from './store';
import { searchCatalog, muscleInfoByName, richExerciseByName } from './data/exercises';
import type { MuscleGroup } from './data/exercises';
import type { Gym, Workout } from './types';

export interface FixScheme {
  sets: number;
  reps: number;
  label: string;
}

// Smaller / higher-rep muscles get a lighter, higher-rep prescription.
const HIGHER_REP: MuscleGroup[] = ['calves', 'core', 'forearms', 'abductors', 'adductors', 'traps'];

export function fixScheme(muscle: MuscleGroup): FixScheme {
  return HIGHER_REP.includes(muscle)
    ? { sets: 3, reps: 13, label: '3 × 12–15' }
    : { sets: 3, reps: 10, label: '3 × 8–12' };
}

export interface FixCandidate {
  name: string;
  primary: MuscleGroup | null;
  secondary: MuscleGroup[];
  equipment: string[];
  missing: string[];
  available: boolean;
  bodyweight: boolean;
  isPrimaryHit: boolean;
  strength: boolean;
  scheme: FixScheme;
}

/** The gym to judge availability against: most recently trained, else the first. */
export function activeGym(gyms: Gym[], finished: Workout[]): Gym | null {
  for (const w of [...finished].sort((a, b) => b.startedAt - a.startedAt)) {
    if (!w.gymId) continue;
    const g = gyms.find((x) => x.id === w.gymId);
    if (g) return g;
  }
  return gyms[0] ?? null;
}

function isBodyweight(equipment: string[]): boolean {
  return equipment.length === 0 || equipment.every((e) => e === 'body');
}

/**
 * Up to `count` exercises that hit `muscle`, ranked: exercises that target it
 * directly (primary) first, then those the gym can equip, then the simplest
 * kit. Deduped by name.
 */
export function fixCandidates(muscle: MuscleGroup, gym: Gym | null, count = 3): FixCandidate[] {
  const pool = searchCatalog('', 40, undefined, muscle);
  const seen = new Set<string>();
  const cands: FixCandidate[] = [];
  for (const ex of pool) {
    const name = ex.names[0];
    const key = name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    // Skip stretches / mobility drills -- they don't build the missing volume.
    const category = richExerciseByName(name)?.category ?? null;
    if (category === 'stretching') continue;
    const info = muscleInfoByName(name);
    const primary = (info?.primary ?? ex.muscle) as MuscleGroup;
    const secondary = info?.secondary ?? [];
    const equipment = exerciseNeeds(name);
    const missing = gym ? missingAtGym(gym, equipment) : [];
    cands.push({
      name,
      primary: primary === 'cardio' ? null : primary,
      secondary,
      equipment,
      missing,
      available: missing.length === 0,
      bodyweight: isBodyweight(equipment),
      isPrimaryHit: primary === muscle,
      strength: category === 'strength' || category === 'powerlifting' || category === null,
      scheme: fixScheme(muscle),
    });
  }
  // Rank: hits the muscle directly, is a strength move, gym can equip it, then
  // the simplest kit -- so squats/leg-press beat plyo drills for quads.
  cands.sort(
    (a, b) =>
      Number(b.isPrimaryHit) - Number(a.isPrimaryHit) ||
      Number(b.strength) - Number(a.strength) ||
      Number(b.available) - Number(a.available) ||
      a.equipment.length - b.equipment.length,
  );
  return cands.slice(0, count);
}
