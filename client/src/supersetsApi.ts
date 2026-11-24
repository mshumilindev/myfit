/**
 * The seam between the core and Supersets (Advanced training): exercises done back to back. The core keeps no pairing screen:
 * the "Superset with…" sheet and its words live in the lazy chunk `supersets/` and arrive through `supersetsHost` when it loads
 * (`supersets/supersetsBoot.ts`). While the module is off (or its chunk has not arrived) every stored group reads as separate
 * exercises in order and nothing offers to pair; the groups stay stored. Imports stay light (types and the gate).
 */
import type { ComponentType } from 'react';
import { supersetsAvailable } from './addons/featureGates';
import type { Exercise, Workout } from './types';

export interface SupersetSheetProps {
  workout: Workout;
  base: Exercise;
  onClose: () => void;
  onGroup: (ids: string[]) => void;
}

export interface SupersetsHost {
  /** The sheet that picks the exercises to pair with one. */
  Sheet: ComponentType<SupersetSheetProps> | null;
}

export const supersetsHost: SupersetsHost = { Sheet: null };

/** Is the module installed AND its chunk loaded? */
export function supersetsLive(): boolean {
  return supersetsAvailable() && supersetsHost.Sheet !== null;
}
