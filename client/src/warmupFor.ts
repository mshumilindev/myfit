/**
 * warmupFor — concrete warm-up suggestions for the day (pure, deterministic).
 *
 * Three targets, up to MAX_PER_TARGET items each:
 *  • mobility   — stretching / mobility drills from the exercise catalog for the
 *                 muscles the day's first lifts train (dynamic drills first);
 *  • activation — a small curated list of catalog ids (band pull-apart, glute
 *                 bridge, dead bug …) picked by muscle;
 *  • cardio     — a few light catalog cardio ids, leg-friendly ones first on a
 *                 lower day.
 * Everything is checked against the person's condition limits (exerciseFlag:
 * 'avoid' / 'caution' / a zero load cap drop an item) and active injuries (a
 * muscle still in Protect is left out). When a target ends up empty, mobility
 * falls back to the Plan widget's mobUpper / mobLower lines.
 *
 * Names are the canonical English catalog names (localised on display through
 * the exercise-name system), so no new name strings are needed.
 */
import { exerciseFlag, NO_LIMITS, type Limits } from './conditions';
import {
  BUILT_IN_CATALOG,
  richExerciseById,
  type MuscleGroup,
  type RichExercise,
} from './data/exercises';
import { protectedMuscles } from './injury';
import { ps } from './today/widgets/plan.strings';
import type { LocaleId } from './i18n';
import type { Injury } from './types';

export const MAX_PER_TARGET = 6;

export type WarmupTarget = 'mobility' | 'activation' | 'cardio';
export type WarmupDayType = 'upper' | 'lower' | 'full';

export interface WarmupSuggestion {
  /** Stable key: catalog id, or `text:<line>` for a fallback line. */
  key: string;
  /** Canonical English catalog name (or the fallback line). */
  name: string;
  target: WarmupTarget;
  exerciseId: string | null;
  muscle: MuscleGroup | null;
  durationSec?: number;
  reps?: number;
}

export type WarmupSuggestions = Record<WarmupTarget, WarmupSuggestion[]>;

export interface WarmupInput {
  /** Primary muscles of the day's first lifts (most important first). */
  muscles?: readonly MuscleGroup[];
  /** Used when `muscles` is empty (or to say whether the day is lower-body). */
  dayType?: WarmupDayType | null;
  limits?: Limits;
  injuries?: readonly Injury[];
  /** Names (any case) already on the list — never suggested again. */
  exclude?: readonly string[];
  /** Locale of the fallback mobility lines. */
  locale?: LocaleId;
  perTarget?: number;
}

const UPPER: MuscleGroup[] = ['shoulders', 'chest', 'lats', 'traps', 'triceps', 'biceps'];
const LOWER: MuscleGroup[] = ['hamstrings', 'quads', 'glutes', 'calves', 'adductors', 'abductors'];
const FULL: MuscleGroup[] = ['shoulders', 'hamstrings', 'glutes', 'lower_back', 'quads', 'chest'];
const LOWER_SET = new Set<MuscleGroup>([...LOWER, 'lower_back']);

/** Curated activation drills (catalog ids), by the muscles they wake up. */
const ACTIVATION: { id: string; muscles: MuscleGroup[]; reps?: number; durationSec?: number }[] = [
  { id: 'Band_Pull_Apart', muscles: ['shoulders', 'traps', 'lats', 'back', 'chest'], reps: 15 },
  { id: 'External_Rotation_with_Band', muscles: ['shoulders', 'chest'], reps: 12 },
  { id: 'Scapular_Pull-Up', muscles: ['lats', 'traps', 'back', 'biceps'], reps: 8 },
  { id: 'Butt_Lift_Bridge', muscles: ['glutes', 'hamstrings', 'lower_back', 'quads'], reps: 12 },
  { id: 'Single_Leg_Glute_Bridge', muscles: ['glutes', 'hamstrings', 'quads'], reps: 8 },
  { id: 'Monster_Walk', muscles: ['abductors', 'glutes', 'quads', 'adductors'], reps: 10 },
  { id: 'Glute_Kickback', muscles: ['glutes', 'hamstrings'], reps: 10 },
  { id: 'Dead_Bug', muscles: ['core', 'lower_back', 'chest', 'shoulders'], reps: 8 },
  { id: 'Side_Bridge', muscles: ['core', 'lower_back', 'abductors'], durationSec: 20 },
  { id: 'Plank', muscles: ['core', 'chest', 'shoulders', 'triceps'], durationSec: 30 },
];

/** Light cardio (catalog ids) — the leg-friendly ones lead on a lower day. */
const CARDIO: { id: string; durationSec: number; legs: boolean }[] = [
  { id: 'Walking_Treadmill', durationSec: 300, legs: true },
  { id: 'Bicycling_Stationary', durationSec: 300, legs: true },
  { id: 'Elliptical_Trainer', durationSec: 300, legs: false },
  { id: 'Rowing_Stationary', durationSec: 240, legs: false },
  { id: 'Fast_Skipping', durationSec: 60, legs: false },
  { id: 'Rope_Jumping', durationSec: 90, legs: false },
];

/** Moving drills read as a warm-up; static holds and foam-rolling come after. */
const DYNAMIC =
  /circle|dynamic|world|inchworm|windmill|rotation|cat stretch|groiner|pelvic tilt|hop|raise|walk|swing|lunge|squat|curl|superman|locust/i;
function mobilityRank(r: RichExercise): number {
  if (/-smr$/i.test(r.name) || r.equipment === 'foamRoll') return 3;
  return DYNAMIC.test(r.name) ? 0 : 1;
}

