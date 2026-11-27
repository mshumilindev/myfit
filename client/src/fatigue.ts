/**
 * Fatigue model (design FAT-1..W): accumulated fatigue per fine muscle, from
 * signals we already track -- how hard the weekly volume is pushing against the
 * muscle's recoverable max (MRV), plus whether a lift for it has stalled. Turns
 * the vague "try a deload" into a per-muscle read and a targeted suggestion.
 * Pure over the finished-workout history.
 */
import { LANDMARKS, VOLUME_MUSCLES, type Landmark } from './volume';
import { topHistory } from './progression';
import { resolveMuscles, isStrengthExercise } from './store';
import type { Workout } from './types';
import { fatigueSetCount } from './stimulus';
import { deloadMult, readinessMult } from './calcMods';
import { computeReadinessWith, RECOVERY_DAYS } from './recoveryMath';
import type { MuscleGroup } from './data/exercises';
import { blockMuscleLoad } from './blockLoad';

const DAY = 24 * 3600 * 1000;

/**
 * Fatigue weights stabilizer (secondary) work LESS than the volume read does.
 * The MRV landmarks are calibrated for DIRECT training volume, but a muscle
 * like the lower back is loaded as a synergist on nearly every squat, hinge and
 * row. Counting that stabilizer work at the volume model's 0.5/set (against a
 * low MRV) makes it read "fried" after a normal leg day, which isn't real
 * systemic fatigue. So for the fatigue read a secondary set counts at a third,
 * and — the firm rule — a muscle worked ONLY as a stabilizer this week (no
 * direct sets) can never read "fried".
 */
const FATIGUE_SECONDARY_WEIGHT = 1 / 3;
/** Ceiling on fatigue score for a muscle with no direct (primary) sets. */
const NO_DIRECT_CEILING = 0.5;

interface WeekSplit {
  primary: number;
  secondary: number;
  /** Equivalent sets from logged Time blocks (SPO-608): load for the fatigue score, never direct work. */
  cond: number;
}

/** Trailing-week sets per muscle, split into direct (primary) vs stabilizer
 *  (secondary) so the fatigue read can weight them differently. */
function weeklyFatigueSplit(
  finished: Workout[],
  now: number,
  days = 7,
): Map<MuscleGroup, WeekSplit> {
  const since = now - days * DAY;
  const out = new Map<MuscleGroup, WeekSplit>();
  const add = (m: MuscleGroup, key: keyof WeekSplit, v: number): void => {
    const cur = out.get(m) ?? { primary: 0, secondary: 0, cond: 0 };
    cur[key] += v;
    out.set(m, cur);
  };
  for (const w of finished) {
    if (w.startedAt < since) continue;
    for (const e of w.exercises) {
      if (!isStrengthExercise(e)) continue;
      if (e.sets.length === 0) continue;
      // Warm-ups count, but only as much as they actually loaded the muscle.
      const n = fatigueSetCount(e.sets);
      const { primary, secondary } = resolveMuscles(e);
      if (primary) add(primary, 'primary', n);
      for (const s of secondary) if (s !== primary) add(s, 'secondary', n);
    }
    // Logged blocks load the muscles too, but are not direct work: they raise the load term only (the stall bump and the
    // "no direct sets can't be fried" ceiling keep reading strength sets).
    for (const [m, l] of blockMuscleLoad(w))
      add(m, 'cond', l.primary + l.secondary * FATIGUE_SECONDARY_WEIGHT);
  }
  return out;
}

/**
 * Acute fatigue (SPO-601, docs/specs/fatigue-acute-recency.md): a muscle trained
 * moments ago is tired even when the week's volume is far from its MRV. It reads
 * the same SRA clock as Readiness (recoveryMath). The ceiling grows with the dose:
 * a light session reads at most "moderate" (LIGHT), a real one (about half the
 * muscle's MAV, a "normal" session) reaches "high" for the first hours (FULL).
 * Both stay below "fried" (0.7 * deloadMult >= 0.59). The weekly level is kept
 * separately (`weeklyLevel`), so the deload nudge never reads the acute term.
 * The caps, the dose ramp and ACUTE_MIN_SETS are assumptions without a source.
 */
export const ACUTE_CAP_LIGHT = 0.3;
export const ACUTE_CAP_FULL = 0.5;
export const ACUTE_MIN_SETS = 3;
/** Dose (as a share of the muscle's MAV) where the ceiling starts rising / is full. */
const ACUTE_RAMP_FROM = 0.3;
const ACUTE_RAMP_TO = 0.5;
/** Sets only count inside the 7-day fatigue window (`sets <= 0` zeroes the score below), so look back that far. */
const ACUTE_LOOKBACK_DAYS = 7;

/** Ceiling of the acute score for a session of `dose` sets on a muscle with this MAV. */
export function acuteCap(dose: number, mav: number): number {
  const share = dose / (mav || 12);
  const t = clamp((share - ACUTE_RAMP_FROM) / (ACUTE_RAMP_TO - ACUTE_RAMP_FROM), 0, 1);
  return ACUTE_CAP_LIGHT + (ACUTE_CAP_FULL - ACUTE_CAP_LIGHT) * t;
}

