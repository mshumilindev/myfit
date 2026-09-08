/**
 * Mastery (F5) — ONE 0–1000 rating for *how well you train*, folded into a
 * ladder of nine ranks × three sublevels.
 *
 * This is deliberately NOT an achievements / points system. You do not "earn"
 * points for a 180 kg lift or a 10-day streak. Mastery is a live *measurement*
 * of professional level, read from the whole of what the app sees:
 *   - Strength relative to you (bodyweight-normalised standards)
 *   - Consistency of showing up (regularity, unbroken weeks)
 *   - Experience (a slow floor; optional self-reported "training since")
 *   - Practice & programming — how deliberately you build and run sessions
 *     (nine data-driven signals: coverage, progression, volume, warm-up,
 *      cooldown, rest, recovery, cardio, structure)
 * The number reflects the whole picture and moves as your training does.
 * Everything is derived from data already logged — nothing new is stored.
 */
import type { Workout, Exercise } from './types';
import type { MuscleGroup } from './data/exercises';
import {
  consistencyStreak,
  latestWeight,
  muscleSetsInWorkout,
  setTypeOf,
  isStrengthExercise,
  restBeforeSetInWorkout,
  type StoreState,
} from './store';
import { computeStandards, LEVELS, type Sex } from './standards';
import { topHistory, nextTarget } from './progression';

// --- Ranks -----------------------------------------------------------------
export type MasteryRankId =
  | 'foundation'
  | 'novice'
  | 'developing'
  | 'intermediate'
  | 'proficient'
  | 'advanced'
  | 'competitive'
  | 'elite'
  | 'worldclass';

export interface MasteryRank {
  id: MasteryRankId;
  threshold: number;
}

/** Nine athletic ranks on the 0–1000 scale (thresholds = the rank's floor). */
export const MASTERY_RANKS: MasteryRank[] = [
  { id: 'foundation', threshold: 0 },
  { id: 'novice', threshold: 120 },
  { id: 'developing', threshold: 240 },
  { id: 'intermediate', threshold: 380 },
  { id: 'proficient', threshold: 520 },
  { id: 'advanced', threshold: 660 },
  { id: 'competitive', threshold: 790 },
  { id: 'elite', threshold: 900 },
  { id: 'worldclass', threshold: 970 },
];
const RATING_MAX = 1000;

/** Roughly how continuous the training history is (general, not precise). */
export type TrainingPattern = 'continuous' | 'occasional' | 'frequent';
/** Continuity multiplier applied to *self-reported* tenure only. */
export const PATTERN_FACTOR: Record<TrainingPattern, number> = {
  continuous: 1,
  occasional: 0.7, // a few months on, a month or so off
  frequent: 0.5, // long or frequent breaks (e.g. 6 months on, 3 off)
};

/** Optional self-reported experience inputs (Experience axis only). */
export interface MasteryOpts {
  trainingSinceYear?: number | null;
  trainingPattern?: TrainingPattern | null;
}

export type AxisKey = 'strength' | 'consistency' | 'experience' | 'practice';
export const AXIS_WEIGHT: Record<AxisKey, number> = {
  strength: 0.3,
  consistency: 0.25,
  experience: 0.15,
  practice: 0.3,
};

export type SignalStatus = 'good' | 'watch' | 'low';
export type ImpactLevel = 'high' | 'med' | 'low';

export interface AxisScore {
  key: AxisKey;
  /** 0–100. */
  score: number;
  /** Structured facts for the view to localise into a readout. */
  facts: Record<string, number | string | string[] | boolean | null>;
}

export interface PracticeSignal {
  key:
    | 'coverage'
    | 'progression'
    | 'volume'
    | 'warmup'
    | 'cooldown'
    | 'rest'
    | 'recovery'
    | 'cardio'
    | 'structure';
  score: number; // 0–100
  status: SignalStatus;
  facts: Record<string, number | string | string[] | boolean | null>;
}

export interface Shortfall {
  key: string;
  axis: AxisKey;
  signal?: PracticeSignal['key'];
  impact: ImpactLevel;
  /** Structured facts for the view to localise. */
  facts: Record<string, number | string | string[] | boolean | null>;
}

export interface MasteryResult {
  /** Provisional while the app has too little data to be honest. */
  calibrating: boolean;
  confidence: 'low' | 'med' | 'high';
  /** 0–1 for the confidence meter. */
  confidenceFrac: number;
  sessions: number;
  sessionsToFirm: number;

