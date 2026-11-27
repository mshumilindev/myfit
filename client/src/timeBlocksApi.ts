/**
 * The seam between the core and Time blocks (Advanced training): timed blocks of exercises (AMRAP, EMOM, For time, intervals).
 * The core keeps no block screen: the get-ready countdown (and, step by step, the editor, clock and result) live in the lazy
 * chunk `timeBlocks/` and arrive through `timeBlocksHost` when it loads (`timeBlocks/timeBlocksBoot.ts`). While the module is
 * off (or its chunk has not arrived) a stored block reads as its exercises in order, with no clock, and the data stays.
 * Imports stay light (types and the gate).
 */
import type { ComponentType } from 'react';
import { timeBlocksAvailable } from './addons/featureGates';
import type { Exercise, Workout } from './types';
import type { ProgramBlockMember, ProgramBlockSpec } from './views/programs/programBlocks';
import type { DayBlocksSlotProps } from './tools/programEditor';
import type { BlockSpec, WorkoutBlock } from './timeBlocks/model';

export interface BlockCountdownHostProps {
  spec: BlockSpec;
  prefs: { sound: boolean; vibrate: boolean };
  onStart: () => void;
  onClose: () => void;
  onCancel: () => void;
}

export interface TimeBlocksHost {
  /** The full-screen get-ready countdown before a block starts. */
  Countdown: ComponentType<BlockCountdownHostProps> | null;
  /** The blocks of one session: cards, the builder, the clock and the result. */
  Blocks: ComponentType<{
    workoutId: string;
    past: boolean;
    /** undefined: every block as a card (classic list). null: only the clock engine (no card). id: that block's card (a focus step). */
    focusId?: string | null;
    onInfo?: (name: string) => void;
    /** Opens the block builder each time this number goes up (Start tile, the picker's Time block entry). */
    newSignal?: number;
    intake?: Exercise | null;
    onIntakeDone?: (moved?: { text: string; undo: () => void }) => void;
  }> | null;
  /** The day's blocks inside a plan card (Today's program card), read-only. */
  PlanBlocks: ComponentType<{
    blocks: readonly {
      id: string;
      spec: ProgramBlockSpec;
      members: readonly ProgramBlockMember[];
    }[];
  }> | null;
  /** The time blocks of one program day in the program editor (its `dayBlocks` slot). */
  DayBlocks: ComponentType<DayBlocksSlotProps> | null;
  /** Short language-neutral name of a block for the "Next · …" button. */
  stepLabel: ((b: WorkoutBlock) => string) | null;
  /** The "Time block…" row label (a component: it follows the language) of the exercise options, in the current language. */
  RowLabel: ComponentType | null;
  /** Progress › Volume: what the logged blocks of these sessions add up to (nothing when there are none). */
  Conditioning: ComponentType<{ workouts: readonly Workout[] }> | null;
  /** Read-only list of a finished session's blocks (the trainer's view of a client's session). */
  Recap: ComponentType<{ workout: Workout }> | null;
}

export const timeBlocksHost: TimeBlocksHost = {
  Countdown: null,
  Blocks: null,
  Recap: null,
  Conditioning: null,
  DayBlocks: null,
  PlanBlocks: null,
  stepLabel: null,
  RowLabel: null,
};

/** Is the module installed AND its chunk loaded? */
export function timeBlocksLive(): boolean {
  return (
    timeBlocksAvailable() && timeBlocksHost.Countdown !== null && timeBlocksHost.Blocks !== null
  );
}
