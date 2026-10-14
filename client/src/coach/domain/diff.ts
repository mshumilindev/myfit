/**
 * Program diffs and the options of a decision (plan 8.3). Option labels are GENERATED from the diff
 * with `describeDiff`; a hand-typed label is a bug (test compares every option label).
 * `describeDiff` returns the canonical English label; the UI localises from `parts`.
 */
import type { Signal } from './types';

export type DiffOp =
  | { op: 'sets'; exercise: string; from: number; to: number }
  | { op: 'add'; exercise: string; sets: number; reps: number }
  | { op: 'weight'; exercise: string; fromKg: number; toKg: number }
  | { op: 'deload'; pct: number; weeks: number }
  | { op: 'swap'; from: string; to: string };
export interface ProgramDiff {
  ops: DiffOp[];
}

export function describeOp(o: DiffOp): string {
  switch (o.op) {
    case 'sets':
      return `${o.exercise}: ${o.from} -> ${o.to} sets`;
    case 'add':
      return `add ${o.exercise} ${o.sets}x${o.reps}`;
    case 'weight':
      return `${o.exercise}: ${o.fromKg} -> ${o.toKg} kg`;
    case 'deload':
      return `deload -${o.pct}% volume for ${o.weeks} week${o.weeks === 1 ? '' : 's'}`;
    case 'swap':
      return `swap ${o.from} for ${o.to}`;
  }
}
export const describeDiff = (d: ProgramDiff): string => d.ops.map(describeOp).join('; ');

export type OptionKind = 'program' | 'wait' | 'dismiss';
export interface Option {
  id: string;
  kind: OptionKind;
  diff: ProgramDiff | null;
  /** Always `describeDiff(diff)` for program options. */
  label: string;
  suggested?: boolean;
}

const WAIT: Option = { id: 'wait', kind: 'wait', diff: null, label: 'Wait a week' };
const DISMISS: Option = { id: 'dismiss', kind: 'dismiss', diff: null, label: 'Dismiss signal' };
const prog = (id: string, diff: ProgramDiff, suggested = false): Option => ({
  id,
  kind: 'program',
  diff,
  label: describeDiff(diff),
  suggested,
});

export interface OptionContext {
  /** Current sets of the signal's exercise in the program (default 3). */
  currentSets?: number;
  currentKg?: number;
}

/** Options with real diffs. `message` is never an option; `pr` and `nodata` offer only wait/dismiss. */
export function buildOptions(signal: Signal, ctx: OptionContext = {}): Option[] {
  const sets = ctx.currentSets ?? 3;
  const ex = String(signal.facts.exercise ?? signal.exerciseKey ?? '');
  const tail = [WAIT, DISMISS];
  switch (signal.kind) {
    case 'stall':
      return [
        prog(
          'variation',
          {
            ops: [
              { op: 'sets', exercise: ex, from: sets, to: sets + 1 },
              { op: 'add', exercise: `Paused ${ex.toLowerCase()}`, sets: 3, reps: 5 },
            ],
          },
          true,
        ),
        prog('deload', { ops: [{ op: 'deload', pct: 30, weeks: 1 }] }),
        ...tail,
      ];
    case 'spike':
      return [prog('deload', { ops: [{ op: 'deload', pct: 30, weeks: 1 }] }, true), ...tail];
    case 'ready': {
      const kg = ctx.currentKg ?? 0;
      return [
        prog('step', { ops: [{ op: 'weight', exercise: ex, fromKg: kg, toKg: kg + 2.5 }] }, true),
        ...tail,
      ];
    }
    case 'injury':
      return [
        prog(
          'swap',
          { ops: [{ op: 'swap', from: ex, to: 'a restriction-safe alternative' }] },
          true,
        ),
        ...tail,
      ];
    case 'rhythm':
      return [prog('lighter', { ops: [{ op: 'deload', pct: 20, weeks: 2 }] }), ...tail];
    case 'machine':
      return [WAIT, DISMISS];
    default:
      return [WAIT, DISMISS];
  }
}
