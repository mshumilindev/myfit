/**
 * Goals ("My Fit") model + pure selectors. Three layers: a sex-aware physique
 * TARGET (the north-star shape), the current block's per-muscle FOCUS
 * (grow/hold/ease at fine sub-region resolution), and measured LONG-TERM goals.
 * Persistence + Firestore sync live in store.ts (mirrors bodyMetrics); this file
 * is pure data and helpers only.
 */
import type { FocusMuscle } from './data/subregions';
import { FOCUS_MUSCLES, focusToGroup } from './data/subregions';
import type { MuscleGroup } from './data/exercises';
import type { Landmark } from './volume';

export type Emphasis = 'grow' | 'hold' | 'ease';

export type ArchetypeId =
  | 'v-taper'
  | 'classic'
  | 'powerbuilder'
  | 'lean-athlete'
  | 'hourglass'
  | 'glute-focus'
  | 'toned-lean'
  | 'strong-athlete';

export interface PhysiqueTarget {
  archetype: ArchetypeId;
  sex: 'male' | 'female';
  setAt: number;
}

export interface BlockFocus {
  /** Free label, e.g. "Block 2". */
  label: string;
  startedAt: number;
  weeks: number;
  /** Absent muscle = 'hold' (the default). */
  emphasis: Partial<Record<FocusMuscle, Emphasis>>;
}

export interface GoalMeasure {
  kind: 'ratio' | 'bodyfat' | 'volume-balance' | 'custom';
  label: string;
  from: number;
  to: number;
  current?: number;
}

export interface LongTermGoal {
  id: string;
  title: string;
  horizonMonths: number;
  startedAt: number;
  measure: GoalMeasure;
  /** Fine muscles this goal drives to grow. */
  drivesMuscles: FocusMuscle[];
  milestones: { label: string; at: number; done: boolean }[];
}

export interface FitGoals {
  physique?: PhysiqueTarget;
  focus?: BlockFocus;
  longTerm: LongTermGoal[];
}

export const EMPTY_GOALS: FitGoals = { longTerm: [] };

/** Archetype presets: sex + the fine muscles each seeds to GROW. */
export const ARCHETYPES: Record<ArchetypeId, { sex: 'male' | 'female'; grow: FocusMuscle[] }> = {
  'v-taper': { sex: 'male', grow: ['delt-side', 'lats', 'chest-upper'] },
  classic: { sex: 'male', grow: ['chest-upper', 'chest-lower', 'delt-side', 'biceps', 'quads'] },
  powerbuilder: { sex: 'male', grow: ['chest-lower', 'quads', 'delt-side', 'traps'] },
  'lean-athlete': { sex: 'male', grow: ['abs', 'delt-side', 'quads', 'calves'] },
  hourglass: { sex: 'female', grow: ['delt-side', 'glutes'] },
  'glute-focus': { sex: 'female', grow: ['glutes', 'hamstrings', 'quads'] },
  'toned-lean': { sex: 'female', grow: ['abs', 'delt-side', 'glutes', 'calves'] },
  'strong-athlete': { sex: 'female', grow: ['quads', 'glutes', 'lats', 'delt-side'] },
};

export const ARCHETYPES_BY_SEX = (sex: 'male' | 'female'): ArchetypeId[] =>
  (Object.keys(ARCHETYPES) as ArchetypeId[]).filter((id) => ARCHETYPES[id].sex === sex);

/** Emphasis for one muscle (default hold). */
export function emphasisOf(g: FitGoals, f: FocusMuscle): Emphasis {
  return g.focus?.emphasis[f] ?? 'hold';
}

/** grow / ease muscle lists from the current focus. */
export function focusLists(g: FitGoals): { grow: FocusMuscle[]; ease: FocusMuscle[] } {
  const grow: FocusMuscle[] = [];
  const ease: FocusMuscle[] = [];
  for (const f of FOCUS_MUSCLES) {
    const e = g.focus?.emphasis[f];
    if (e === 'grow') grow.push(f);
    else if (e === 'ease') ease.push(f);
  }
  return { grow, ease };
}