/** Acute score from the last DIRECT session of a muscle: 0..acuteCap, fading to 0 with recovery. */
export function acuteFatigueScore(
  daysSince: number | null,
  dose: number,
  base: number,
  mav: number,
  at?: number,
): number {
  if (daysSince === null || dose < ACUTE_MIN_SETS) return 0;
  const { readiness } = computeReadinessWith(readinessMult(at), daysSince, dose, base, mav);
  return acuteCap(dose, mav) * (1 - readiness);
}

/** Most recent session with direct (primary) sets per muscle: days ago + dose. */
function lastDirectSessions(
  finished: Workout[],
  now: number,
): Map<MuscleGroup, { days: number; dose: number }> {
  const since = now - ACUTE_LOOKBACK_DAYS * DAY;
  const recent = finished
    .filter((w) => w.startedAt >= since && w.startedAt <= now)
    .sort((a, b) => b.startedAt - a.startedAt);
  const out = new Map<MuscleGroup, { days: number; dose: number }>();
  const doses = new Map<MuscleGroup, number>();
  for (const w of recent) {
    doses.clear();
    for (const e of w.exercises) {
      if (!isStrengthExercise(e) || e.sets.length === 0) continue;
      const { primary } = resolveMuscles(e);
      if (primary) doses.set(primary, (doses.get(primary) ?? 0) + fatigueSetCount(e.sets));
    }
    // A logged block adds to the dose of the SAME session (one dose per session, not two).
    for (const [m, l] of blockMuscleLoad(w)) doses.set(m, (doses.get(m) ?? 0) + l.primary);
    for (const [m, dose] of doses) {
      // The latest session that passes the minimum: a couple of warm-up sets today
      // must not hide yesterday's real work.
      if (dose >= ACUTE_MIN_SETS && !out.has(m))
        out.set(m, { days: (now - w.startedAt) / DAY, dose });
    }
  }
  return out;
}

export type FatigueLevel = 'fresh' | 'moderate' | 'high' | 'fried';