function musclesFor(input: WarmupInput): MuscleGroup[] {
  const given = [...(input.muscles ?? [])].filter((m) => m !== 'cardio' && m !== 'fullbody');
  const out: MuscleGroup[] = [];
  for (const m of given) {
    const g: MuscleGroup = m === 'back' ? 'lats' : m;
    if (!out.includes(g)) out.push(g);
  }
  if (out.length) return out;
  return input.dayType === 'lower' ? LOWER : input.dayType === 'upper' ? UPPER : FULL;
}

function isLowerDay(muscles: readonly MuscleGroup[], dayType?: WarmupDayType | null): boolean {
  if (dayType) return dayType === 'lower';
  const low = muscles.filter((m) => LOWER_SET.has(m)).length;
  return muscles.length > 0 && low * 2 > muscles.length;
}

/** Stretching drills by primary muscle, best first, stable on ties. */
function mobilityFor(muscle: MuscleGroup): RichExercise[] {
  const seen = new Set<string>();
  const out: RichExercise[] = [];
  for (const c of BUILT_IN_CATALOG) {
    const r = richExerciseById(c.id);
    if (!r || r.category !== 'stretching' || r.primaryMuscles[0] !== muscle) continue;
    if (seen.has(r.name)) continue;
    seen.add(r.name);
    out.push(r);
  }
  return out.sort((a, b) => mobilityRank(a) - mobilityRank(b) || a.name.localeCompare(b.name));
}

export function warmupSuggestions(input: WarmupInput = {}): WarmupSuggestions {
  const limits = input.limits ?? NO_LIMITS;
  const protect = protectedMuscles([...(input.injuries ?? [])]);
  const cap = Math.max(1, Math.min(MAX_PER_TARGET, input.perTarget ?? MAX_PER_TARGET));
  const taken = new Set((input.exclude ?? []).map((n) => n.trim().toLowerCase()));
  const muscles = musclesFor(input);
  const lower = isLowerDay(muscles, input.dayType);

  /** Is this catalog move fine for this person right now? */
  const allowed = (r: RichExercise): boolean => {
    if (taken.has(r.name.toLowerCase())) return false;
    if (r.primaryMuscles.some((m) => protect.has(m))) return false;
    const f = exerciseFlag(r.name, limits, r);
    return f.level !== 'avoid' && f.level !== 'caution' && f.cap > 0;
  };
  const used = new Set<string>();
  const take = (r: RichExercise): boolean => {
    if (used.has(r.id) || !allowed(r)) return false;
    used.add(r.id);
    return true;
  };

  // Mobility: round-robin over the day's muscles so one muscle can't hog the list.
  const mobility: WarmupSuggestion[] = [];
  const pools = muscles.map((m) => ({ m, list: mobilityFor(m) }));
  for (let round = 0; round < cap && mobility.length < cap; round++) {
    for (const { m, list } of pools) {
      if (mobility.length >= cap) break;
      const r = list.find((x) => !used.has(x.id) && allowed(x));
      if (!r || !take(r)) continue;
      const moving = mobilityRank(r) === 0;
      mobility.push({
        key: r.id,
        name: r.name,
        target: 'mobility',
        exerciseId: r.id,
        muscle: m,
        ...(moving ? { reps: 10 } : { durationSec: mobilityRank(r) === 3 ? 45 : 30 }),
      });
    }
    if (pools.every(({ list }) => !list.some((x) => !used.has(x.id) && allowed(x)))) break;
  }
  if (mobility.length === 0) {
    const lines = ps(input.locale ?? 'en')[lower ? 'mobLower' : 'mobUpper'];
    for (const line of lines.slice(0, cap)) {
      if (taken.has(line.toLowerCase())) continue;
      mobility.push({
        key: `text:${line}`,
        name: line,
        target: 'mobility',
        exerciseId: null,
        muscle: null,
      });
    }
  }

  // Activation: drills that wake the day's muscles, in the order of those muscles.
  const activation: WarmupSuggestion[] = [];
  for (const m of muscles) {
    for (const a of ACTIVATION) {
      if (activation.length >= cap) break;
      if (!a.muscles.includes(m)) continue;
      const r = richExerciseById(a.id);
      if (!r || !take(r)) continue;
      activation.push({
        key: r.id,
        name: r.name,
        target: 'activation',
        exerciseId: r.id,
        muscle: m,
        ...(a.reps ? { reps: a.reps } : {}),
        ...(a.durationSec ? { durationSec: a.durationSec } : {}),
      });
    }
  }

  // Light cardio: leg-friendly first on a lower day, the rest first otherwise.
  const cardio: WarmupSuggestion[] = [];
  const ordered = [...CARDIO].sort(
    (a, b) => Number(lower ? b.legs : a.legs) - Number(lower ? a.legs : b.legs),
  );
  for (const c of ordered) {
    if (cardio.length >= cap) break;
    const r = richExerciseById(c.id);
    if (!r || !take(r)) continue;
    cardio.push({
      key: r.id,
      name: r.name,
      target: 'cardio',
      exerciseId: r.id,
      muscle: null,
      durationSec: c.durationSec,
    });
  }
  return { mobility, activation, cardio };
}

/**
 * Everything the warm-up picker may browse: the stretching / mobility catalog
 * plus the curated activation and light-cardio ids. Stable order (by name).
 */
export function warmupCatalog(): RichExercise[] {
  const extra = new Set([...ACTIVATION.map((a) => a.id), ...CARDIO.map((c) => c.id)]);
  const seen = new Set<string>();
  const out: RichExercise[] = [];
  for (const c of BUILT_IN_CATALOG) {
    const r = richExerciseById(c.id);
    if (!r || seen.has(r.id)) continue;
    if (r.category === 'stretching' || extra.has(r.id)) {
      seen.add(r.id);
      out.push(r);
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
