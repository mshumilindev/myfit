/**
 * Feats — a deep, multi-year achievement system, entirely DERIVED from finished
 * workouts (nothing new is stored). Nineteen axes, each with a long tier ladder
 * whose ceiling is years away, so there is always a next one to chase. Unlock
 * dates are recovered by replaying sessions in chronological order and noting
 * where a metric first crosses each tier.
 */
import { est1rm, isStrengthExercise, setRepsTotal, setTypeOf, workoutVolumeKg } from './store';
import type { SetEntry, Workout } from './types';

export type FeatGroup =
  | 'volume'
  | 'strength'
  | 'sessions'
  | 'streak'
  | 'prs'
  | 'hours'
  | 'sets'
  | 'reps'
  | 'variety'
  | 'bigDay'
  | 'months'
  | 'earlyBird'
  | 'nightOwl'
  | 'weekend'
  | 'heaviestSet'
  | 'longestSession'
  | 'distance'
  | 'perfectWeeks'
  | 'trainingDays';

export type FeatUnit =
  | 'kg'
  | 'sessions'
  | 'days'
  | 'prs'
  | 'hours'
  | 'sets'
  | 'reps'
  | 'count'
  | 'months'
  | 'min'
  | 'km';

export interface Tier {
  emoji: string;
  title: string;
  value: number;
}

export interface FeatCategory {
  group: FeatGroup;
  label: string;
  desc: string;
  unit: FeatUnit;
  tiers: Tier[];
}

// Lifetime tonnage ladder — playful real-world equivalents, ever-climbing.
const VOLUME_TIERS: Tier[] = [
  { emoji: '🐕', title: 'Dog', value: 30 },
  { emoji: '🧍', title: 'A whole human', value: 75 },
  { emoji: '🐼', title: 'Panda', value: 150 },
  { emoji: '🏍️', title: 'Motorbike', value: 250 },
  { emoji: '🦍', title: 'Silverback troop', value: 400 },
  { emoji: '🎹', title: 'Grand piano', value: 480 },
  { emoji: '🧊', title: 'Fridge stack', value: 600 },
  { emoji: '🐎', title: 'Horse', value: 900 },
  { emoji: '🐄', title: 'Cow', value: 1_200 },
  { emoji: '🚗', title: 'Car', value: 1_500 },
  { emoji: '🗿', title: 'Moai head', value: 2_000 },
  { emoji: '🦏', title: 'Rhino', value: 2_300 },
  { emoji: '🦛', title: 'Hippo', value: 3_500 },
  { emoji: '🚙', title: 'SUV', value: 5_000 },
  { emoji: '🐘', title: 'Elephant', value: 6_000 },
  { emoji: '🦕', title: 'Brachiosaurus', value: 9_000 },
  { emoji: '🚌', title: 'Bus', value: 12_000 },
  { emoji: '🦣', title: 'Mammoth herd', value: 16_000 },
  { emoji: '🚚', title: 'Loaded truck', value: 20_000 },
  { emoji: '🎠', title: 'Carousel', value: 30_000 },
  { emoji: '✈️', title: 'Boeing 737', value: 41_000 },
  { emoji: '🐋', title: 'Whale pod', value: 55_000 },
  { emoji: '🛰️', title: 'Shuttle orbiter', value: 78_000 },
  { emoji: '🏛️', title: 'Parthenon', value: 100_000 },
  { emoji: '🐳', title: 'Blue whale', value: 150_000 },
  { emoji: '🗽', title: 'Statue of Liberty', value: 205_000 },
  { emoji: '🛫', title: 'Antonov An-225', value: 285_000 },
  { emoji: '🚢', title: 'Cargo ship deck', value: 400_000 },
  { emoji: '🛬', title: 'Airbus A380', value: 575_000 },
  { emoji: '⛰️', title: 'Christ the Redeemer', value: 1_145_000 },
  { emoji: '🚀', title: 'Shuttle on the pad', value: 2_030_000 },
  { emoji: '🏟️', title: 'The Colosseum', value: 5_000_000 },
  { emoji: '🗼', title: 'Eiffel Tower', value: 10_100_000 },
  { emoji: '🌉', title: 'Brooklyn Bridge', value: 14_000_000 },
  { emoji: '🏔️', title: 'A small hill', value: 50_000_000 },
  { emoji: '🌙', title: 'Nudged the Moon', value: 100_000_000 },
  { emoji: '🪐', title: 'Jupiter', value: 1_000_000_000 },
];

function tiers(emoji: string, title: (n: number) => string, values: number[]): Tier[] {
  return values.map((v) => ({ emoji, title: title(v), value: v }));
}

