/**
 * What a logged Time block adds to a muscle's FATIGUE and READINESS (SPO-608, owner 27.11; docs/plans/SPO-608-load-fatigue-risk.md).
 * Pure and React-free. It feeds only `muscleFatigue` and `muscleReadiness`: volume, the MEV/MAV/MRV zones, PRs and progression
 * stay strength-only, because a block does not promise the hard sets (near failure) those landmarks are counted in.
 *
 * Assumptions without a source (like the acute caps of SPO-601): a hard set is about 10 reps or 40 s under tension, and a block
 * set loads a muscle half as much as a working set (conditioning work sits further from failure, but it is not free).
 * Only a block with a saved result counts; without the Time blocks module installed nothing counts (the data stays).
 */
import type { MuscleGroup } from './data/exercises';
import { muscleInfoByName } from './data/exercises';
import { timeBlocksAvailable } from './addons/featureGates';
import type { BlockMember, WorkoutBlock } from './timeBlocks/model';
import type { Workout } from './types';

/** Reps that make one hard-set equivalent, and seconds under tension that do. */
export const BLOCK_REPS_PER_SET = 10;
export const BLOCK_SECONDS_PER_SET = 40;
/** How much one block set loads a muscle compared with a working set. */
export const BLOCK_LOAD_WEIGHT = 0.5;

export interface BlockMuscleLoad {
  /** Equivalent working sets where the muscle is the mover. */
  primary: number;
  /** The same where it only assists (the caller weights it like strength secondaries). */
  secondary: number;
}

/** Reps per round of a member as a number, or seconds per round when it is timed ("40 s", "1 min"); null when it has none. */
function perRound(m: BlockMember): { n: number; timed: boolean } | null {
  const raw = (m.reps ?? '').trim().toLowerCase();
  const hit = /^(\d+(?:[.,]\d+)?)\s*(s|sec|secs|seconds?|min|mins|minutes?|m)?$/.exec(raw);
  if (!hit) return null;
  const n = Number(hit[1].replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = hit[2];
  if (!unit) return { n, timed: false };
  return { n: /^m(in|ins|inute|inutes)?$/.test(unit) ? n * 60 : n, timed: true };
}

/** Equivalent working sets of one member of a block with a saved result (0 when nothing was recorded). */
function memberSets(b: WorkoutBlock, i: number): number {
  const r = b.result;
  const m = b.members[i];
  if (!r || !m) return 0;
  const pr = perRound(m);
  if (!pr) return 0;
  const rounds = Math.max(0, r.rounds ?? 0);
  // `actuals` holds the TOTAL the person did for that member (reps, or seconds when timed).
  const total = r.actuals?.[i] ?? pr.n * rounds;
  if (!(total > 0)) return 0;
  return total / (pr.timed ? BLOCK_SECONDS_PER_SET : BLOCK_REPS_PER_SET);
}

/** Muscle loads of the logged blocks of a session; empty when there are none or the module is not installed. */
export function blockMuscleLoad(w: Pick<Workout, 'blocks'>): Map<MuscleGroup, BlockMuscleLoad> {
  const out = new Map<MuscleGroup, BlockMuscleLoad>();
  const blocks = w.blocks;
  if (!blocks?.length || !timeBlocksAvailable()) return out;
  const add = (g: MuscleGroup, key: keyof BlockMuscleLoad, v: number) => {
    const cur = out.get(g) ?? { primary: 0, secondary: 0 };
    cur[key] += v;
    out.set(g, cur);
  };
  for (const b of blocks) {
    if (!b.result) continue;
    b.members.forEach((m, i) => {
      const sets = memberSets(b, i) * BLOCK_LOAD_WEIGHT;
      if (sets <= 0) return;
      const info = muscleInfoByName(m.name);
      if (!info || info.primary === 'cardio') return; // an unknown or cardio move has no muscle to charge
      add(info.primary, 'primary', sets);
      for (const s of info.secondary) if (s !== info.primary) add(s, 'secondary', sets);
    });
  }
  return out;
}