  /** 0–1000. Provisional (but computed) while calibrating. */
  rating: number;
  rank: MasteryRank;
  rankIndex: number;
  /** 1 | 2 | 3 → I | II | III. */
  sublevel: number;
  /** 0–1 progress within the current rank (ring fill). */
  rankProgress: number;
  nextRank: MasteryRank | null;
  toNextSublevel: number;
  toNextRank: number | null;

  axes: Record<AxisKey, AxisScore>;
  practice: PracticeSignal[];
  shortfalls: Shortfall[];
}

// --- small helpers ---------------------------------------------------------
const DAY = 86400000;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const pct = (x: number) => Math.round(clamp01(x) * 100);
const statusOf = (score: number): SignalStatus =>
  score >= 67 ? 'good' : score >= 34 ? 'watch' : 'low';

const MAJOR_GROUPS: MuscleGroup[] = [
  'chest',
  'back',
  'quads',
  'hamstrings',
  'glutes',
  'shoulders',
  'biceps',
  'triceps',
  'core',
  'calves',
];
const PUSH: MuscleGroup[] = ['chest', 'shoulders', 'triceps'];
const PULL: MuscleGroup[] = ['back', 'biceps'];
const LEGS: MuscleGroup[] = ['quads', 'hamstrings', 'glutes', 'calves'];

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

// --- axis: strength --------------------------------------------------------
function strengthAxis(finished: Workout[], bodyKg: number, sex: Sex | null): AxisScore {
  if (!sex || bodyKg <= 0) {
    return { key: 'strength', score: 0, facts: { known: false } };
  }
  const { results } = computeStandards(finished, bodyKg, sex);
  // Use the strength-LEVEL disciplines (beg→eli), which cover many lifts.
  const level = results.filter((r) => r.system === 'level' && r.trained);
  if (level.length === 0) return { key: 'strength', score: 0, facts: { known: true, trained: 0 } };
  const per = level.map((r) => {
    const steps = r.tierIds.length; // 5 levels
    const frac = (Math.max(0, r.achievedIdx) + (r.achievedIdx >= 0 ? r.progress : 0)) / steps;
    return clamp01(frac);
  });
  const score = pct(sum(per) / per.length);
  // Top lift label for the readout.
  const top = [...level].sort((a, b) => b.achievedIdx - a.achievedIdx)[0];
  return {
    key: 'strength',
    score,
    facts: {
      known: true,
      trained: level.length,
      topLift: top?.name ?? '',
      topLevel: top ? LEVELS[Math.max(0, top.achievedIdx)] : '',
    },
  };
}

// --- axis: consistency -----------------------------------------------------
function consistencyAxis(finished: Workout[], now: number): AxisScore {
  const windowStart = now - 56 * DAY; // 8 weeks
  const recent = finished.filter((w) => (w.finishedAt ?? 0) >= windowStart);
  const perWeek = recent.length / 8;
  // Active weeks: distinct ISO-ish weeks with ≥1 session, out of 8.
  const weeks = new Set<number>();
  for (const w of recent) weeks.add(Math.floor(((w.finishedAt ?? 0) - windowStart) / (7 * DAY)));
  const activeWeeks = weeks.size;
  const streak = consistencyStreak(now);

  // Regularity, not volume: reward a steady ~3–5 sessions/wk and unbroken weeks.
  const rateScore = clamp01(perWeek / 4); // 4/wk saturates
  const weeksScore = clamp01(activeWeeks / 8);
  const streakScore = clamp01(streak / 42); // ~6 weeks unbroken saturates
  const score = pct(0.5 * rateScore + 0.3 * weeksScore + 0.2 * streakScore);
  return {
    key: 'consistency',
    score,
    facts: {
      perWeek: Math.round(perWeek * 10) / 10,
      activeWeeks,
      streakDays: streak,
    },
  };
}

// --- axis: experience ------------------------------------------------------
function experienceAxis(
  finished: Workout[],
  now: number,
  trainingSinceYear: number | null,
  trainingPattern: TrainingPattern | null,
): AxisScore {
  const nowYear = new Date(now).getFullYear();
  let rawYears: number;
  let selfReported = false;
  if (trainingSinceYear && trainingSinceYear > 1950 && trainingSinceYear <= nowYear) {
    rawYears = nowYear - trainingSinceYear;
    selfReported = true;
  } else {
    const first = finished.reduce((min, w) => Math.min(min, w.startedAt ?? Infinity), Infinity);
    rawYears = Number.isFinite(first) ? (now - first) / (365 * DAY) : 0;
  }
  // A break-riddled history counts for less — general, not exact. The pattern
  // discounts self-reported tenure only; app-measured history is real sessions,
  // so its continuity is already implicit.
  const pattern: TrainingPattern = trainingPattern ?? 'continuous';
  const factor = selfReported ? PATTERN_FACTOR[pattern] : 1;
  const years = rawYears * factor;
  const score = pct(years / 10); // 10 effective years saturates; a slow floor
  return {
    key: 'experience',
    score,
    facts: {
      years: Math.round(years * 10) / 10,
      rawYears: Math.round(rawYears * 10) / 10,
      selfReported,
      pattern: selfReported ? pattern : null,
    },
  };
}

