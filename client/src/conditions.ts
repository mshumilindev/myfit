/**
 * Chronic conditions engine. One pure module: conditions in, limits and exercise
 * flags out. Nothing here touches storage, the network or the UI.
 *
 * Privacy: `deidentifiedEffects` is the ONLY shape that may leave the device toward
 * Atlas/LLM payloads, and `coachView` the only one toward a coach. Both are built
 * from effects, never from names or notes (unless the user chose Full for a coach).
 */
import {
  catalogCondition,
  type ConditionCategory,
  effectsAt,
  mergeEffects,
  type CardioCap,
  type ConditionEffects,
  type RiskTag,
} from './data/conditionCatalog';
import { richExerciseByName, type MuscleGroup, type RichExercise } from './data/exercises';
import type { ChronicCondition, ConditionShare } from './types';

// ---------------------------------------------------------------------------
// Exercise risk tagging (heuristic, by name, category and muscles)
// ---------------------------------------------------------------------------

const has = (n: string, ...words: string[]) => words.some((w) => n.includes(w));

/** Movement-risk tags for an exercise. Conservative: only clear signals. */
export function exerciseRisk(
  name: string,
  rich: RichExercise | null = richExerciseByName(name),
): RiskTag[] {
  const n = name.toLowerCase();
  const tags = new Set<RiskTag>();
  const cat = rich?.category ?? null;
  const prim = rich?.primaryMuscles ?? [];
  const isStretch = cat === 'stretching';
  if (isStretch) return [];

  const squatLike = has(n, 'squat') && !has(n, 'split squat', 'wall sit');
  const deadlift = has(n, 'deadlift', 'good morning', 'clean', 'snatch', 'rack pull');
  const overhead = has(
    n,
    'overhead',
    'military press',
    'shoulder press',
    'push press',
    'jerk',
    'snatch',
    'handstand',
  );

  if (
    squatLike ||
    deadlift ||
    overhead ||
    has(n, 'farmer', 'yoke', 'carry', 'barbell row', 'bent over')
  )
    tags.add('axial');
  if (has(n, 'good morning', 'deadlift', 'bent over', 'rack pull', 'hyperextension'))
    tags.add('shear');
  if (has(n, 'crunch', 'sit-up', 'sit up', 'leg raise', 'knee raise', 'jackknife', 'v-up'))
    tags.add('flexion');
  if (has(n, 'back extension', 'hyperextension', 'superman', 'cobra', 'bridge', 'hip extension'))
    tags.add('extension');
  if (has(n, 'twist', 'woodchop', 'wood chop', 'rotation', 'windmill', 'russian'))
    tags.add('rotation');
  if (
    cat === 'plyometrics' ||
    has(n, 'jump', 'burpee', 'sprint', 'hop', 'bound', 'skipping', 'plyo')
  )
    tags.add('impact');
  if (overhead || has(n, 'upright row', 'arnold', 'pullover')) tags.add('overhead');
  if (
    (cat === 'powerlifting' || cat === 'olympic weightlifting' || cat === 'strongman') &&
    !has(n, 'curl')
  )
    tags.add('valsalva');
  if (squatLike || deadlift || has(n, 'leg press', 'bench press', 'overhead')) tags.add('valsalva');
  if (
    has(
      n,
      'deep squat',
      'full squat',
      'sissy',
      'pistol',
      'hack squat',
      'lunge',
      'step-up',
      'step up',
    )
  )
    tags.add('deep_knee');
  if (
    has(
      n,
      'pull-up',
      'pullup',
      'chin-up',
      'chinup',
      'dead hang',
      'hanging',
      'muscle-up',
      'toes to bar',
    )
  )
    tags.add('hang');
  if (
    has(
      n,
      'push-up',
      'pushup',
      'handstand',
      'plank',
      'wrist curl',
      'front squat',
      'clean',
      'burpee',
    )
  )
    tags.add('wrist_load');
  if (has(n, 'inverted', 'headstand', 'decline', 'inversion')) tags.add('inversion');
  if (
    cat === 'cardio' &&
    has(n, 'sprint', 'interval', 'hiit', 'run', 'rower', 'row machine', 'assault')
  )
    tags.add('high_cardio');
  if (prim.includes('cardio') && has(n, 'jump', 'burpee', 'sprint')) tags.add('high_cardio');
  if (has(n, 'flexion') && has(n, 'spine')) tags.add('flexion');
  return [...tags];
}

