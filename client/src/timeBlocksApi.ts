/**
 * The seam between the core and Time blocks (Advanced training): timed blocks of exercises (AMRAP, EMOM, For time, intervals).
 * The core keeps no block screen: the get-ready countdown (and, step by step, the editor, clock and result) live in the lazy
 * chunk `timeBlocks/` and arrive through `timeBlocksHost` when it loads (`timeBlocks/timeBlocksBoot.ts`). While the module is
 * off (or its chunk has not arrived) a stored block reads as its exercises in order, with no clock, and the data stays.
 * Imports stay light (types and the gate).
 */
import type { ComponentType } from 'react';
import { timeBlocksAvailable } from './addons/featureGates';
import type { BlockSpec } from './timeBlocks/model';

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
  Blocks: ComponentType<{ workoutId: string; past: boolean }> | null;
}

export const timeBlocksHost: TimeBlocksHost = { Countdown: null, Blocks: null };

/** Is the module installed AND its chunk loaded? */
export function timeBlocksLive(): boolean {
  return (
    timeBlocksAvailable() && timeBlocksHost.Countdown !== null && timeBlocksHost.Blocks !== null
  );
}
