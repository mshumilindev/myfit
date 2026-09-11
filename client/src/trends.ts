/**
 * Trends / Analysis — curated, important insights from REAL history analysis.
 * The signal is measured across 30 / 90 / 180 / 365-day horizons so a card is
 * a genuine trend, not a this-week snapshot. Uses ACTUAL logged weights.
 *
 * Card shapes (grouped, three across):
 *   balance   — two labelled bars (push/pull, upper/lower)
 *   muscleList — muscle bar-list (least / most trained, 4-week)
 *   horizon   — one metric across 30/90/180/365d as stage bars (no duplicate cards)
 *   trend     — sparkline + hero + delta (a lift genuinely climbing)
 *   stat      — a milestone number (all-time heaviest)
 *   tip       — icon + headline + nudge (plateau, recovery, rest, neglect…)
 * Each card carries a level: risk (ruby) · info (sapphire) · good (emerald).
 */
import {
  isStrengthExercise,
  muscleSetsInWorkout,
  resolveMuscles,
  restBeforeSetInWorkout,
  setTopWeight,
  setTypeOf,
  workoutVolumeKg,
} from './store';
import type { BodyMetrics, Workout } from './types';
import type { MuscleGroup } from './data/exercises';
import { t as strings, getLocale, fmtWeekday } from './i18n';
import { localizedExerciseName } from './data/exerciseNames';

const DAY = 24 * 3600 * 1000;
const WEEK = 7 * DAY;

export type Level = 'risk' | 'warn' | 'info' | 'good';
export type InsightType = 'balance' | 'muscleList' | 'horizon' | 'trend' | 'stat' | 'tip';
export const TYPE_ORDER: InsightType[] = [
  'balance',
  'muscleList',
  'horizon',
  'trend',
  'stat',
  'tip',
];

export interface MuscleBar {
  label: string;
  frac: number;
  worst: boolean;
}

export interface HorizonBar {
  label: string;
  value: string;
  raw: number;
}

export interface Insight {
  key: string;
  type: InsightType;
  level: Level;
  severity: number;
  attention?: boolean;
  icon?: string;
  kicker?: string;
  headline?: string;
  detail: string;
  action?: string;
  actionHref?: string;
  // balance
  aLabel?: string;
  bLabel?: string;
  aVal?: number;
  bVal?: number;
  lowSide?: 'a' | 'b';
  // muscleList
  muscles?: MuscleBar[];
  // horizon (30/90/180/365 stage bars)
  bars?: HorizonBar[];
  // trend / stat
  spark?: number[];
  hero?: string;
  heroUnit?: string;
  deltaPct?: number | null;
}

export interface TrendsResult {
  ready: boolean;
  weeksTracked: number;
  insights: Insight[];
}

const PUSH: MuscleGroup[] = ['chest', 'shoulders', 'triceps'];
const PULL: MuscleGroup[] = ['back', 'lats', 'traps', 'lower_back', 'biceps', 'forearms'];
const UPPER: MuscleGroup[] = [
  'chest',
  'back',
  'lats',
  'traps',
  'lower_back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'neck',
];
const LOWER: MuscleGroup[] = ['quads', 'adductors', 'hamstrings', 'glutes', 'abductors', 'calves'];
const MAJOR: MuscleGroup[] = [
  'chest',
  'back',
  'lats',
  'traps',
  'lower_back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'adductors',
  'hamstrings',
  'glutes',
  'abductors',
  'calves',
  'core',
];

// Coarse training AREAS -- the finer groups roll up so the balance read matches
// how a lifter actually thinks ("Back", not "lats vs traps vs a near-empty
// generic back"). The legacy generic `back` rolls into Back so retagged/custom
// logs still count. This is the "generalize" half of the two-level muscle read.
interface Area {
  key: string;
  label: string;
  members: MuscleGroup[];
}
const AREAS: Area[] = [
  { key: 'chest', label: 'Chest', members: ['chest'] },
  { key: 'back', label: 'Back', members: ['back', 'lats', 'traps', 'lower_back'] },
  { key: 'shoulders', label: 'Shoulders', members: ['shoulders'] },
  { key: 'arms', label: 'Arms', members: ['biceps', 'triceps', 'forearms'] },
  {
    key: 'legs',
    label: 'Legs',
    members: ['quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'],
  },
  { key: 'core', label: 'Core', members: ['core'] },
];
// The "drill-down" half: notable sub-muscles people commonly skip inside an
// otherwise well-trained area -- the "lots of back but no lower back" nudge.
const AREA_GAPS: {
  area: string;
  member: MuscleGroup;
  hintKey: 'gapHintHinge' | 'gapHintLegCurl' | 'gapHintCalf';
}[] = [
  { area: 'back', member: 'lower_back', hintKey: 'gapHintHinge' },
  { area: 'legs', member: 'hamstrings', hintKey: 'gapHintLegCurl' },
  { area: 'legs', member: 'calves', hintKey: 'gapHintCalf' },
];