// ---------------------------------------------------------------------------
// Stacked limits
// ---------------------------------------------------------------------------

export interface Limits {
  /** Stricter-wins merge of every condition's effects at its severity. */
  effects: ConditionEffects;
  /** Condition keys behind each restriction (for "why" lines; never sent off-device). */
  avoidBy: Partial<Record<RiskTag, string[]>>;
  cautionBy: Partial<Record<RiskTag, string[]>>;
  capBy: Partial<Record<MuscleGroup, string[]>>;
  keys: string[];
}

export const NO_LIMITS: Limits = { effects: {}, avoidBy: {}, cautionBy: {}, capBy: {}, keys: [] };

const DAY = 86_400_000;

/**
 * Conditions that pass. `days` = typical length used to pre-fill the end date;
 * `auto` = the app can derive the stage from the start date on its own.
 */
export const TEMPORARY: Record<string, { days: number; auto?: 'pregnancy' }> = {
  preg_first: { days: 280, auto: 'pregnancy' },
  preg_second: { days: 280, auto: 'pregnancy' },
  preg_third: { days: 280, auto: 'pregnancy' },
  preg_postpartum: { days: 182 },
  preg_diastasis: { days: 182 },
  preg_pelvic_floor: { days: 182 },
  postop_spine_lumbar: { days: 120 },
  postop_spine_cervical: { days: 120 },
  postop_spine_thoracic: { days: 120 },
  postop_knee: { days: 180 },
  postop_knee_replacement: { days: 120 },
  postop_hip: { days: 120 },
  postop_hip_replacement: { days: 90 },
  postop_shoulder: { days: 150 },
  postop_elbow_wrist: { days: 90 },
  postop_ankle_foot: { days: 90 },
  postop_abdomen: { days: 60 },
  postop_heart: { days: 120 },
  postop_chest: { days: 90 },
  postop_breast: { days: 60 },
  postop_csection: { days: 90 },
  postop_bariatric: { days: 180 },
  postop_transplant: { days: 180 },
};

export const isTemporary = (key: string): boolean => key in TEMPORARY;
export const temporaryAuto = (key: string): boolean => !!TEMPORARY[key]?.auto;

/** Suggested end date for a temporary condition that starts at `start` (ms). */
export function suggestedEnd(key: string, start: number): number | undefined {
  const t = TEMPORARY[key];
  return t ? start + t.days * DAY : undefined;
}

/** Pregnancy stage from weeks since the start (LMP-style): ≤13 first, ≤27 second, then third. */
export function pregnancyKeyAt(start: number, now: number): string {
  const weeks = Math.max(0, (now - start) / (7 * DAY));
  return weeks < 14 ? 'preg_first' : weeks < 28 ? 'preg_second' : 'preg_third';
}

/** The catalogue key that applies right now (pregnancy stage follows the dates on its own). */
export function effectiveKey(c: ChronicCondition, now: number): string {
  return TEMPORARY[c.key]?.auto === 'pregnancy' && c.startedAt != null
    ? pregnancyKeyAt(c.startedAt, now)
    : c.key;
}

/** Not started yet, or past its end: no effects. Permanent conditions are always active. */
export function isActive(c: ChronicCondition, now: number): boolean {
  if (c.startedAt != null && c.startedAt > now) return false;
  return !(c.endsAt != null && c.endsAt <= now);
}
export const isEnded = (c: ChronicCondition, now: number): boolean =>
  c.endsAt != null && c.endsAt <= now;

export interface TemporaryProgress {
  day: number;
  total: number;
  daysLeft: number;
  fraction: number;
}
export function temporaryProgress(c: ChronicCondition, now: number): TemporaryProgress | null {
  if (c.startedAt == null || c.endsAt == null || c.endsAt <= c.startedAt) return null;
  const total = Math.round((c.endsAt - c.startedAt) / DAY);
  const day = Math.min(total, Math.max(1, Math.floor((now - c.startedAt) / DAY) + 1));
  return {
    day,
    total,
    daysLeft: Math.max(0, Math.ceil((c.endsAt - now) / DAY)),
    fraction: Math.min(1, Math.max(0, (now - c.startedAt) / (c.endsAt - c.startedAt))),
  };
}