export interface MuscleFatigue {
  muscle: MuscleGroup;
  score: number; // 0..1
  level: FatigueLevel;
  /** The level from the week's volume alone (no acute term): what the deload nudge reads. */
  weeklyLevel?: FatigueLevel;
  /** Days since the session that sets the level, only when the acute term outweighs the week. */
  acuteDays?: number;
  sets: number;
  mrv: number;
  stalled: boolean;
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

function levelOf(score: number): FatigueLevel {
  // Nicotine lowers the levels that trigger a lighter week ('high' and 'fried') by the
  // midpoint of its range (x1 when off). 'moderate' and 'fresh' are left alone.
  const k = deloadMult();
  if (score >= 0.7 * k) return 'fried';
  if (score >= 0.4 * k) return 'high';
  if (score >= 0.15) return 'moderate';
  return 'fresh';
}

/** Top weight flat (no new high) across the last 3+ loaded sessions. */
function flatTop(history: { weight: number | null; reps: number }[]): boolean {
  const loaded = history.filter((p) => (p.weight ?? 0) > 0);
  if (loaded.length < 3) return false;
  const recent = loaded.slice(0, 3);
  const w = recent[0].weight ?? 0;
  return recent.every((p) => (p.weight ?? 0) <= w) && (recent[2].weight ?? 0) === w;
}

/** Muscles whose main lift has stalled recently (trained in the last ~5 weeks). */
export function stalledMuscles(finished: Workout[], now: number): Set<MuscleGroup> {
  const since = now - 35 * DAY;
  const names = new Map<string, MuscleGroup>();
  for (const w of finished) {
    if (w.startedAt < since) continue;
    for (const e of w.exercises) {
      if (!isStrengthExercise(e)) continue;
      const p = resolveMuscles(e).primary;
      if (p && p !== 'cardio') names.set(e.name.trim(), p);
    }
  }
  const out = new Set<MuscleGroup>();
  for (const [name, m] of names) if (flatTop(topHistory(finished, name))) out.add(m);
  return out;
}

/**
 * Per-muscle fatigue. Volume component ramps as the trailing-week sets climb
 * from ~70% of MRV up past it; a stalled main lift adds a fixed bump (only for a
 * muscle with direct sets in the window, SPO-352). A muscle
 * with little volume and no stall reads fresh.
 */
export function muscleFatigue(
  finished: Workout[],
  now: number,
  landmarks?: ReadonlyMap<MuscleGroup, Landmark>,
  /** `acute: false` = the pure weekly-load read, for consumers that scale a formula by
   *  weekly fatigue (RPE cut, rest timer, Today load index). Default on (tiles, maps). */
  opts: { acute?: boolean } = {},
): Map<MuscleGroup, MuscleFatigue> {
  const split = weeklyFatigueSplit(finished, now);
  const stalled = stalledMuscles(finished, now);
  const lastDirect = opts.acute === false ? new Map() : lastDirectSessions(finished, now);
  const out = new Map<MuscleGroup, MuscleFatigue>();
  for (const m of VOLUME_MUSCLES) {
    // Personalised ceiling when available (so a tolerant athlete reads less
    // fatigued at the same volume, and a deload holds off) — else the default.
    const lm = landmarks?.get(m) ?? (LANDMARKS[m] as Landmark);
    const wk = split.get(m) ?? { primary: 0, secondary: 0, cond: 0 };
    // Display set count stays consistent with the volume read (secondary 0.5);
    // the fatigue SCORE weights stabilizer work less (secondary 1/3).
    const sets = wk.primary + wk.secondary * 0.5;
    const fatSets = wk.primary + wk.secondary * FATIGUE_SECONDARY_WEIGHT + wk.cond;
    const volComp = clamp((fatSets / lm.mrv - 0.7) / 0.45, 0, 1);
    const isSt = stalled.has(m);
    let score = clamp(volComp * 0.75 + (isSt && wk.primary > 0 ? 0.4 : 0), 0, 1);
    // A muscle only stabilized this week (no direct sets) can't read "fried" —
    // stabilizer load and a stale lift alone don't warrant a deload here.
    if (wk.primary <= 0) score = Math.min(score, NO_DIRECT_CEILING);
    // Acute term: trained recently (direct sets) -> at least a hint of fatigue.
    // Taken as a max, never added, so the weekly read is unchanged when higher.
    const ld = lastDirect.get(m);
    const acute = ld ? acuteFatigueScore(ld.days, ld.dose, RECOVERY_DAYS[m] ?? 2, lm.mav, now) : 0;
    const weeklyScore = score;
    score = Math.max(score, acute);
    // SPO-352: fatigue is accumulated LOAD. The stall bump (0.4) used to land
    // exactly on the 'high' threshold on its own, flagging a rested muscle
    // ("High, 0 of 16 sets this week"). Now the bump needs direct sets in the
    // window (above), and a muscle with no sets at all carries no load -> fresh.
    // The stall itself stays visible through `stalled`; it just isn't fatigue.
    const carriesLoad = sets + wk.cond > 0;
    const weeklyFinal = carriesLoad ? weeklyScore : 0;
    if (!carriesLoad) score = 0;
    const level = levelOf(score);
    const weeklyLevel = levelOf(weeklyFinal);
    out.set(m, {
      muscle: m,
      score,
      level,
      weeklyLevel,
      // Only when the acute term actually changes the level: otherwise the week's load is the reason.
      ...(ld && level !== weeklyLevel ? { acuteDays: ld.days } : {}),
      sets,
      mrv: lm.mrv,
      stalled: isSt,
    });
  }
  return out;
}

/** CSS colour per fatigue level: fresh (calm green) -> fried (ruby). */
export const FATIGUE_COLOR: Record<FatigueLevel, string> = {
  fresh: 'var(--color-ok)',
  moderate: 'var(--color-warn)',
  high: 'var(--color-warn-strong)',
  fried: 'var(--color-danger)',
};

export type DeloadKind = 'none' | 'local' | 'systemic';

export interface DeloadSuggestion {
  kind: DeloadKind;
  muscle: MuscleGroup | null;
  friedCount: number;
  highCount: number;
}

/** Read the fatigue map into a deload suggestion: one fried muscle -> a local
 *  cut; many hot muscles -> a systemic recovery week; otherwise nothing.
 *
 *  `recoveryBias` (design feature 6) lets logged activities feed the model:
 *  recovery-dominant weeks (>0) raise the systemic trigger so a deload holds
 *  off; conditioning piled on top of lifting (<0) lowers it a touch. */
export function deloadSuggestion(
  fat: Map<MuscleGroup, MuscleFatigue>,
  recoveryBias = 0,
): DeloadSuggestion {
  // The deload nudge reads the WEEK's load only: an acute level right after a session
  // (SPO-601) must not add up to a "recovery week" suggestion.
  const lv = (f: MuscleFatigue): FatigueLevel => f.weeklyLevel ?? f.level;
  const fried = [...fat.values()].filter((f) => lv(f) === 'fried');
  const high = [...fat.values()].filter((f) => lv(f) === 'high' || lv(f) === 'fried');
  const shift = Math.round(clamp(recoveryBias, -1, 1));
  const friedTrigger = 3 + shift;
  const highTrigger = 5 + shift;
  if (fried.length >= friedTrigger || high.length >= highTrigger) {
    return { kind: 'systemic', muscle: null, friedCount: fried.length, highCount: high.length };
  }
  if (fried.length >= 1) {
    const worst = fried.sort((a, b) => b.score - a.score)[0];
    return {
      kind: 'local',
      muscle: worst.muscle,
      friedCount: fried.length,
      highCount: high.length,
    };
  }
  return { kind: 'none', muscle: null, friedCount: 0, highCount: high.length };
}