export const CATEGORIES: FeatCategory[] = [
  {
    group: 'volume',
    label: 'Volume lifted',
    desc: 'Total weight moved across every set you log (weight × reps, all-time).',
    unit: 'kg',
    tiers: VOLUME_TIERS,
  },
  {
    group: 'strength',
    label: 'Strength clubs',
    desc: 'Your best estimated 1-rep max on any single lift.',
    unit: 'kg',
    tiers: tiers(
      '🏋️',
      (n) => `${n} kg club`,
      [
        40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220,
        230, 240, 250, 260, 280, 300, 325, 350, 375, 400, 450, 500,
      ],
    ),
  },
  {
    group: 'sessions',
    label: 'Sessions',
    desc: 'Number of workouts you finish.',
    unit: 'sessions',
    tiers: tiers(
      '🗓️',
      (n) => `${n} sessions`,
      [
        5, 10, 15, 25, 40, 60, 80, 100, 125, 150, 175, 200, 250, 300, 400, 500, 650, 800, 1000,
        1250, 1500, 2000, 2500, 3000,
      ],
    ),
  },
  {
    group: 'streak',
    label: 'Weekly streak',
    desc: 'Consecutive weeks with at least one session — never miss a week.',
    unit: 'days',
    tiers: tiers(
      '🔥',
      (n) => `${n}-day streak`,
      [7, 14, 21, 30, 45, 60, 90, 120, 150, 180, 270, 365, 450, 540, 730, 1095, 1460, 1825],
    ),
  },
  {
    group: 'prs',
    label: 'Personal records',
    desc: 'Each time you beat your own best e1RM on a lift.',
    unit: 'prs',
    tiers: tiers(
      '🏆',
      (n) => `${n} PRs`,
      [1, 3, 5, 10, 15, 25, 40, 60, 80, 100, 150, 200, 300, 400, 500, 750, 1000, 1500],
    ),
  },
  {
    group: 'hours',
    label: 'Time under the bar',
    desc: 'Total time spent in your training sessions.',
    unit: 'hours',
    tiers: tiers(
      '⏱️',
      (n) => `${n} hours`,
      [5, 10, 25, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 5000],
    ),
  },
  {
    group: 'sets',
    label: 'Sets completed',
    desc: 'Every set you log adds up here, all-time.',
    unit: 'sets',
    tiers: tiers(
      '🔁',
      (n) => `${fmtCompact(n)} sets`,
      [
        50, 100, 250, 500, 1000, 1500, 2000, 3500, 5000, 7500, 10000, 15000, 20000, 35000, 50000,
        100000,
      ],
    ),
  },
  {
    group: 'reps',
    label: 'Reps performed',
    desc: 'Total reps performed across all your sets.',
    unit: 'reps',
    tiers: tiers(
      '🔢',
      (n) => `${fmtCompact(n)} reps`,
      [500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 200000, 350000, 500000, 750000, 1000000],
    ),
  },
  {
    group: 'variety',
    label: 'Exercise variety',
    desc: 'Distinct exercises you have tried at least once.',
    unit: 'count',
    tiers: tiers('🎯', (n) => `${n} exercises`, [5, 10, 20, 35, 50, 75, 100, 125, 150, 200, 250]),
  },
  {
    group: 'bigDay',
    label: 'Biggest single day',
    desc: 'The most volume you have lifted in one session.',
    unit: 'kg',
    tiers: tiers(
      '💥',
      (n) => `${fmtCompact(n)} kg day`,
      [1000, 2500, 5000, 7500, 10000, 12500, 15000, 20000, 25000, 30000, 40000, 50000],
    ),
  },
  {
    group: 'heaviestSet',
    label: 'Heaviest set',
    desc: 'The heaviest weight you have put on any single set.',
    unit: 'kg',
    tiers: tiers(
      '🪨',
      (n) => `${n} kg lift`,
      [20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 250, 275, 300, 350, 400],
    ),
  },
  {
    group: 'longestSession',
    label: 'Longest session',
    desc: 'The longest single workout you have completed.',
    unit: 'min',
    tiers: tiers('⏳', (n) => `${n}-min session`, [30, 45, 60, 75, 90, 105, 120, 150, 180, 240]),
  },
  {
    group: 'distance',
    label: 'Cardio distance',
    desc: 'Total distance logged on cardio and carry entries.',
    unit: 'km',
    tiers: tiers(
      '🏃',
      (n) => `${fmtCompact(n)} km`,
      [5, 10, 25, 50, 100, 200, 350, 500, 750, 1000, 2000, 5000],
    ),
  },
  {
    group: 'perfectWeeks',
    label: 'Solid weeks',
    desc: 'Weeks with 3 or more sessions — showing up like clockwork.',
    unit: 'count',
    tiers: tiers('✅', (n) => `${n} solid weeks`, [1, 4, 8, 12, 26, 52, 78, 104, 156, 260]),
  },
  {
    group: 'trainingDays',
    label: 'Days shown up',
    desc: 'Distinct calendar days on which you trained.',
    unit: 'days',
    tiers: tiers(
      '📆',
      (n) => `${n} days`,
      [10, 25, 50, 100, 200, 300, 400, 500, 750, 1000, 1500, 2000],
    ),
  },
  {
    group: 'months',
    label: 'Months trained',
    desc: 'Different calendar months in which you trained.',
    unit: 'months',
    tiers: tiers('📅', (n) => `${n} months`, [1, 3, 6, 12, 18, 24, 36, 48, 60, 84, 120]),
  },
  {
    group: 'earlyBird',
    label: 'Sunrise lifter',
    desc: 'Sessions started before 7:00 in the morning.',
    unit: 'count',
    tiers: tiers('🌅', (n) => `${n} dawn sessions`, [1, 5, 10, 25, 50, 100, 200, 350]),
  },
  {
    group: 'nightOwl',
    label: 'Night owl',
    desc: 'Sessions started after 21:00 in the evening.',
    unit: 'count',
    tiers: tiers('🦉', (n) => `${n} night sessions`, [1, 5, 10, 25, 50, 100, 200, 350]),
  },
  {
    group: 'weekend',
    label: 'Weekend warrior',
    desc: 'Sessions trained on a Saturday or Sunday.',
    unit: 'count',
    tiers: tiers('🏖️', (n) => `${n} weekend sessions`, [1, 10, 25, 50, 100, 200, 350, 500]),
  },
];

