/**
 * The seam between the core and Circuit (Advanced training): rounds over a group of exercises. The core keeps no circuit screen:
 * the block, its run sheet and their words live in the lazy chunk `circuit/` and arrive through `circuitHost` when it loads
 * (`circuit/circuitBoot.ts`). While the module is off (or its chunk has not arrived) a stored circuit reads as separate exercises
 * in order, with no rounds or round counter, and the group stays stored. Imports stay light (types and the gate).
 */
import type { ComponentType } from 'react';
import { circuitAvailable } from './addons/featureGates';
import type { MuscleGroup } from './data/exercises';
import type { SupersetGroup } from './supersetBlocks';
import type { Exercise, SetEntry } from './types';

export interface CircuitBlockProps {
  group: SupersetGroup;
  past: boolean;
  onRun: () => void;
  onMuscle: (m: MuscleGroup) => void;
  building?: boolean;
  rounds?: number;
  onAddAnother?: () => void;
  onDoneBuilding?: () => void;
  onRounds?: (delta: number) => void;
  isLast?: boolean;
}

export interface CircuitRunSheetProps {
  group: SupersetGroup;
  onLog: (ex: Exercise, vals: Omit<SetEntry, 'id' | 'position'>) => void;
  onSetRounds: (r: number) => void;
  onClose: () => void;
  onMuscle: (m: MuscleGroup) => void;
}

export interface CircuitHost {
  /** One circuit in the session list (rounds, progress, the exercises of the round). */
  Block: ComponentType<CircuitBlockProps> | null;
  /** The sheet that runs a circuit round by round. */
  RunSheet: ComponentType<CircuitRunSheetProps> | null;
}

export const circuitHost: CircuitHost = { Block: null, RunSheet: null };

/** Is the module installed AND its chunk loaded? */
export function circuitLive(): boolean {
  return circuitAvailable() && circuitHost.Block !== null;
}