// --- practice signals ------------------------------------------------------
function practiceSignals(finished: Workout[], now: number): PracticeSignal[] {
  const windowStart = now - 56 * DAY;
  const recent = finished.filter((w) => (w.finishedAt ?? 0) >= windowStart);
  const weeks = 8;

  // Weekly sets per muscle (from the working sets logged in the window).
  const setsPerMuscle = new Map<MuscleGroup, number>();
  for (const w of recent) {
    for (const [m, n] of muscleSetsInWorkout(w)) {
      setsPerMuscle.set(m, (setsPerMuscle.get(m) ?? 0) + n);
    }
  }
  const weekly = (m: MuscleGroup) => (setsPerMuscle.get(m) ?? 0) / weeks;

  // 1 · coverage & balance
  const trainedMajors = MAJOR_GROUPS.filter((m) => (setsPerMuscle.get(m) ?? 0) > 0);
  const skipped = MAJOR_GROUPS.filter((m) => (setsPerMuscle.get(m) ?? 0) === 0);
  const push = sum(PUSH.map(weekly));
  const pull = sum(PULL.map(weekly));
  const legs = sum(LEGS.map(weekly));
  const balTotal = push + pull + legs || 1;
  // Balance penalty: how far the push/pull/legs split is from an even third.
  const balSpread =
    (Math.abs(push / balTotal - 1 / 3) +
      Math.abs(pull / balTotal - 1 / 3) +
      Math.abs(legs / balTotal - 1 / 3)) /
    (4 / 3);
  const coverageScore = pct(
    0.7 * (trainedMajors.length / MAJOR_GROUPS.length) + 0.3 * (1 - clamp01(balSpread)),
  );

  // 2 · load progression (top trained lifts trending up)
  const liftCounts = new Map<string, number>();
  for (const w of recent)
    for (const ex of w.exercises)
      if (isStrengthExercise(ex) && ex.sets.length > 0)
        liftCounts.set(ex.name, (liftCounts.get(ex.name) ?? 0) + 1);
  const topLifts = [...liftCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map((e) => e[0]);
  let climbing = 0;
  let flat = 0;
  const flatNames: string[] = [];
  const climbNames: string[] = [];
  for (const name of topLifts) {
    const hist = topHistory(finished, name);
    if (hist.length < 2) continue;
    const t = nextTarget(hist);
    if (t.state === 'progress' || t.state === 'first') {
      climbing++;
      climbNames.push(name);
    } else if (t.state === 'stall' || t.state === 'hold') {
      flat++;
      flatNames.push(name);
    }
  }
  const progDenom = climbing + flat || 1;
  const progressionScore = pct(climbing / progDenom);

  // 3 · volume in range (MEV–MRV, generic landmarks)
  const MEV = 6;
  const MRV = 22;
  const trained = [...setsPerMuscle.keys()].filter((m) => MAJOR_GROUPS.includes(m));
  const belowMEV = trained.filter((m) => weekly(m) > 0 && weekly(m) < MEV);
  const aboveMRV = trained.filter((m) => weekly(m) > MRV);
  const inRange = trained.filter((m) => weekly(m) >= MEV && weekly(m) <= MRV);
  const volumeScore = trained.length ? pct(inRange.length / trained.length) : 0;

  // 4 · warm-up sets before working strength lifts
  let workingEx = 0;
  let warmedEx = 0;
  for (const w of recent) {
    for (const ex of w.exercises) {
      if (!isStrengthExercise(ex)) continue;
      const hasWorking = ex.sets.some((s) => setTypeOf(s) === 'working');
      if (!hasWorking) continue;
      workingEx++;
      if (ex.sets.some((s) => setTypeOf(s) === 'warmup')) warmedEx++;
    }
  }
  const warmupScore = workingEx ? pct(warmedEx / workingEx) : 0;

  // 5 · cooldown & mobility (cooldown-kind exercises logged)
  let sessionsWithCooldown = 0;
  for (const w of recent)
    if (w.exercises.some((ex) => ex.kind === 'cooldown')) sessionsWithCooldown++;
  const cooldownScore = recent.length ? pct(sessionsWithCooldown / recent.length) : 0;

  // 6 · rest between sets (well-paced = 45–240s between consecutive sets)
  let restPairs = 0;
  let restOk = 0;
  let restShort = 0;
  for (const w of recent) {
    for (const ex of w.exercises) {
      const sets = [...ex.sets].sort((a, b) => a.position - b.position);
      for (const s of sets) {
        const r = restBeforeSetInWorkout(w, s);
        if (r == null) continue;
        restPairs++;
        if (r >= 45 && r <= 240) restOk++;
        else if (r < 45) restShort++;
      }
    }
  }
  const restScore = restPairs ? pct(restOk / restPairs) : 50;

  // 7 · recovery & rest days (sane weekly cadence, not chronically overreached)
  const perWeek = recent.length / weeks;
  // Ideal ~3–5 sessions/wk; penalise 7/7 grind and near-zero alike.
  const cadence =
    perWeek <= 0 ? 0 : perWeek <= 5 ? clamp01(perWeek / 3) : clamp01(1 - (perWeek - 5) / 3);
  const recoveryScore = pct(cadence);

  // 8 · cardio & conditioning (any conditioning logged in the window)
  // Activities aren't muscle sets — count cardio-kind exercises + rough target.
  let cardioSessions = 0;
  for (const w of recent) if (w.exercises.some((ex) => ex.kind === 'cardio')) cardioSessions++;
  const cardioScore = pct(cardioSessions / (weeks * 0.5)); // ~0.5/wk saturates

  // 9 · session structure (compounds first, sane working-set counts)
  let structGood = 0;
  let structTotal = 0;
  for (const w of recent) {
    const exs = w.exercises.filter((e) => isStrengthExercise(e) && e.sets.length > 0);
    if (exs.length === 0) continue;
    structTotal++;
    const firstCompound = isCompound(exs[0]);
    const saneCounts = exs.every((e) => {
      const working = e.sets.filter((s) => setTypeOf(s) === 'working').length;
      return working >= 1 && working <= 6;
    });
    if (firstCompound && saneCounts) structGood++;
    else if (firstCompound || saneCounts) structGood += 0.5;
  }
  const structureScore = structTotal ? pct(structGood / structTotal) : 0;

  const mk = (
    key: PracticeSignal['key'],
    score: number,
    facts: PracticeSignal['facts'],
  ): PracticeSignal => ({ key, score, status: statusOf(score), facts });

  return [
    mk('coverage', coverageScore, {
      skipped: skipped as string[],
      pushShare: Math.round((push / balTotal) * 100),
      pullShare: Math.round((pull / balTotal) * 100),
      legShare: Math.round((legs / balTotal) * 100),
    }),
    mk('progression', progressionScore, { climbing: climbNames, flat: flatNames }),
    mk('volume', volumeScore, {
      belowMEV: belowMEV as string[],
      aboveMRV: aboveMRV as string[],
      inRange: inRange.length,
    }),
    mk('warmup', warmupScore, { pctWarmed: warmupScore }),
    mk('cooldown', cooldownScore, { sessions: sessionsWithCooldown }),
    mk('rest', restScore, { pctOk: restScore, shortish: restShort }),
    mk('recovery', recoveryScore, { perWeek: Math.round(perWeek * 10) / 10 }),
    mk('cardio', cardioScore, { sessions: cardioSessions }),
    mk('structure', structureScore, { pctGood: structureScore }),
  ];
}

function isCompound(ex: Exercise): boolean {
  const secondaries = ex.secondaryMuscles?.length ?? 0;
  return secondaries >= 2;
}

// --- rank / sublevel from a rating -----------------------------------------
function rankFor(rating: number): {
  rank: MasteryRank;
  index: number;
  next: MasteryRank | null;
  sublevel: number;
  rankProgress: number;
  toNextSublevel: number;
  toNextRank: number | null;
} {
  let index = 0;
  for (let i = 0; i < MASTERY_RANKS.length; i++)
    if (rating >= MASTERY_RANKS[i].threshold) index = i;
  const rank = MASTERY_RANKS[index];
  const next = MASTERY_RANKS[index + 1] ?? null;
  const top = next ? next.threshold : RATING_MAX;
  const span = Math.max(1, top - rank.threshold);
  const within = clamp01((rating - rank.threshold) / span);
  const sublevel = Math.min(3, Math.floor(within * 3) + 1);
  const subBoundary = rank.threshold + (sublevel / 3) * span;
  return {
    rank,
    index,
    next,
    sublevel,
    rankProgress: within,
    toNextSublevel: Math.max(0, Math.round(subBoundary - rating)),
    toNextRank: next ? Math.max(0, Math.round(next.threshold - rating)) : null,
  };
}

// --- shortfalls (ordered by impact = axis/signal weight × gap) --------------
function buildShortfalls(
  axes: Record<AxisKey, AxisScore>,
  practice: PracticeSignal[],
): Shortfall[] {
  const items: (Shortfall & { weightGap: number })[] = [];
  // Practice signals dominate the actionable list (that's where "how you train"
  // lives). Each signal weighted by practice axis share / 9.
  for (const s of practice) {
    if (s.status === 'good') continue;
    const gap = (100 - s.score) / 100;
    items.push({
      key: `sig-${s.key}`,
      axis: 'practice',
      signal: s.key,
      impact: 'low',
      facts: s.facts,
      weightGap: gap * (s.status === 'watch' ? 1.1 : 1.4),
    });
  }
  // Consistency & strength as axis-level shortfalls when weak.
  for (const key of ['consistency', 'strength', 'experience'] as AxisKey[]) {
    const a = axes[key];
    if (a.score >= 70) continue;
    const gap = (100 - a.score) / 100;
    items.push({
      key: `axis-${key}`,
      axis: key,
      impact: 'low',
      facts: a.facts,
      weightGap: gap * AXIS_WEIGHT[key] * 3,
    });
  }
  items.sort((a, b) => b.weightGap - a.weightGap);
  const top = items.slice(0, 6);
  // Assign impact bands from rank in the sorted list.
  return top.map((it, i) => ({
    key: it.key,
    axis: it.axis,
    signal: it.signal,
    impact: i < 2 ? 'high' : i < 4 ? 'med' : 'low',
    facts: it.facts,
  }));
}

/**
 * Compute the full Mastery read from the store. Pure — no side effects.
 * `opts` carries optional self-reported Experience inputs (start year + pattern).
 */
export function computeMastery(
  state: Pick<StoreState, 'workouts' | 'bodyMetrics'>,
  now: number = Date.now(),
  opts: MasteryOpts = {},
): MasteryResult {
  const finished = state.workouts
    .filter((w) => w.finishedAt !== null)
    .sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0));
  const sessions = finished.length;

  const bm = state.bodyMetrics;
  const bodyKg = latestWeight(bm)?.weight ?? 0;
  const sex: Sex | null = bm?.sex === 'female' ? 'F' : bm?.sex === 'male' ? 'M' : null;

  const strength = strengthAxis(finished, bodyKg, sex);
  const consistency = consistencyAxis(finished, now);
  const experience = experienceAxis(
    finished,
    now,
    opts.trainingSinceYear ?? null,
    opts.trainingPattern ?? null,
  );
  const signals = practiceSignals(finished, now);
  const practiceScore = signals.length
    ? Math.round(sum(signals.map((s) => s.score)) / signals.length)
    : 0;
  const practice: AxisScore = {
    key: 'practice',
    score: practiceScore,
    facts: {
      low: signals.filter((s) => s.status === 'low').map((s) => s.key),
      good: signals.filter((s) => s.status === 'good').length,
    },
  };

  const axes: Record<AxisKey, AxisScore> = { strength, consistency, experience, practice };
  const rating = Math.round(
    (AXIS_WEIGHT.strength * strength.score +
      AXIS_WEIGHT.consistency * consistency.score +
      AXIS_WEIGHT.experience * experience.score +
      AXIS_WEIGHT.practice * practice.score) *
      10,
  );

  const r = rankFor(rating);

  // Calibration: too little data to be honest yet.
  const calibrating = sessions < 8 || (!sex && sessions < 16);
  const confidence: MasteryResult['confidence'] =
    sessions >= 16 ? 'high' : sessions >= 8 ? 'med' : 'low';
  const confidenceFrac = clamp01(sessions / 16);
  const sessionsToFirm = Math.max(0, 16 - sessions);

  return {
    calibrating,
    confidence,
    confidenceFrac,
    sessions,
    sessionsToFirm,
    rating,
    rank: r.rank,
    rankIndex: r.index,
    sublevel: r.sublevel,
    rankProgress: r.rankProgress,
    nextRank: r.next,
    toNextSublevel: r.toNextSublevel,
    toNextRank: r.toNextRank,
    axes,
    practice: signals,
    shortfalls: buildShortfalls(axes, signals),
  };
}

/** The rank ladder index for a given rating (0-based). */
export function rankIndexForRating(rating: number): number {
  let index = 0;
  for (let i = 0; i < MASTERY_RANKS.length; i++)
    if (rating >= MASTERY_RANKS[i].threshold) index = i;
  return index;
}

/** Roman numeral for a sublevel 1..3. */
export function sublevelRoman(n: number): string {
  return n === 3 ? 'III' : n === 2 ? 'II' : 'I';
}