export interface Ach {
  key: string;
  group: FeatGroup;
  emoji: string;
  title: string;
  threshold: number;
  unit: FeatUnit;
  value: number;
  prev: number;
  unlocked: boolean;
  progress: number;
  unlockAt?: number;
}

export interface FeatsResult {
  byGroup: Record<FeatGroup, Ach[]>;
  nextUp: Ach | null;
  unlockedCount: number;
  total: number;
}

const HOUR_MS = 3_600_000;
const WEEK_MS = 7 * 24 * HOUR_MS;

function weekStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

function currentStreakDays(weekSet: Set<number>): number {
  if (weekSet.size === 0) return 0;
  const latest = Math.max(...weekSet);
  let run = 0;
  let w = latest;
  while (weekSet.has(w)) {
    run += 1;
    w -= WEEK_MS;
  }
  return run * 7;
}

export function computeFeats(finished: Workout[]): FeatsResult {
  const chrono = finished
    .slice()
    .sort((a, b) => (a.finishedAt ?? a.startedAt) - (b.finishedAt ?? b.startedAt));

  let volumeKg = 0;
  let sessions = 0;
  let hours = 0;
  let prs = 0;
  let topE1rm = 0;
  let setsDone = 0;
  let repsDone = 0;
  let bigDay = 0;
  let earlyBird = 0;
  let nightOwl = 0;
  let weekend = 0;
  let heaviestSet = 0;
  let longestSession = 0;
  let distance = 0;
  let perfectWeeks = 0;
  const bestByEx = new Map<string, number>();
  const exNames = new Set<string>();
  const monthSet = new Set<string>();
  const daySet = new Set<string>();
  const weekSet = new Set<number>();
  const weekCounts = new Map<number, number>();
  const unlockAt: Record<string, number> = {};

  const catByGroup = new Map(CATEGORIES.map((c) => [c.group, c]));
  const record = (group: FeatGroup, value: number, at: number) => {
    for (const tier of catByGroup.get(group)!.tiers) {
      const key = `${group}:${tier.value}`;
      if (value >= tier.value && !(key in unlockAt)) unlockAt[key] = at;
    }
  };

  for (const w of chrono) {
    const at = w.finishedAt ?? w.startedAt;
    const d = new Date(w.startedAt);
    sessions += 1;
    const sessionVol = workoutVolumeKg(w);
    volumeKg += sessionVol;
    hours +=
      Math.min(6 * HOUR_MS, Math.max(0, (w.finishedAt ?? w.startedAt) - w.startedAt)) / HOUR_MS;
    const ws = weekStart(at);
    weekSet.add(ws);
    const wc = (weekCounts.get(ws) ?? 0) + 1;
    weekCounts.set(ws, wc);
    if (wc === 3) perfectWeeks += 1;
    monthSet.add(`${d.getFullYear()}-${d.getMonth()}`);
    daySet.add(d.toDateString());
    const hr = d.getHours();
    if (hr < 7) earlyBird += 1;
    if (hr >= 21) nightOwl += 1;
    const dow = d.getDay();
    if (dow === 0 || dow === 6) weekend += 1;
    bigDay = Math.max(bigDay, sessionVol);
    longestSession = Math.max(
      longestSession,
      Math.min(6 * 60, Math.max(0, (w.finishedAt ?? w.startedAt) - w.startedAt) / 60000),
    );

    for (const ex of w.exercises) {
      const strength = isStrengthExercise(ex);
      if (strength) exNames.add(ex.name.trim().toLowerCase());
      for (const s of ex.sets as SetEntry[]) {
        setsDone += 1;
        repsDone += setRepsTotal(s);
        distance += s.distanceKm ?? 0;
        if (setTypeOf(s) !== 'warmup') heaviestSet = Math.max(heaviestSet, s.weight ?? 0);
        if (!strength) continue;
        const e = est1rm(s.weight ?? 0, s.reps);
        if (e <= 0) continue;
        const prev = bestByEx.get(ex.name) ?? 0;
        if (e > prev) {
          if (prev > 0) prs += 1;
          bestByEx.set(ex.name, e);
          if (e > topE1rm) topE1rm = e;
        }
      }
    }

    record('volume', volumeKg, at);
    record('sessions', sessions, at);
    record('hours', hours, at);
    record('prs', prs, at);
    record('strength', topE1rm, at);
    record('sets', setsDone, at);
    record('reps', repsDone, at);
    record('variety', exNames.size, at);
    record('bigDay', bigDay, at);
    record('months', monthSet.size, at);
    record('earlyBird', earlyBird, at);
    record('nightOwl', nightOwl, at);
    record('weekend', weekend, at);
    record('heaviestSet', heaviestSet, at);
    record('longestSession', longestSession, at);
    record('distance', distance, at);
    record('perfectWeeks', perfectWeeks, at);
    record('trainingDays', daySet.size, at);
  }

  const streakDays = currentStreakDays(weekSet);

  const valueOf: Record<FeatGroup, number> = {
    volume: volumeKg,
    strength: topE1rm,
    sessions,
    streak: streakDays,
    prs,
    hours,
    sets: setsDone,
    reps: repsDone,
    variety: exNames.size,
    bigDay,
    months: monthSet.size,
    earlyBird,
    nightOwl,
    weekend,
    heaviestSet,
    longestSession,
    distance,
    perfectWeeks,
    trainingDays: daySet.size,
  };

  const byGroup = {} as Record<FeatGroup, Ach[]>;
  let unlockedCount = 0;
  let total = 0;
  for (const cat of CATEGORIES) {
    const v = valueOf[cat.group];
    const list: Ach[] = cat.tiers.map((tier, i) => {
      const prev = i > 0 ? cat.tiers[i - 1].value : 0;
      const unlocked = v >= tier.value;
      const progress = Math.max(0, Math.min(1, (v - prev) / (tier.value - prev)));
      if (unlocked) unlockedCount += 1;
      total += 1;
      return {
        key: `${cat.group}:${tier.value}`,
        group: cat.group,
        emoji: tier.emoji,
        title: tier.title,
        threshold: tier.value,
        unit: cat.unit,
        value: v,
        prev,
        unlocked,
        progress,
        unlockAt: unlockAt[`${cat.group}:${tier.value}`],
      };
    });
    byGroup[cat.group] = list;
  }

  let nextUp: Ach | null = null;
  for (const cat of CATEGORIES) {
    for (const a of byGroup[cat.group]) {
      if (a.unlocked) continue;
      if (!nextUp || a.progress > nextUp.progress) nextUp = a;
    }
  }

  return { byGroup, nextUp, unlockedCount, total };
}

/** Compact integer for tier titles: 20000 → "20k", 500000 → "500k", 1000000 → "1M". */
function fmtCompact(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (n >= 1000) {
    const k = n / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return `${n}`;
}

/** Format a value in a group's unit for display. */
export function fmtAchValue(unit: FeatUnit, value: number): string {
  switch (unit) {
    case 'kg':
      if (value < 1000) return `${Math.round(value)} kg`;
      return value / 1000 >= 100
        ? `${Math.round(value / 1000)} t`
        : `${(value / 1000).toFixed(1)} t`;
    case 'sessions':
      return `${Math.round(value)}`;
    case 'days':
      return `${Math.round(value)} d`;
    case 'prs':
      return `${Math.round(value)}`;
    case 'hours':
      return `${Math.round(value)} h`;
    case 'sets':
      return `${Math.round(value)}`;
    case 'reps':
      return `${Math.round(value)}`;
    case 'count':
      return `${Math.round(value)}`;
    case 'months':
      return `${Math.round(value)}`;
    case 'min':
      return `${Math.round(value)} min`;
    case 'km':
      return `${Math.round(value)} km`;
  }
}
