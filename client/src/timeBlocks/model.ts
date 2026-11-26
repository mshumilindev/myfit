/**
 * Time blocks (Advanced training module): a timed block of exercises, done as AMRAP, EMOM, For time or work/rest intervals.
 * Pure types and clock maths: no React, no storage, no audio. The block is stored with the program or session it belongs to
 * (sealed with it); the clock is derived from timestamps, so a backgrounded tab or a reload never loses the time.
 */
export type BlockFormat = 'amrap' | 'emom' | 'fortime' | 'intervals';
export const BLOCK_FORMATS: readonly BlockFormat[] = ['amrap', 'emom', 'fortime', 'intervals'];

export interface BlockSpec {
  fmt: BlockFormat;
  /** AMRAP length, or the optional time cap of For time (seconds). */
  capSec?: number;
  /** EMOM: the interval (seconds, default 60). */
  everySec?: number;
  /** EMOM: number of intervals; intervals: number of rounds. */
  rounds?: number;
  /** Intervals: work and rest seconds of one round. */
  workSec?: number;
  restSec?: number;
  /** For time: reps per round (21-15-9). */
  scheme?: number[];
  /** AMRAP: the rounds the person aims for. */
  targetRounds?: number;
}

export const SPEC_LIMITS = {
  maxSec: 3 * 3600,
  maxRounds: 99,
  minSec: 5,
} as const;

/** A running (or paused) block: timestamps only. */
export interface BlockRun {
  startedAt: number;
  /** Milliseconds spent paused before the current pause (if any). */
  pausedMs: number;
  /** When the current pause began; null while running. */
  pausedAt: number | null;
  /** Set once the block ended (cap reached, or the person finished For time). */
  finishedAt?: number | null;
}

/** Milliseconds of work done: wall time minus pauses, never negative, frozen while paused or finished. */
export function elapsedMs(run: BlockRun, now: number): number {
  const end = run.finishedAt ?? run.pausedAt ?? now;
  return Math.max(0, end - run.startedAt - run.pausedMs);
}

export function startRun(now: number): BlockRun {
  return { startedAt: now, pausedMs: 0, pausedAt: null };
}
export function pauseRun(run: BlockRun, now: number): BlockRun {
  return run.pausedAt != null || run.finishedAt != null ? run : { ...run, pausedAt: now };
}
export function resumeRun(run: BlockRun, now: number): BlockRun {
  return run.pausedAt == null
    ? run
    : { ...run, pausedMs: run.pausedMs + Math.max(0, now - run.pausedAt), pausedAt: null };
}
export function finishRun(run: BlockRun, now: number): BlockRun {
  const r = resumeRun(run, now);
  return r.finishedAt != null ? r : { ...r, finishedAt: now };
}

/** Is the spec well formed for its format (the editor refuses to save otherwise)? */
export function validateSpec(s: BlockSpec): boolean {
  const sec = (n: number | undefined, min: number = SPEC_LIMITS.minSec) =>
    n != null && Number.isFinite(n) && n >= min && n <= SPEC_LIMITS.maxSec;
  const rounds = (n: number | undefined) =>
    n != null && Number.isInteger(n) && n >= 1 && n <= SPEC_LIMITS.maxRounds;
  switch (s.fmt) {
    case 'amrap':
      return sec(s.capSec);
    case 'emom':
      return (
        sec(s.everySec ?? 60) &&
        rounds(s.rounds) &&
        (s.everySec ?? 60) * (s.rounds ?? 0) <= SPEC_LIMITS.maxSec
      );
    case 'fortime':
      return (
        (s.capSec == null || sec(s.capSec)) &&
        (s.scheme == null ||
          (s.scheme.length > 0 && s.scheme.every((n) => Number.isInteger(n) && n >= 1 && n <= 999)))
      );
    case 'intervals':
      return (
        sec(s.workSec, 1) &&
        (s.restSec == null || (s.restSec >= 0 && s.restSec <= SPEC_LIMITS.maxSec)) &&
        rounds(s.rounds)
      );
    default:
      return false;
  }
}

/** Total length in seconds, or null when open-ended (For time without a cap). Drives the end of the clock and the audio cues. */
export function blockCapSec(s: BlockSpec): number | null {
  switch (s.fmt) {
    case 'amrap':
      return s.capSec ?? null;
    case 'emom':
      return (s.everySec ?? 60) * (s.rounds ?? 0);
    case 'fortime':
      return s.capSec ?? null;
    case 'intervals': {
      const work = s.workSec ?? 0;
      const rest = s.restSec ?? 0;
      const n = s.rounds ?? 0;
      return n * (work + rest) - rest; // no rest after the last round
    }
    default:
      return null;
  }
}

export type BlockView =
  | { fmt: 'amrap'; remainSec: number; pct: number; done: boolean }
  | { fmt: 'emom'; remainSec: number; pct: number; minute: number; total: number; done: boolean }
  | { fmt: 'fortime'; elapsedSec: number; capPct: number | null; done: boolean }
  | {
      fmt: 'intervals';
      remainSec: number;
      pct: number;
      phase: 'work' | 'rest';
      round: number;
      total: number;
      done: boolean;
    };

const pctOf = (part: number, whole: number) =>
  whole > 0 ? Math.max(0, Math.min(100, (part / whole) * 100)) : 0;

