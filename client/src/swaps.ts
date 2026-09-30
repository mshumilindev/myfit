/**
 * Smart swaps (design SWAP-1..W): alternatives for an exercise that keep the
 * same fine-muscle profile (primary + secondaries) AND can be done in the gym.
 * A swap should preserve how your volume is distributed -- not just "another
 * chest move" -- so we score candidates by profile similarity (cosine over a
 * primary=1 / secondary=0.5 weighting) and rank the gym-available ones first.
 * Pure over the catalog + gym inventory.
 */
import { exerciseFlag, type Limits } from './conditions';
import { exerciseNeeds, missingAtGym } from './store';
import { searchCatalog, muscleInfoByName, richExerciseByName } from './data/exercises';
import type { MuscleGroup } from './data/exercises';
import type { Gym } from './types';

export interface SwapCandidate {
  name: string;
  primary: MuscleGroup | null;
  secondary: MuscleGroup[];
  equipment: string[];
  missing: string[];
  available: boolean;
  bodyweight: boolean;
  match: number; // 0..1 profile similarity
}

/** Weighted muscle vector: primary 1.0, each distinct secondary 0.5. */
function vec(primary: MuscleGroup | null, secondary: MuscleGroup[]): Map<MuscleGroup, number> {
  const m = new Map<MuscleGroup, number>();
  if (primary && primary !== 'cardio') m.set(primary, 1);
  for (const s of secondary) if (s !== 'cardio' && !m.has(s)) m.set(s, 0.5);
  return m;
}

/** Cosine similarity of two muscle vectors (1 = identical profile). */
function cosine(a: Map<MuscleGroup, number>, b: Map<MuscleGroup, number>): number {
  let dot = 0;
  for (const [m, w] of a) {
    const bw = b.get(m);
    if (bw) dot += w * bw;
  }
  let ma = 0;
  for (const w of a.values()) ma += w * w;
  let mb = 0;
  for (const w of b.values()) mb += w * w;
  if (ma === 0 || mb === 0) return 0;
  return dot / (Math.sqrt(ma) * Math.sqrt(mb));
}

function isBodyweight(equipment: string[]): boolean {
  return equipment.length === 0 || equipment.every((e) => e === 'body');
}

export type MovementPattern =
  'squat' | 'hinge' | 'press' | 'pull' | 'row' | 'curl' | 'extend' | 'raise';

const PATTERN_WORDS: [MovementPattern, string[]][] = [
  [
    'hinge',
    ['deadlift', 'good morning', 'hip thrust', 'bridge', 'pull through', 'hyperextension', 'swing'],
  ],
  ['squat', ['squat', 'leg press', 'lunge', 'step up', 'step-up']],
  ['row', [' row']],
  ['pull', ['pull-up', 'pullup', 'pulldown', 'pull down', 'chin']],
  ['curl', ['curl']],
  ['extend', ['extension', 'pushdown', 'kickback', 'skull']],
  ['raise', ['raise', 'shrug', 'fly', 'flye']],
  ['press', ['press', 'push-up', 'push up', 'dip']],
];

/** Coarse movement pattern from the exercise name (null when unclear). */
export function movementPattern(name: string): MovementPattern | null {
  const n = ` ${name.toLowerCase()}`;
  for (const [p, words] of PATTERN_WORDS) if (words.some((w) => n.includes(w))) return p;
  return null;
}

/** Machine / cable / supported variants: steadier and kinder when the limits are strict. */
export const isSupported = (name: string, equipment: string[]): boolean =>
  equipment.some((e) => e === 'machine' || e === 'cable') ||
  /\b(machine|smith|supported|seated)\b/i.test(name);

/** Junk for a swap: drags, carries, jumps and other non-lifts. */
const ODD = /\b(drag|crawl|carry|jump|toss|throw|slam|sled|sprint)\b/i;

/**
 * Up to `count` alternatives for `name`, of the same movement pattern and primary muscle, ranked
 * by pattern, gym availability, (when limits flag anything) supported variants, profile match, simplest kit.
 * Lifts the limits avoid or flag as caution are dropped. Stretches are
 * excluded and the exercise itself never appears.
 */
export function swapCandidates(
  name: string,
  gym: Gym | null,
  count = 4,
  limits?: Limits,
): SwapCandidate[] {
  const info = muscleInfoByName(name);
  if (!info || info.primary === 'cardio') return [];
  const cur = vec(info.primary, info.secondary);
  const pool = searchCatalog('', 2000, undefined, info.primary);
  const seen = new Set<string>([name.trim().toLowerCase()]);
  const cands: SwapCandidate[] = [];
  for (const ex of pool) {
    const nm = ex.names[0];
    const key = nm.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const ci = muscleInfoByName(nm);
    const primary = (ci?.primary ?? ex.muscle) as MuscleGroup;
    if (primary === 'cardio') continue;
    if (richExerciseByName(nm)?.category === 'stretching') continue;
    if (primary !== info.primary || ODD.test(nm)) continue;
    // never suggest a lift the conditions rule out or flag
    if (limits) {
      const lvl = exerciseFlag(nm, limits).level;
      if (lvl === 'avoid' || lvl === 'caution') continue;
    }
    const secondary = ci?.secondary ?? [];
    const equipment = exerciseNeeds(nm);
    const missing = gym ? missingAtGym(gym, equipment) : [];
    cands.push({
      name: nm,
      primary,
      secondary,
      equipment,
      missing,
      available: missing.length === 0,
      bodyweight: isBodyweight(equipment),
      match: cosine(cur, vec(primary, secondary)),
    });
  }
  const pat = movementPattern(name);
  const strict =
    !!limits && (limits.effects.avoid?.length ?? 0) + (limits.effects.caution?.length ?? 0) > 0;
  const samePattern = pat ? cands.filter((x) => movementPattern(x.name) === pat) : [];
  const pool2 = samePattern.length >= Math.min(count, 2) ? samePattern : cands;
  const support = (x: SwapCandidate) => (strict && isSupported(x.name, x.equipment) ? 1 : 0);
  pool2.sort(
    (a, b) =>
      Number(b.available) - Number(a.available) ||
      support(b) - support(a) ||
      b.match - a.match ||
      a.equipment.length - b.equipment.length,
  );
  return pool2.slice(0, count);
}