export function focusCounts(g: FitGoals): { grow: number; ease: number; hold: number } {
  const { grow, ease } = focusLists(g);
  return { grow: grow.length, ease: ease.length, hold: FOCUS_MUSCLES.length - grow.length - ease.length };
}

/** 0..1 progress toward a long-term goal's measure. */
export function goalProgress(goal: LongTermGoal): number {
  const { from, to, current } = goal.measure;
  if (current == null || to === from) return 0;
  return Math.max(0, Math.min(1, (current - from) / (to - from)));
}


/**
 * Coarse-group emphasis folded from the fine focus (grow beats ease beats hold).
 * The volume/radar engines key on MuscleGroup, so a group counts as "grow" if
 * ANY of its sub-regions is set to grow.
 */
export function groupEmphasis(g: FitGoals): Map<MuscleGroup, Emphasis> {
  const out = new Map<MuscleGroup, Emphasis>();
  for (const f of FOCUS_MUSCLES) {
    const e = g.focus?.emphasis[f];
    if (!e || e === 'hold') continue;
    const grp = focusToGroup(f);
    const prev = out.get(grp);
    if (prev === 'grow') continue;
    if (e === 'grow') out.set(grp, 'grow');
    else if (!prev) out.set(grp, 'ease');
  }
  return out;
}

/** Per-grow/ease shift applied to a muscle's weekly set landmarks. */
export const FOCUS_MAV_DELTA = 4;
const GROW_MEV = 2;

/**
 * Apply the block focus to volume landmarks: GROW raises the productive target
 * (and the floor, so it's flagged sooner); EASE trims it. Generic so it keeps
 * any extra fields (e.g. personalisation source/confidence). Muscles with no
 * emphasis pass through untouched.
 */
export function focusAdjustLandmarks<T extends Landmark>(
  base: ReadonlyMap<MuscleGroup, T>,
  g: FitGoals,
): Map<MuscleGroup, T> {
  const emph = groupEmphasis(g);
  const out = new Map<MuscleGroup, T>();
  for (const [m, lm] of base) {
    const e = emph.get(m);
    if (!e) {
      out.set(m, lm);
      continue;
    }
    if (e === 'grow') {
      out.set(m, { ...lm, mev: lm.mev + GROW_MEV, mav: lm.mav + FOCUS_MAV_DELTA, mrv: lm.mrv + FOCUS_MAV_DELTA });
    } else {
      const mev = Math.max(0, lm.mev - 3);
      out.set(m, { ...lm, mev, mav: Math.max(mev, lm.mav - FOCUS_MAV_DELTA) });
    }
  }
  return out;
}


/**
 * CSS variables to crop the physique sprite (public/physiques/figures.png,
 * 8 cols x 2 rows: male row 0 / female row 1, each archetype a base+highlighted
 * pair). --fig-bx is the base column, --fig-hx the highlighted one; the figure
 * element swaps to --fig-hx on hover/active (web) and active (mobile).
 */
const FIG_ZOOM = 1.09; // crop ~4% each side to hide the glow bleed between cells
export const PHYS_BG_SIZE = `${(800 * FIG_ZOOM).toFixed(2)}% ${(200 * FIG_ZOOM).toFixed(2)}%`;
const figPos = (i: number, n: number) =>
  `${((100 * ((i + 0.5) * FIG_ZOOM - 0.5)) / (n * FIG_ZOOM - 1)).toFixed(3)}%`;

export function physiqueFigureVars(id: ArchetypeId): Record<string, string> {
  const sex = ARCHETYPES[id].sex;
  const idx = Math.max(0, ARCHETYPES_BY_SEX(sex).indexOf(id));
  const baseCol = idx * 2;
  return {
    '--fig-bx': figPos(baseCol, 8),
    '--fig-hx': figPos(baseCol + 1, 8),
    '--fig-y': figPos(sex === 'male' ? 0 : 1, 2),
  };
}
