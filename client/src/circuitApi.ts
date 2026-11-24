/**
 * The seam between the core and Circuit (Advanced training): rounds over a group of exercises. The core keeps no circuit screen:
 * the block, its run sheet and their words live in the lazy chunk `circuit/` and arrive through `circuitHost` when it loads
 * (`circuit/circuitBoot.ts`). While the module is off (or its chunk has not arrived) a stored circuit reads as separate exercises
 * in order, with no rounds or round counter, and the group stays stored. Imports stay light (types and the gate).
 */
import type { ComponentType } from 'react';
import { circuitAvailable } from './addons/featureGates';
import type { MuscleGroup } from './data/exercises';
import type { SupersetGroup } from './supersetTypes';
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

/** The small controls the session shows around circuits: the start shortcut, the "adding" banner, the setting, the "new circuit" button. */
export interface CircuitControlsHost {
  /** The empty-session shortcut: start a circuit. */
  Shortcut: ComponentType<{ onStart: () => void }>;
  /** The banner while exercises are being added to a circuit. */
  Banner: ComponentType<{ letter: string; count: number; onDone: () => void }>;
  /** The session-settings switch that turns circuit building on and off. */
  Setting: ComponentType<{ on: boolean; onToggle: () => void }>;
  /** The button under the list that starts another circuit. */
  NewButton: ComponentType<{ letter: string; onNew: () => void }>;
}

export interface CircuitHost {
  /** The controls around circuits (shortcut, banner, setting, new-circuit button). */
  Controls: CircuitControlsHost | null;
  /** One circuit in the session list (rounds, progress, the exercises of the round). */
  Block: ComponentType<CircuitBlockProps> | null;
  /** The sheet that runs a circuit round by round. */
  RunSheet: ComponentType<CircuitRunSheetProps> | null;
}

export const circuitHost: CircuitHost = { Block: null, RunSheet: null, Controls: null };

/** Is the module installed AND its chunk loaded? */
export function circuitLive(): boolean {
  return circuitAvailable() && circuitHost.Block !== null && circuitHost.Controls !== null;
}
