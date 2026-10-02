/**
 * warmupFor — the auto session's warm-up proposal (pure, deterministic).
 *
 * An auto-built session may open with a few warm-up exercises. They must all sit
 * at ONE station so the athlete never runs around the gym: every proposed
 * exercise uses the same light equipment class —
 *
 *   resistance bands  >  light dumbbells  >  bodyweight
 *
 * — the first class the gym's known kit allows (bodyweight needs no kit) that can
 * give at least MIN_ITEMS exercises for the day's muscles. Nothing heavy is ever
 * proposed (no barbell, machine, cable or kettlebell; dumbbells only for beginner
 * isolation moves). Every exercise comes from the app's own exercise catalog.
 *
 * Conditions and injuries are honoured like everywhere else: an 'avoid' or
 * 'caution' flag, a zero load cap or a muscle still in Protect drops a move. When
 * the day's muscles are unknown or no station can give MIN_ITEMS, the result is
 * null and the warm-up stays a plain, generic block (no exercises).
 */
import { exerciseFlag, NO_LIMITS, type Limits } from './conditions';
import {
  BUILT_IN_CATALOG,
  richExerciseById,
  type MuscleGroup,
  type RichExercise,
} from './data/exercises';
import { equipmentById } from './data/equipmentCatalog';
import { defaultWarmupValue } from './warmupLog';
import type { Gym } from './types';

export const MIN_ITEMS = 2;
export const MAX_ITEMS = 4;

/** The three light stations, in order of preference. */
export type WarmupStation = 'bands' | 'dumbbell' | 'body';
export const WARMUP_STATIONS: readonly WarmupStation[] = ['bands', 'dumbbell', 'body'];

export interface WarmupPlanItem {
  /** Canonical English catalog name. */
  name: string;
  exerciseId: string;
  reps?: number;
  durationSec?: number;
}

export interface WarmupProposal {
  station: WarmupStation;
  items: WarmupPlanItem[];
}

export interface WarmupProposalInput {
  /** Primary muscles of the day (most important first). */
  muscles: readonly MuscleGroup[];
  /** The gym the session is for; null/unknown kit = bodyweight only. */
  gym?: Gym | null;
  limits?: Limits;
  /** Muscles fully protected by an active injury. */
  protect?: readonly MuscleGroup[];
  /** Exercise names (any case) the day already holds — never proposed again. */
  exclude?: readonly string[];
  /** How many to propose (clamped to MIN_ITEMS…MAX_ITEMS). Default 3. */
  count?: number;
}

/** Curated light bodyweight drills (catalog ids), by the muscles they warm up. */
const BODY_DRILLS: { id: string; muscles: MuscleGroup[]; reps?: number; durationSec?: number }[] = [
  { id: 'Scapular_Pull-Up', muscles: ['lats', 'traps', 'back', 'biceps', 'shoulders'], reps: 8 },
  { id: 'Incline_Push-Up', muscles: ['chest', 'shoulders', 'triceps'], reps: 10 },
  { id: 'Bodyweight_Squat', muscles: ['quads', 'glutes', 'hamstrings', 'adductors'], reps: 12 },
  { id: 'Butt_Lift_Bridge', muscles: ['glutes', 'hamstrings', 'lower_back', 'quads'], reps: 12 },
  { id: 'Single_Leg_Glute_Bridge', muscles: ['glutes', 'hamstrings', 'quads'], reps: 8 },
  { id: 'Glute_Kickback', muscles: ['glutes', 'hamstrings', 'abductors'], reps: 10 },
  { id: 'Dead_Bug', muscles: ['core', 'lower_back', 'chest', 'shoulders'], reps: 8 },
  { id: 'Side_Bridge', muscles: ['core', 'lower_back', 'abductors'], durationSec: 20 },
  { id: 'Plank', muscles: ['core', 'chest', 'shoulders', 'triceps'], durationSec: 30 },
];

/** Extra muscles a move warms up besides its catalog primary (any station). */
const ALSO_SERVES: Record<string, MuscleGroup[]> = {
  Band_Pull_Apart: ['traps', 'lats', 'back', 'chest'],
  External_Rotation_with_Band: ['chest'],
  Internal_Rotation_with_Band: ['chest'],
};

/** Moving drills read as a warm-up; static holds come after. */
const DYNAMIC =
  /circle|dynamic|world|inchworm|windmill|rotation|cat stretch|groiner|pelvic tilt|hop|raise|walk|swing|lunge|squat|curl|superman|locust/i;

/** Warm-up reps by station (light work, well short of fatigue). */
const REPS: Record<WarmupStation, number> = { bands: 15, dumbbell: 12, body: 10 };

const SKIP =
  /wrist|forearm|pronation|supination|one-arm|alternat|lying|preacher|decline|on a dumbbell/i;

