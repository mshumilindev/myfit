/**
 * Day-aware training-day inference (Ex suggestions, AC-1).
 *
 * Pure logic: maps a primary muscle to a training day, infers the session's
 * day from what has been logged (falling back to the weekday split), and picks
 * the day with the most sets. No hard-coded exercise lists — callers feed it
 * muscle set-counts derived from the shared catalog (AC-4.2).
 */
import type { MuscleGroup } from './exercises';

export type TrainingDay = 'push' | 'pull' | 'legs' | 'core' | 'full';

const MUSCLE_DAY: Record<string, TrainingDay> = {
  chest: 'push',
  shoulders: 'push',
  triceps: 'push',
  back: 'pull',
  biceps: 'pull',
  forearms: 'pull',
  quads: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  calves: 'legs',
  core: 'core',
  fullbody: 'full',
};

export function exerciseDay(primary: MuscleGroup | null | undefined): TrainingDay | null {
  return primary ? (MUSCLE_DAY[primary] ?? null) : null;
}

export type DayReadout =
  | { kind: 'muscle'; groups: MuscleGroup[] } // one dominant group → name it
  | { kind: 'split'; groups: MuscleGroup[]; split: TrainingDay } // fits one split
  | { kind: 'mixed'; groups: MuscleGroup[] } // 2–3 groups across splits → list them
  | { kind: 'full'; groups: MuscleGroup[] }; // many groups → full body

/**
 * Describe a session's day from its ordered (group, set-count) list:
 *   - one significant group        → that muscle ("Back"),
 *   - several in the same split     → the split ("Pull"),
 *   - several across splits         → the actual groups ("Shoulders + Back"),
 *   - many groups / ≥3 splits       → full body.
 * A group counts as significant when it has ≥ ~a third of the top group's sets,
 * so incidental accessory work never renames the day.
 */
export function describeDay(ordered: Array<[MuscleGroup, number]>): DayReadout | null {
  const withSets = ordered.filter(([, n]) => n > 0);
  if (withSets.length === 0) return null;
  const max = Math.max(...withSets.map(([, n]) => n));
  let groups = withSets.filter(([, n]) => n >= max * 0.34).map(([m]) => m);
  if (groups.length === 0) groups = [withSets[0][0]];
  const splits = [...new Set(groups.map((m) => exerciseDay(m)).filter(Boolean))] as TrainingDay[];
  // "Full body" means spanning the main areas (push + pull + legs) — NOT just
  // hitting many muscles inside one area. A thorough leg day (quads, hamstrings,
  // glutes) is still Legs, and legs + core is Legs + Core, never Full body.
  const mainSplits = splits.filter((s) => s === 'push' || s === 'pull' || s === 'legs');
  if (groups.length === 1) return { kind: 'muscle', groups };
  if (splits.length === 1) return { kind: 'split', groups, split: splits[0] };
  if (mainSplits.length >= 3) return { kind: 'full', groups };
  return { kind: 'mixed', groups };
}

/** Localized label for a readout: a muscle name, a split name, or a group list. */
interface DayLabelStrings {
  dayPush: string;
  dayPull: string;
  dayLegs: string;
  dayCore: string;
  dayFull: string;
  dayUpper: string;
  muscleGroups: Record<MuscleGroup, string>;
}
export function dayReadoutLabel(r: DayReadout, t: DayLabelStrings): string {
  const DAY: Record<TrainingDay, string> = {
    push: t.dayPush,
    pull: t.dayPull,
    legs: t.dayLegs,
    core: t.dayCore,
    full: t.dayFull,
  };
  if (r.kind === 'split') return DAY[r.split];
  if (r.kind === 'full') return t.dayFull;
  // mixed: collapse each split-cluster — a split with ≥2 worked muscles reads
  // as the split name ("Legs"), a lone muscle keeps its own name ("Core").
  const order: TrainingDay[] = [];
  const bySplit = new Map<TrainingDay, MuscleGroup[]>();
  for (const m of r.groups) {
    const s = (exerciseDay(m) ?? 'full') as TrainingDay;
    if (!bySplit.has(s)) {
      bySplit.set(s, []);
      order.push(s);
    }
    (bySplit.get(s) as MuscleGroup[]).push(m);
  }
  // Chest AND Back together read as Upper body (the two big upper groups) — a
  // big+small pair like Chest + Biceps does NOT. Core is appended if trained.
  if (r.groups.includes('chest') && r.groups.includes('back')) {
    return bySplit.has('core') ? `${t.dayUpper} + ${DAY.core}` : t.dayUpper;
  }
  return order
    .map((s) => {
      const ms = bySplit.get(s) as MuscleGroup[];
      return ms.length >= 2 ? DAY[s] : t.muscleGroups[ms[0]];
    })
    .join(' + ');
}

/** The training day with the most logged sets, or null when nothing is logged. */
export function dayFromCounts(counts: Map<MuscleGroup, number>): TrainingDay | null {
  const byDay = new Map<TrainingDay, number>();
  for (const [m, n] of counts) {
    const d = MUSCLE_DAY[m];
    if (d && n > 0) byDay.set(d, (byDay.get(d) ?? 0) + n);
  }
  let best: TrainingDay | null = null;
  let bestN = 0;
  for (const [d, n] of byDay) {
    if (n > bestN) {
      bestN = n;
      best = d;
    }
  }
  return best;
}