/**
 * Body map "Other" tab: what cannot be pinned to a body part. Everything whose region is
 * `whole`, plus whole-system categories, is reachable here so nothing is unmappable.
 */
export const OTHER_TAB_CATEGORIES: ConditionCategory[] = [
  'neuro',
  'cardio',
  'respiratory',
  'metabolic',
  'pregnancy',
  'other',
];

/** Shown in the Body map "Other" tab: no single body part, or a whole-system category. */
export const isOtherTab = (c: { region: string; category: ConditionCategory }): boolean =>
  c.region === 'whole' || OTHER_TAB_CATEGORIES.includes(c.category);

/** Stack all known, currently active conditions. Unknown keys are ignored, never thrown on. */
export function conditionLimits(
  conditions: readonly ChronicCondition[],
  now: number = Date.now(),
): Limits {
  let merged: ConditionEffects = {};
  const avoidBy: Limits['avoidBy'] = {};
  const cautionBy: Limits['cautionBy'] = {};
  const capBy: Limits['capBy'] = {};
  const keys: string[] = [];
  for (const c of conditions) {
    if (!isActive(c, now)) continue;
    const key = effectiveKey(c, now);
    const cat = catalogCondition(key);
    if (!cat) continue;
    const e = effectsAt(cat.effects, c.severity);
    merged = mergeEffects(merged, e);
    keys.push(key);
    for (const t of e.avoid ?? []) (avoidBy[t] ??= []).push(key);
    for (const t of e.caution ?? []) (cautionBy[t] ??= []).push(key);
    for (const m of Object.keys(e.muscleCaps ?? {}) as MuscleGroup[]) (capBy[m] ??= []).push(key);
  }
  return { effects: merged, avoidBy, cautionBy, capBy, keys };
}

// ---------------------------------------------------------------------------
// Exercise flags
// ---------------------------------------------------------------------------

export type FlagLevel = 'ok' | 'info' | 'caution' | 'avoid';

export interface ExerciseFlag {
  level: FlagLevel;
  /** Risk tags that triggered it. */
  tags: RiskTag[];
  /** Condition keys responsible (empty for 'ok'). */
  because: string[];
  /** Load multiplier 0..1 for the primary muscles (1 = none). */
  cap: number;
}

const LEVEL_ORDER: FlagLevel[] = ['ok', 'info', 'caution', 'avoid'];

/**
 * How an exercise looks under the current limits. Only advisory: manual choice is
 * never blocked; the auto-builder drops 'avoid'.
 */
export function exerciseFlag(
  name: string,
  limits: Limits,
  rich: RichExercise | null = richExerciseByName(name),
): ExerciseFlag {
  if (!limits.keys.length) return { level: 'ok', tags: [], because: [], cap: 1 };
  const risk = exerciseRisk(name, rich);
  const { avoid = [], caution = [] } = limits.effects;
  const because = new Set<string>();
  const tags: RiskTag[] = [];
  let level: FlagLevel = 'ok';
  const up = (l: FlagLevel) => {
    if (LEVEL_ORDER.indexOf(l) > LEVEL_ORDER.indexOf(level)) level = l;
  };
  for (const t of risk) {
    if (avoid.includes(t)) {
      up('avoid');
      tags.push(t);
      (limits.avoidBy[t] ?? []).forEach((k) => because.add(k));
    } else if (caution.includes(t)) {
      up('caution');
      tags.push(t);
      (limits.cautionBy[t] ?? []).forEach((k) => because.add(k));
    }
  }
  let cap = 1;
  for (const m of rich?.primaryMuscles ?? []) {
    const c = limits.effects.muscleCaps?.[m];
    if (c != null && c < cap) {
      cap = c;
      (limits.capBy[m] ?? []).forEach((k) => because.add(k));
    }
  }
  if (level === 'ok' && cap < 1) level = 'info';
  return { level, tags, because: [...because], cap };
}

/** Auto-builder filter: drops only 'avoid'. */
export const isAutoExcluded = (name: string, limits: Limits): boolean =>
  exerciseFlag(name, limits).level === 'avoid';