/** The kit the gym is known to have (coarse class), or false when unknown. */
function gymHas(gym: Gym | null | undefined, cls: 'bands' | 'dumbbell'): boolean {
  if (!gym) return false;
  if (gym.inventory?.includes(cls)) return true;
  if (cls === 'bands' && (gym.bandLibrary?.length ?? 0) > 0) return true;
  return (gym.equipmentItems ?? []).some((id) => equipmentById(id)?.cls === cls);
}

function stationAllowed(station: WarmupStation, gym: Gym | null | undefined): boolean {
  return station === 'body' ? true : gymHas(gym, station);
}

/** Which muscles of the day a catalog move may serve (back = the back family). */
function wanted(muscles: readonly MuscleGroup[]): MuscleGroup[] {
  const out: MuscleGroup[] = [];
  const add = (m: MuscleGroup) => {
    if (!out.includes(m)) out.push(m);
  };
  for (const m of muscles) {
    if (m === 'cardio' || m === 'fullbody') continue;
    if (m === 'back') for (const x of ['lats', 'traps', 'lower_back', 'back'] as const) add(x);
    else add(m);
  }
  return out;
}

interface Move {
  r: RichExercise;
  /** Day muscles this move may stand in for. */
  serves: MuscleGroup[];
  reps?: number;
  durationSec?: number;
}

/** All catalog moves of a station, in a stable order (curated first, then by name). */
function pool(station: WarmupStation): Move[] {
  const out: Move[] = [];
  const seen = new Set<string>();
  const push = (r: RichExercise | null, extra: Partial<Move> = {}) => {
    if (!r || r.equipment !== station || seen.has(r.name)) return;
    seen.add(r.name);
    out.push({
      r,
      serves: [
        ...new Set([
          ...(extra.serves ?? []),
          ...r.primaryMuscles.slice(0, 1),
          ...(ALSO_SERVES[r.id] ?? []),
        ]),
      ],
      ...(extra.reps ? { reps: extra.reps } : {}),
      ...(extra.durationSec ? { durationSec: extra.durationSec } : {}),
    });
  };
  if (station === 'body') {
    for (const d of BODY_DRILLS)
      push(richExerciseById(d.id), { serves: d.muscles, reps: d.reps, durationSec: d.durationSec });
  }
  const rest: RichExercise[] = [];
  for (const c of BUILT_IN_CATALOG) {
    const r = richExerciseById(c.id);
    if (!r || r.equipment !== station) continue;
    if (station === 'bands') {
      if (r.category === 'strength') rest.push(r);
    } else if (station === 'dumbbell') {
      if (r.category === 'strength' && r.mechanic === 'isolation' && r.level === 'beginner')
        if (!SKIP.test(r.name)) rest.push(r);
    } else if (r.category === 'stretching' && DYNAMIC.test(r.name)) {
      rest.push(r);
    }
  }
  rest.sort((a, b) => a.name.localeCompare(b.name));
  for (const r of rest) push(r);
  return out;
}

/**
 * The day's warm-up exercises at one light station, or null (a generic warm-up).
 * Deterministic: same input, same proposal.
 */
export function warmupProposal(input: WarmupProposalInput): WarmupProposal | null {
  const muscles = wanted(input.muscles);
  if (muscles.length === 0) return null;
  const limits = input.limits ?? NO_LIMITS;
  const protect = new Set(input.protect ?? []);
  const taken = new Set((input.exclude ?? []).map((n) => n.trim().toLowerCase()));
  const count = Math.max(MIN_ITEMS, Math.min(MAX_ITEMS, input.count ?? 3));

  const allowed = (r: RichExercise): boolean => {
    if (taken.has(r.name.toLowerCase())) return false;
    if (r.primaryMuscles.some((m) => protect.has(m))) return false;
    const f = exerciseFlag(r.name, limits, r);
    return f.level !== 'avoid' && f.level !== 'caution' && f.cap > 0;
  };

  for (const station of WARMUP_STATIONS) {
    if (!stationAllowed(station, input.gym)) continue;
    const moves = pool(station).filter((p) => allowed(p.r));
    const items: WarmupPlanItem[] = [];
    const used = new Set<string>();
    // Round-robin over the day's muscles so one muscle can't take every slot.
    for (let round = 0; round < count && items.length < count; round++) {
      let progressed = false;
      for (const m of muscles) {
        if (items.length >= count) break;
        const hit = moves.find((p) => !used.has(p.r.id) && p.serves.includes(m));
        if (!hit) continue;
        used.add(hit.r.id);
        progressed = true;
        const value =
          hit.reps || hit.durationSec
            ? {
                ...(hit.reps ? { reps: hit.reps } : {}),
                ...(hit.durationSec ? { durationSec: hit.durationSec } : {}),
              }
            : 'durationSec' in defaultWarmupValue(hit.r.name)
              ? defaultWarmupValue(hit.r.name)
              : { reps: REPS[station] };
        items.push({ name: hit.r.name, exerciseId: hit.r.id, ...value });
      }
      if (!progressed) break;
    }
    if (items.length >= MIN_ITEMS) return { station, items };
  }
  return null;
}