/** What the clock shows `elapsedSec` seconds into the block. */
export function blockView(s: BlockSpec, elapsedSec: number): BlockView {
  const e = Math.max(0, elapsedSec);
  switch (s.fmt) {
    case 'amrap': {
      const cap = s.capSec ?? 0;
      const remain = Math.max(0, cap - e);
      return {
        fmt: 'amrap',
        remainSec: Math.ceil(remain),
        pct: pctOf(remain, cap),
        done: remain <= 0,
      };
    }
    case 'emom': {
      const every = s.everySec ?? 60;
      const total = s.rounds ?? 0;
      const done = e >= every * total;
      const idx = Math.min(total - 1, Math.floor(e / every));
      const into = e - idx * every;
      const remain = done ? 0 : Math.max(0, every - into);
      return {
        fmt: 'emom',
        remainSec: Math.ceil(remain),
        pct: pctOf(remain, every),
        minute: Math.max(1, idx + 1),
        total,
        done,
      };
    }
    case 'fortime': {
      const cap = s.capSec ?? null;
      return {
        fmt: 'fortime',
        elapsedSec: Math.floor(e),
        capPct: cap == null ? null : pctOf(e, cap),
        done: cap != null && e >= cap,
      };
    }
    case 'intervals': {
      const work = s.workSec ?? 0;
      const rest = s.restSec ?? 0;
      const total = s.rounds ?? 0;
      const cycle = work + rest;
      const length = total * cycle - rest;
      const done = e >= length;
      const idx = Math.min(total - 1, Math.floor(e / cycle));
      const into = e - idx * cycle;
      const phase = into < work ? 'work' : 'rest';
      const left = done ? 0 : phase === 'work' ? work - into : cycle - into;
      return {
        fmt: 'intervals',
        remainSec: Math.ceil(left),
        pct: pctOf(left, phase === 'work' ? work : rest),
        phase: done ? 'rest' : phase,
        round: Math.max(1, idx + 1),
        total,
        done,
      };
    }
    default:
      throw new Error('unknown block format');
  }
}

/** Whole seconds left in the block (the number the audio cues follow), or null for an open-ended block. */
export function blockRemainSec(s: BlockSpec, elapsedSec: number): number | null {
  const cap = blockCapSec(s);
  return cap == null ? null : Math.max(0, Math.ceil(cap - Math.max(0, elapsedSec)));
}

/** One exercise of a block: a name and the reps (or time) per round, as text ("5", "40 s"). */
export interface BlockMember {
  name: string;
  reps?: string;
}

/** What was achieved. AMRAP / intervals / EMOM: rounds + extra reps. For time: the time it took. */
export interface BlockResult {
  rounds?: number;
  extraReps?: number;
  timeSec?: number;
  /** AMRAP/EMOM/intervals: the time ran out; For time: the cap stopped it. */
  capHit?: boolean;
  scaled?: boolean;
  /** Optional "what you actually did": reps per member index when it differs from the plan. Absent = as planned. */
  actuals?: Record<number, number>;
  savedAt: number;
}

/**
 * A time block inside a session (stored on the sealed session, `Workout.blocks`). Self-contained: the members are names, not
 * session exercises, so the block never touches the strength sets, volume or muscle maths.
 */
export interface WorkoutBlock {
  id: string;
  spec: BlockSpec;
  members: BlockMember[];
  /** Where it sits among the session's exercises: n - 0.5 means "after the n-th exercise" (see `blockOrder`). */
  position: number;
  run?: BlockRun;
  /** AMRAP / For time: rounds counted so far with the Round button. */
  roundsDone?: number;
  result?: BlockResult;
}

export type BlockStatus = 'ready' | 'running' | 'paused' | 'ended' | 'logged';

export function blockStatus(b: WorkoutBlock): BlockStatus {
  if (b.result) return 'logged';
  if (!b.run) return 'ready';
  if (b.run.finishedAt != null) return 'ended';
  return b.run.pausedAt != null ? 'paused' : 'running';
}

let seq = 0;
export function newBlockId(now: number): string {
  seq += 1;
  return `blk-${now.toString(36)}-${seq.toString(36)}`;
}

/** Blocks, in the order they sit among `exerciseCount` exercises. */
export function blockOrder(blocks: readonly WorkoutBlock[]): WorkoutBlock[] {
  return [...blocks].sort((a, b) => a.position - b.position);
}

/** Is a result worth saving (something was achieved)? Rounds/time of zero with no extra reps is not. */
export function resultHasData(r: BlockResult | undefined): boolean {
  return !!r && ((r.rounds ?? 0) > 0 || (r.extraReps ?? 0) > 0 || (r.timeSec ?? 0) > 0);
}

/** Starting values for the result sheet, from how the block went. */
export function suggestResult(b: WorkoutBlock, elapsedSec: number, now: number): BlockResult {
  const view = blockView(b.spec, elapsedSec);
  if (b.spec.fmt === 'fortime') {
    return { timeSec: Math.floor(elapsedSec), capHit: view.done, savedAt: now };
  }
  const total = b.spec.fmt === 'emom' || b.spec.fmt === 'intervals' ? (b.spec.rounds ?? 0) : null;
  return {
    rounds: total ?? b.roundsDone ?? 0,
    extraReps: 0,
    capHit: view.done,
    savedAt: now,
  };
}