// ---------------------------------------------------------------------------
// Sharing (coach / LLM)
// ---------------------------------------------------------------------------

export type GeneralShare = 'off' | 'effects' | 'full';

export function resolveShare(c: ChronicCondition, general: GeneralShare): GeneralShare {
  return c.share === 'inherit' ? general : (c.share as Exclude<ConditionShare, 'inherit'>);
}

/** A de-identified line: no condition name, no note. Stable ids so the UI can localise them. */
export interface EffectLine {
  id:
    | 'avoid'
    | 'caution'
    | 'rpeMax'
    | 'noFailure'
    | 'noMaxEffort'
    | 'noBreathHold'
    | 'volumeScale'
    | 'stepScale'
    | 'noAutoIncrease'
    | 'cardioMax'
    | 'restScale'
    | 'muscleCap';
  tags?: RiskTag[];
  muscle?: MuscleGroup;
  value?: number | string;
}

export function effectLines(e: ConditionEffects): EffectLine[] {
  const out: EffectLine[] = [];
  if (e.avoid?.length) out.push({ id: 'avoid', tags: e.avoid });
  if (e.caution?.length) out.push({ id: 'caution', tags: e.caution });
  for (const [m, v] of Object.entries(e.muscleCaps ?? {}) as [MuscleGroup, number][])
    out.push({ id: 'muscleCap', muscle: m, value: Math.round(v * 100) });
  if (e.rpeMax != null) out.push({ id: 'rpeMax', value: e.rpeMax });
  if (e.volumeScale != null)
    out.push({ id: 'volumeScale', value: Math.round(e.volumeScale * 100) });
  if (e.stepScale != null) out.push({ id: 'stepScale', value: Math.round(e.stepScale * 100) });
  if (e.cardioMax) out.push({ id: 'cardioMax', value: e.cardioMax as CardioCap });
  if (e.restScale != null && e.restScale > 1)
    out.push({ id: 'restScale', value: Math.round(e.restScale * 100) });
  if (e.noFailure) out.push({ id: 'noFailure' });
  if (e.noMaxEffort) out.push({ id: 'noMaxEffort' });
  if (e.noBreathHold) out.push({ id: 'noBreathHold' });
  if (e.noAutoIncrease) out.push({ id: 'noAutoIncrease' });
  return out;
}

export interface CoachConditionView {
  /** Only with Full: catalogue key (the coach UI localises the name). */
  key?: string;
  severity?: 1 | 2 | 3;
  effects: EffectLine[];
}

export interface CoachView {
  /** Conditions shared as Full (name + severity + effects). Notes are never included. */
  full: CoachConditionView[];
  /** Merged de-identified effects of everything shared as Effects-only. */
  effects: EffectLine[];
}

/**
 * What a coach may see. Off → nothing. Effects → merged, nameless lines. Full → key +
 * severity + its own effects. The note field never leaves.
 */
export function coachView(
  conditions: readonly ChronicCondition[],
  general: GeneralShare,
  now: number = Date.now(),
): CoachView {
  const full: CoachConditionView[] = [];
  let merged: ConditionEffects = {};
  let any = false;
  for (const c of conditions) {
    if (!isActive(c, now)) continue;
    const cat = catalogCondition(effectiveKey(c, now));
    if (!cat) continue;
    const mode = resolveShare(c, general);
    if (mode === 'off') continue;
    const e = effectsAt(cat.effects, c.severity);
    if (mode === 'full') full.push({ key: cat.key, severity: c.severity, effects: effectLines(e) });
    else {
      merged = mergeEffects(merged, e);
      any = true;
    }
  }
  return { full, effects: any ? effectLines(merged) : [] };
}

/** For Atlas/LLM: always de-identified, regardless of per-condition mode, unless everything is Off. */
export function deidentifiedEffects(
  conditions: readonly ChronicCondition[],
  general: GeneralShare = 'effects',
): EffectLine[] {
  let merged: ConditionEffects = {};
  let any = false;
  for (const c of conditions) {
    const cat = catalogCondition(c.key);
    if (!cat) continue;
    if (resolveShare(c, general) === 'off') continue;
    merged = mergeEffects(merged, effectsAt(cat.effects, c.severity));
    any = true;
  }
  return any ? effectLines(merged) : [];
}
