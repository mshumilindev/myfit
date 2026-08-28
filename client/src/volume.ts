/**
 * Volume landmarks -- weekly working-set targets per muscle (MEV / MAV / MRV)
 * and which zone a muscle's current volume sits in. Built on our fractional set
 * counting (muscleSetsInWorkout, primary=1 / secondary=0.5), so it reads at the
 * fine level -- lats vs traps vs lower_back separately -- which is the whole
 * point: not "how much did you lift" but "where each muscle stands against its
 * own productive range". See design VOL-1..W.
 *
 *   MEV  minimum effective volume  -- below this, little growth stimulus
 *   MAV  maximum adaptive volume   -- the productive sweet spot tops out here
 *   MRV  maximum recoverable volume -- above this is junk / overreaching
 */
import { muscleSetsInWorkout } from './store';
import type { Workout } from './types';
import type { MuscleGroup } from './data/exercises';

const DAY = 24 * 3600 * 1000;

export interface Landmark {
  mev: number;
  mav: number;
  mrv: number;
}

/**
 * Weekly working-set landmarks per fine muscle group. Consensus hypertrophy
 * ranges (Israetel / Renaissance Periodization and similar), rounded to whole
 * sets for our fractional counting. Groups without an entry (adductors,
 * abductors, neck, generic `back`) have no established landmark and stay out of
 * the volume read rather than being guessed at.
 */
export const LANDMARKS: Partial<Record<MuscleGroup, Landmark>> = {
  chest: { mev: 8, mav: 14, mrv: 22 },
  lats: { mev: 10, mav: 16, mrv: 24 },
  traps: { mev: 6, mav: 12, mrv: 18 },
  lower_back: { mev: 4, mav: 8, mrv: 12 },
  shoulders: { mev: 8, mav: 16, mrv: 26 },
  biceps: { mev: 6, mav: 12, mrv: 20 },
  triceps: { mev: 6, mav: 12, mrv: 18 },
  forearms: { mev: 5, mav: 8, mrv: 14 },
  quads: { mev: 8, mav: 14, mrv: 20 },
  hamstrings: { mev: 6, mav: 12, mrv: 18 },
  glutes: { mev: 6, mav: 12, mrv: 18 },
  calves: { mev: 6, mav: 12, mrv: 20 },
  core: { mev: 0, mav: 8, mrv: 16 },
};

/** Landmarked fine muscles, head-to-toe reading order (the Fine grain). */
export const VOLUME_MUSCLES: MuscleGroup[] = [
  'chest',
  'lats',
  'traps',
  'lower_back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
];

export interface VolumeZoneDef {
  key: string;
  label: string;
  members: MuscleGroup[];
}

/**
 * Coarse zones -- the Zones grain, mirroring the two-level muscle read used in
 * Trends. Members are only the landmarked fine groups so a zone's summed sets
 * and its summed target stay on the same scale (adductors/abductors are left
 * out of Legs for exactly that reason).
 */
export const VOLUME_ZONES: VolumeZoneDef[] = [
  { key: 'chest', label: 'Chest', members: ['chest'] },
  { key: 'back', label: 'Back', members: ['lats', 'traps', 'lower_back'] },
  { key: 'shoulders', label: 'Shoulders', members: ['shoulders'] },
  { key: 'arms', label: 'Arms', members: ['biceps', 'triceps', 'forearms'] },
  { key: 'legs', label: 'Legs', members: ['quads', 'hamstrings', 'glutes', 'calves'] },
  { key: 'core', label: 'Core', members: ['core'] },
];

export type Zone = 'none' | 'under' | 'productive' | 'high' | 'over';

/** Which zone a set count falls into, given the muscle's landmarks. */
export function classifyZone(sets: number, lm: Landmark): Zone {
  if (sets <= 0) return 'none';
  if (sets < lm.mev) return 'under';
  if (sets < lm.mav) return 'productive';
  if (sets <= lm.mrv) return 'high';
  return 'over';
}

/** Sum the member landmarks into one landmark for a zone. */
export function zoneLandmark(members: MuscleGroup[]): Landmark {
  const out: Landmark = { mev: 0, mav: 0, mrv: 0 };
  for (const m of members) {
    const lm = LANDMARKS[m];
    if (!lm) continue;
    out.mev += lm.mev;
    out.mav += lm.mav;
    out.mrv += lm.mrv;
  }
  return out;
}

/**
 * Fractional working sets per muscle across the trailing `days` (default 7 --
 * a rolling week, the standard window for a volume read, so a fresh Monday
 * doesn't read as "everything under MEV"). Same currency as the landmarks.
 */
export function weeklyMuscleSets(
  finished: Workout[],
  now: number,
  days = 7,
): Map<MuscleGroup, number> {
  const since = now - days * DAY;
  const out = new Map<MuscleGroup, number>();
  for (const w of finished) {
    if (w.startedAt < since) continue;
    for (const [m, n] of muscleSetsInWorkout(w)) out.set(m, (out.get(m) ?? 0) + n);
  }
  return out;
}

/** Sum a per-muscle set map over a zone's members. */
export function zoneSets(perMuscle: Map<MuscleGroup, number>, members: MuscleGroup[]): number {
  let s = 0;
  for (const m of members) s += perMuscle.get(m) ?? 0;
  return s;
}

/** Age in days of the earliest finished session (for the cold-start state). */
export function historyAgeDays(finished: Workout[], now: number): number {
  let earliest = now;
  for (const w of finished) if (w.startedAt < earliest) earliest = w.startedAt;
  return (now - earliest) / DAY;
}

/** CSS colour token per zone -- the volume heatmap and range bars share it. */
export const ZONE_COLOR: Record<Zone, string> = {
  none: 'var(--color-neutral-800)',
  under: 'var(--color-neutral-600)',
  productive: 'var(--color-ok)',
  high: 'var(--color-accent)',
  over: 'var(--color-danger)',
};

/**
 * Per-muscle heatmap colours for the trailing week: each muscle painted by its
 * zone (fine grain) or its zone's aggregate zone (coarse grain). Shared by the
 * list's own mini-map and the desktop right-column figure.
 */
export function volumeHeatColors(
  finished: Workout[],
  now: number,
  grain: 'fine' | 'zones',
  days = 7,
): Partial<Record<MuscleGroup, string>> {
  const per = weeklyMuscleSets(finished, now, days);
  const out: Partial<Record<MuscleGroup, string>> = {};
  if (grain === 'fine') {
    for (const m of VOLUME_MUSCLES) {
      const s = per.get(m) ?? 0;
      if (s > 0) out[m] = ZONE_COLOR[classifyZone(s, LANDMARKS[m] as Landmark)];
    }
  } else {
    for (const z of VOLUME_ZONES) {
      const s = zoneSets(per, z.members);
      if (s <= 0) continue;
      const c = ZONE_COLOR[classifyZone(s, zoneLandmark(z.members))];
      for (const m of z.members) out[m] = c;
    }
  }
  return out;
}