interface AreaSets {
  key: string;
  label: string;
  sets: number;
  members: Map<MuscleGroup, number>;
}
/** Roll a per-muscle set map up into the coarse areas above. */
function areaSetsFrom(perMuscle: Map<MuscleGroup, number>): AreaSets[] {
  return AREAS.map((a) => {
    const members = new Map<MuscleGroup, number>();
    let sets = 0;
    for (const m of a.members) {
      const n = perMuscle.get(m) ?? 0;
      if (n > 0) members.set(m, n);
      sets += n;
    }
    return { key: a.key, label: a.label, sets, members };
  });
}
const HZ_LABEL = ['30d', '90d', '180d', '1y'];

function weekStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}
function topWeight(ex: Workout['exercises'][number]): number {
  let w = 0;
  for (const s of ex.sets) {
    if (setTypeOf(s) === 'warmup') continue;
    w = Math.max(w, setTopWeight(s));
  }
  return w;
}
const fmtT = (kg: number) => (kg / 1000).toFixed(1);

export function computeTrends(finished: Workout[], body: BodyMetrics, now: number): TrendsResult {
  const chrono = [...finished].sort((a, b) => a.startedAt - b.startedAt);
  const weeksSet = new Set(chrono.map((w) => weekStart(w.startedAt)));
  const weeksTracked = weeksSet.size;
  const ready = weeksTracked >= 3 && chrono.length >= 3;

  const win = (days: number) => chrono.filter((w) => now - w.startedAt <= days * DAY);
  const spanDays = chrono.length ? (now - chrono[0].startedAt) / DAY : 0;

  const insights: Insight[] = [];
  const T = strings().trends;
  const M = strings().muscleGroups;
  const loc = getLocale();
  const locName = (n: string): string => localizedExerciseName(n, loc) ?? n;
  const dayName = (dow: number): string => fmtWeekday(new Date(2024, 0, 7 + dow).getTime());

  // per-lift top-weight timelines (actual weight)
  const seriesByLift = new Map<string, { ts: number; w: number }[]>();
  const sessionCount = new Map<string, number>();
  for (const w of chrono) {
    for (const ex of w.exercises) {
      if (!isStrengthExercise(ex)) continue;
      const tw = topWeight(ex);
      if (tw <= 0) continue;
      const name = ex.name.trim();
      sessionCount.set(name, (sessionCount.get(name) ?? 0) + 1);
      const arr = seriesByLift.get(name) ?? [];
      arr.push({ ts: w.startedAt, w: tw });
      seriesByLift.set(name, arr);
    }
  }
  const bestInBand = (name: string, from: number, to: number): number => {
    let b = 0;
    for (const p of seriesByLift.get(name) ?? []) {
      const age = (now - p.ts) / DAY;
      if (age > from && age <= to) b = Math.max(b, p.w);
    }
    return b;
  };
  const rankedLifts = [...sessionCount.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);

  // Horizon helpers — the four stages are NON-OVERLAPPING eras (0–30, 30–90,
  // 90–180, 180–365 days ago), each shown as a per-week average. An era with no
  // history yet reads as an empty stub, not a misleading repeat of the last one.
  const ERAS: [number, number][] = [
    [0, 30],
    [30, 90],
    [90, 180],
    [180, 365],
  ];
  const inBand = (w: Workout, f: number, t: number) => {
    const a = (now - w.startedAt) / DAY;
    return a > f && a <= t;
  };
  const bandWeeks = (f: number, t: number) => {
    const hi = Math.min(t, Math.max(spanDays, f));
    return hi > f ? Math.max((hi - f) / 7, 0.5) : 0;
  };
  const eraBars = (
    value: (from: number, to: number, weeks: number) => { raw: number; value: string },
  ) => ERAS.map(([f, t], i) => ({ label: HZ_LABEL[i], ...value(f, t, bandWeeks(f, t)) }));

  // ---- BALANCE: push/pull + upper/lower (90-day window for stability) -----
  const balanceCard = (
    key: string,
    aLabel: string,
    bLabel: string,
    a: number,
    b: number,
    lowWord: string,
    addWord: string,
    skewRatio: number,
  ) => {
    const tot = a + b;
    if (tot < 12) return;
    const lowIsB = b <= a;
    const low = lowIsB ? b : a;
    const high = lowIsB ? a : b;
    const skewed = low < skewRatio * high;
    insights.push({
      key,
      type: 'balance',
      level: skewed ? 'risk' : 'good',
      severity: skewed ? 88 : 60,
      attention: skewed,
      kicker: skewed ? T.needsAttention : `${aLabel} / ${bLabel}`,
      headline: skewed ? T.balLow(lowWord) : T.balOk(aLabel, bLabel),
      detail: skewed ? T.balAdd(addWord) : T.balEven(a, b),
      aLabel,
      bLabel,
      aVal: a,
      bVal: b,
      lowSide: skewed ? (lowIsB ? 'b' : 'a') : undefined,
    });
  };
  {
    let push = 0,
      pull = 0,
      upper = 0,
      lower = 0;
    for (const w of win(90)) {
      for (const ex of w.exercises) {
        if (!isStrengthExercise(ex)) continue;
        const p = resolveMuscles(ex).primary;
        if (!p) continue;
        const sets = ex.sets.filter((s) => setTypeOf(s) !== 'warmup').length;
        if (PUSH.includes(p)) push += sets;
        else if (PULL.includes(p)) pull += sets;
        if (UPPER.includes(p)) upper += sets;
        else if (LOWER.includes(p)) lower += sets;
      }
    }
    balanceCard(
      'balance-pp',
      T.push,
      T.pull,
      push,
      pull,
      pull <= push ? T.pull : T.push,
      pull <= push ? T.addRows : T.addPress,
      0.6,
    );
    balanceCard(
      'balance-ul',
      T.upper,
      T.lower,
      upper,
      lower,
      lower <= upper ? T.lowerBody : T.upperBody,
      lower <= upper ? T.addSquats : T.addRowsUpper,
      0.5,
    );
  }

  // ---- MUSCLE LIST: least + most trained AREAS (4 weeks) ----------------
  // Rolled up to coarse areas (Back = lats+traps+lower_back+generic back, etc.)
  // so the finer split can't misread as "you barely train back" just because
  // the generic `back` tag is near-empty. A drill-down gap tip follows.
  {
    const perMuscle = new Map<MuscleGroup, number>();
    for (const w of win(30))
      for (const [m, n] of muscleSetsInWorkout(w)) perMuscle.set(m, (perMuscle.get(m) ?? 0) + n);
    const areas = areaSetsFrom(perMuscle).filter((a) => a.sets > 0);
    if (areas.length >= 4) {
      const byVol = [...areas].sort((a, b) => a.sets - b.sets);
      const maxAll = Math.max(...areas.map((a) => a.sets), 1);
      const least = byVol.slice(0, 3);
      const counts = byVol.map((a) => a.sets).sort((a, b) => a - b);
      const median = counts[Math.floor(counts.length / 2)];
      const worstN = least[0].sets;
      const risk = median > 0 && worstN < 0.5 * median;
      insights.push({
        key: 'least',
        type: 'muscleList',
        level: risk ? 'risk' : 'warn',
        severity: risk ? 95 : 70,
        kicker: T.least,
        detail: T.leastDetail(T.areas[least[0].key]),
        muscles: least.map((a, i) => ({
          label: T.areas[a.key],
          frac: Math.max(0.08, a.sets / maxAll),
          worst: i === 0,
        })),
      });
      const most = [...byVol].reverse().slice(0, 3);
      insights.push({
        key: 'most',
        type: 'muscleList',
        level: 'info',
        severity: 56,
        kicker: T.most,
        detail: T.mostDetail(T.areas[most[0].key]),
        muscles: most.map((a) => ({
          label: T.areas[a.key],
          frac: Math.max(0.08, a.sets / maxAll),
          worst: false,
        })),
      });

      // Drill-down: a well-trained area with a notable neglected sub-muscle
      // (e.g. plenty of back volume but almost no lower-back).
      const areaByKey = new Map(areas.map((a) => [a.key, a]));
      let gap: {
        key: string;
        member: MuscleGroup;
        hintKey: 'gapHintHinge' | 'gapHintLegCurl' | 'gapHintCalf';
        areaSets: number;
      } | null = null;
      for (const g of AREA_GAPS) {
        const a = areaByKey.get(g.area);
        if (!a || a.sets < 8) continue;
        const memberSets = a.members.get(g.member) ?? 0;
        if (memberSets < 0.12 * a.sets && (!gap || a.sets > gap.areaSets))
          gap = { key: a.key, member: g.member, hintKey: g.hintKey, areaSets: a.sets };
      }
      if (gap) {
        const areaLabel = T.areas[gap.key];
        const sub = M[gap.member];
        insights.push({
          key: `gap:${gap.member}`,
          type: 'tip',
          level: 'warn',
          severity: 82,
          attention: true,
          icon: 'warning-circle',
          headline: T.gapHead(areaLabel, sub),
          detail: T.gapDetail(sub, T[gap.hintKey]),
        });
      }
    }
  }

  // ---- HORIZON: one metric across 30/90/180/365d eras as stage bars -----
  const eraTrend = (recent: number, prior: number | undefined) => {
    if (!prior || prior <= 0) return { up: false, down: false };
    return { up: recent >= prior * 1.1, down: recent <= prior * 0.82 };
  };
  {
    const bars = eraBars((f, t, wk) => {
      const raw =
        wk > 0
          ? chrono.filter((w) => inBand(w, f, t)).reduce((v, w) => v + workoutVolumeKg(w), 0) / wk
          : 0;
      return { raw, value: wk > 0 ? `${fmtT(raw)}t` : '—' };
    });
    const prior = bars.slice(1).find((b) => b.raw > 0)?.raw;
    const { up, down } = eraTrend(bars[0].raw, prior);
    insights.push({
      key: 'hz-vol',
      type: 'horizon',
      level: down ? 'risk' : up ? 'good' : 'info',
      severity: down ? 84 : 78,
      kicker: T.weeklyVolume,
      headline: up ? T.volUp : down ? T.volDown : T.weeklyVolume,
      detail: up ? T.volUpDetail : down ? T.volDownDetail : T.volFlatDetail,
      bars,
    });
  }
  {
    const bars = eraBars((f, t, wk) => {
      const raw = wk > 0 ? chrono.filter((w) => inBand(w, f, t)).length / wk : 0;
      return { raw, value: wk > 0 ? raw.toFixed(1) : '—' };
    });
    const prior = bars.slice(1).find((b) => b.raw > 0)?.raw;
    const { down } = eraTrend(bars[0].raw, prior);
    insights.push({
      key: 'hz-sess',
      type: 'horizon',
      level: down ? 'warn' : 'info',
      severity: down ? 76 : 72,
      kicker: T.sessions,
      headline: down ? T.sessLess : T.sessFreq,
      detail: down ? T.sessLessDetail : T.sessDetail,
      bars,
    });
  }
  if (rankedLifts.length) {
    const lift = rankedLifts[0];
    const series = seriesByLift.get(lift) ?? [];
    if (series.length >= 4 && spanDays >= 21) {
      const bars = eraBars((f, t) => {
        const arr = series.filter((p) => {
          const a = (now - p.ts) / DAY;
          return a > f && a <= t;
        });
        const raw = arr.length ? arr.reduce((s, p) => s + p.w, 0) / arr.length : 0;
        return { raw, value: raw > 0 ? `${Math.round(raw)}` : '—' };
      });
      const prior = bars.slice(1).find((b) => b.raw > 0)?.raw;
      const { up } = eraTrend(bars[0].raw, prior);
      insights.push({
        key: 'hz-lift',
        type: 'horizon',
        level: up ? 'good' : 'info',
        severity: 80,
        kicker: T.topSet(locName(lift)),
        headline: up ? T.liftHeavier(locName(lift)) : T.liftTop(locName(lift)),
        detail: up ? T.liftUpDetail : T.liftFlatDetail,
        bars,
      });
    }
  }

  // ---- TREND: a lift genuinely climbing (sparkline) ---------------------
  for (const lift of rankedLifts.slice(0, 2)) {
    const series = seriesByLift.get(lift) ?? [];
    if (series.length < 5 || (now - series[0].ts) / DAY < 45) continue;
    const bestNow = bestInBand(lift, 0, 45);
    const bestPrev = bestInBand(lift, 45, 135);
    if (bestNow > 0 && bestPrev > 0 && bestNow >= bestPrev + 2.5) {
      insights.push({
        key: `progress:${lift}`,
        type: 'trend',
        level: 'good',
        severity: 66,
        icon: 'chart-line-up',
        kicker: T.strength,
        headline: T.liftClimbing(locName(lift)),
        detail: T.liftClimbDetail(Math.round(bestNow - bestPrev)),
        spark: series.slice(-10).map((p) => p.w),
        hero: `${Math.round(bestNow)}`,
        heroUnit: T.kgTop,
        deltaPct: Math.round(((bestNow - bestPrev) / bestPrev) * 100),
      });
      break;
    }
  }
  {
    const weights = (body?.weights ?? []).slice().sort((a, b) => a.at - b.at);
    if (weights.length >= 4 && (now - weights[0].at) / DAY >= 45) {
      const recentW = weights[weights.length - 1].weight;
      const older = weights.find((x) => now - x.at >= 60 * DAY) ?? weights[0];
      const deltaPct =
        older.weight > 0 ? Math.round(((recentW - older.weight) / older.weight) * 100) : 0;
      insights.push({
        key: 'bw-trend',
        type: 'trend',
        level: 'info',
        severity: 34,
        icon: 'scales',
        kicker: T.bodyweight,
        headline: `${recentW.toFixed(1)} kg`,
        detail: T.bwDetail,
        spark: weights.slice(-10).map((x) => x.weight),
        hero: recentW.toFixed(1),
        heroUnit: 'kg',
        deltaPct: deltaPct === 0 ? null : deltaPct,
      });
    }
  }

  // ---- STAT: all-time milestone -----------------------------------------
  {
    let best = 0;
    let bestLift = '';
    for (const [name, series] of seriesByLift) {
      for (const p of series) {
        if (p.w > best) {
          best = p.w;
          bestLift = name;
        }
      }
    }
    if (best > 0) {
      insights.push({
        key: 'stat-best',
        type: 'stat',
        level: 'good',
        severity: 54,
        kicker: T.heaviest,
        detail: T.heaviestDetail(locName(bestLift)),
        hero: `${Math.round(best)}`,
        heroUnit: 'kg',
        deltaPct: null,
      });
    }
  }

  // ---- TIP: plateau, recovery, rest, timing, neglect, streak -----------
  for (const lift of rankedLifts.slice(0, 3)) {
    const series = seriesByLift.get(lift) ?? [];
    if (series.length < 5) continue;
    const recentSessions = series.filter((p) => (now - p.ts) / DAY <= 42).length;
    let lastHighTs = series[0].ts;
    let run = 0;
    for (const p of series) {
      if (p.w > run) {
        run = p.w;
        lastHighTs = p.ts;
      }
    }
    const flatWeeks = Math.floor((now - lastHighTs) / WEEK);
    const bestNow = bestInBand(lift, 0, 45);
    const bestPrev = bestInBand(lift, 45, 135);
    if (
      bestNow > 0 &&
      bestPrev > 0 &&
      bestNow <= bestPrev &&
      recentSessions >= 2 &&
      flatWeeks >= 5
    ) {
      insights.push({
        key: `plateau:${lift}`,
        type: 'tip',
        level: 'risk',
        severity: 92,
        attention: true,
        icon: 'chart-line-up',
        headline: T.liftStalling(locName(lift)),
        detail: T.stallDetail(flatWeeks),
      });
      break;
    }
  }
  {
    const dayOf = (ts: number) => Math.floor(ts / DAY);
    const emphasis = new Map<MuscleGroup, number[]>();
    for (const w of win(28)) {
      const ms = muscleSetsInWorkout(w);
      let topM: MuscleGroup | null = null;
      let topN = 0;
      for (const [m, n] of ms) {
        if (n > topN && MAJOR.includes(m)) {
          topN = n;
          topM = m;
        }
      }
      if (topM && topN >= 3) {
        const arr = emphasis.get(topM) ?? [];
        arr.push(dayOf(w.startedAt));
        emphasis.set(topM, arr);
      }
    }
    let best: { m: MuscleGroup; span: number } | null = null;
    for (const [m, days] of emphasis) {
      const sorted = [...new Set(days)].sort((a, b) => a - b);
      for (let i = 2; i < sorted.length; i++) {
        const span = sorted[i] - sorted[i - 2];
        if (span <= 5 && (!best || span < best.span)) best = { m, span };
      }
    }
    if (best) {
      insights.push({
        key: 'recovery',
        type: 'tip',
        level: 'warn',
        severity: 64,
        icon: 'clock-countdown',
        headline: T.recovery(M[best.m]),
        detail: T.recoveryDetail(best.span + 1),
      });
    }
  }
  {
    const rest = new Map<string, { sum: number; n: number }>();
    for (const w of win(28)) {
      for (const ex of w.exercises) {
        if (!isStrengthExercise(ex)) continue;
        for (const s of ex.sets) {
          if (setTypeOf(s) === 'warmup') continue;
          const rs = restBeforeSetInWorkout(w, s);
          if (rs == null || rs <= 0) continue;
          const r = rest.get(ex.name) ?? { sum: 0, n: 0 };
          r.sum += rs;
          r.n += 1;
          rest.set(ex.name, r);
        }
      }
    }
    let worst: { name: string; avg: number } | null = null;
    for (const [name, r] of rest) {
      if (r.n < 5) continue;
      const a = r.sum / r.n;
      if (a > 150 && (!worst || a > worst.avg)) worst = { name, avg: a };
    }
    if (worst) {
      insights.push({
        key: 'rest',
        type: 'tip',
        level: 'warn',
        severity: 46,
        icon: 'clock-countdown',
        headline: T.longRests,
        detail: T.longRestsDetail(Math.round(worst.avg / 60), locName(worst.name)),
      });
    }
  }
  {
    const byDow: { sum: number; n: number }[] = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }));
    for (const w of win(56)) {
      if (!w.finishedAt) continue;
      const min = (w.finishedAt - w.startedAt) / 60000;
      if (min < 5 || min > 240) continue;
      const d = new Date(w.startedAt).getDay();
      byDow[d].sum += min;
      byDow[d].n += 1;
    }
    const all = byDow.filter((x) => x.n > 0);
    const overallAvg = all.length
      ? all.reduce((a, b) => a + b.sum, 0) / all.reduce((a, b) => a + b.n, 0)
      : 0;
    let shortDay: { dow: number; avg: number } | null = null;
    for (let d = 0; d < 7; d++) {
      if (byDow[d].n < 2) continue;
      const a = byDow[d].sum / byDow[d].n;
      if (a < 42 && a < overallAvg - 8 && (!shortDay || a < shortDay.avg))
        shortDay = { dow: d, avg: a };
    }
    if (shortDay) {
      const day = dayName(shortDay.dow);
      insights.push({
        key: 'timing',
        type: 'tip',
        level: 'warn',
        severity: 44,
        icon: 'clock-countdown',
        headline: T.timeOn(day),
        detail: T.timeOnDetail(Math.round(shortDay.avg)),
        action: T.addToDay(day),
        actionHref: '#/programs',
      });
    }
  }
  {
    let pick: { name: string; weeks: number; hist: number } | null = null;
    for (const name of rankedLifts) {
      const series = seriesByLift.get(name) ?? [];
      const hist = series.filter((p) => {
        const a = (now - p.ts) / DAY;
        return a > 30 && a <= 180;
      }).length;
      const recent = series.filter((p) => (now - p.ts) / DAY <= 30).length;
      if (hist >= 5 && recent === 0) {
        const last = series[series.length - 1];
        const weeks = Math.floor((now - last.ts) / WEEK);
        if (weeks >= 4 && (!pick || hist > pick.hist)) pick = { name, weeks, hist };
      }
    }
    if (pick) {
      insights.push({
        key: 'neglect',
        type: 'tip',
        level: 'warn',
        severity: 50,
        icon: 'clock-countdown',
        headline: T.neglect(locName(pick.name), pick.weeks),
        detail: T.neglectDetail,
      });
    }
  }
  // No rest day — longest run of consecutive training days in the last 2 weeks.
  {
    const trained = new Set(win(16).map((w) => Math.floor(w.startedAt / DAY)));
    const todayKey = Math.floor(now / DAY);
    let bestRun = 0;
    let cur = 0;
    for (let k = todayKey - 15; k <= todayKey; k++) {
      if (trained.has(k)) {
        cur += 1;
        bestRun = Math.max(bestRun, cur);
      } else cur = 0;
    }
    if (bestRun >= 6) {
      insights.push({
        key: 'no-rest',
        type: 'tip',
        level: 'warn',
        severity: 68,
        icon: 'warning-circle',
        headline: T.noRest,
        detail: T.noRestDetail(bestRun),
      });
    }
  }
  // Volume ramping too fast — recent 2-week rate well above the prior month.
  if (spanDays >= 30) {
    const recent =
      chrono
        .filter((w) => (now - w.startedAt) / DAY <= 14)
        .reduce((v, w) => v + workoutVolumeKg(w), 0) / 2;
    const prior =
      chrono
        .filter((w) => {
          const a = (now - w.startedAt) / DAY;
          return a > 14 && a <= 42;
        })
        .reduce((v, w) => v + workoutVolumeKg(w), 0) / 4;
    if (prior > 0 && recent >= prior * 1.4) {
      const pct = Math.round((recent / prior - 1) * 100);
      insights.push({
        key: 'vol-spike',
        type: 'tip',
        level: 'warn',
        severity: 66,
        icon: 'chart-line-up',
        headline: T.volSpike,
        detail: T.volSpikeDetail(pct),
      });
    }
  }
  // A major muscle trained regularly before, but nothing in the last 2 weeks.
  {
    const recent = new Map<MuscleGroup, number>();
    for (const w of win(14))
      for (const [m, n] of muscleSetsInWorkout(w)) recent.set(m, (recent.get(m) ?? 0) + n);
    const hist = new Map<MuscleGroup, number>();
    for (const w of chrono.filter((w) => {
      const a = (now - w.startedAt) / DAY;
      return a > 14 && a <= 90;
    }))
      for (const [m, n] of muscleSetsInWorkout(w)) hist.set(m, (hist.get(m) ?? 0) + n);
    // Roll up to areas so "Back on pause" fires only when the whole back area
    // (lats/traps/lower_back included) goes quiet -- not when a near-empty
    // generic `back` tag drops while lats/traps carry on.
    const recentByArea = new Map(areaSetsFrom(recent).map((a) => [a.key, a.sets]));
    let stale: { key: string } | null = null;
    let staleN = 0;
    for (const a of areaSetsFrom(hist)) {
      if (a.sets >= 8 && (recentByArea.get(a.key) ?? 0) === 0 && a.sets > staleN) {
        staleN = a.sets;
        stale = { key: a.key };
      }
    }
    if (stale) {
      insights.push({
        key: 'stale',
        type: 'tip',
        level: 'warn',
        severity: 62,
        icon: 'warning-circle',
        headline: T.onPause(T.areas[stale.key]),
        detail: T.onPauseDetail,
      });
    }
  }
  // Sessions running long — quality tends to drop past ~1h40m.
  {
    const durs = win(28)
      .filter((w) => w.finishedAt)
      .map((w) => ((w.finishedAt as number) - w.startedAt) / 60000)
      .filter((m) => m > 5 && m < 300);
    const a = durs.length >= 3 ? durs.reduce((s, x) => s + x, 0) / durs.length : 0;
    if (a > 100) {
      insights.push({
        key: 'long-sessions',
        type: 'tip',
        level: 'warn',
        severity: 48,
        icon: 'clock-countdown',
        headline: T.longSessions,
        detail: T.longSessionsDetail(Math.round(a)),
      });
    }
  }
  {
    let run = 0;
    let w = weekStart(now);
    if (!weeksSet.has(w)) w -= WEEK;
    while (weeksSet.has(w)) {
      run += 1;
      w -= WEEK;
    }
    if (run >= 4) {
      insights.push({
        key: 'streak',
        type: 'tip',
        level: 'good',
        severity: 42,
        icon: 'calendar-check',
        headline: T.streak(run),
        detail: T.streakDetail(run),
      });
    }
  }

  insights.sort((a, b) => b.severity - a.severity);
  return { ready, weeksTracked, insights };
}
