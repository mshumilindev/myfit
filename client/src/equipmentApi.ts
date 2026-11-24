/**
 * The seam between the core and Equipment (Advanced training): the gym's equipment inventory board and the per-exercise
 * equipment picker. The core keeps neither screen: they live in components/ and arrive through `equipmentHost` when the lazy chunk
 * `equipment/` loads (`equipment/equipmentBoot.ts`). While the module is off (or its chunk has not arrived) nothing about equipment
 * is offered, every exercise counts as available in every gym, and the stored inventories stay untouched.
 * Imports stay light (types and the gate).
 */
import type { ComponentType } from 'react';
import type { SnackState } from './ui';
import { equipmentAvailable } from './addons/featureGates';
import type { Exercise, Gym } from './types';

/** The slice of the app shell the board uses (the real Shell fits it; importing the app here would be a cycle). */
export interface EquipmentShell {
  openOverlay: (o: { screen: 'equipment'; itemId: string; gymId?: string }) => void;
  snack: (s: SnackState) => void;
}

export interface EquipmentBoardProps {
  gym: Gym;
  shell: EquipmentShell;
}

export interface EquipmentPickerSheetProps {
  workoutId: string;
  exercise: Exercise;
  gym: Gym | null;
  onClose: () => void;
}

export interface BandLibraryProps {
  gym: Gym;
  /** Start from the defaults the set editor shows when the gym has no library. */
  seedDefaults?: boolean;
  onSaved?: () => void;
}

export interface EquipmentHost {
  /** The inventory board on the gym page. */
  Board: ComponentType<EquipmentBoardProps> | null;
  /** The sheet that picks the equipment an exercise was done on. */
  PickerSheet: ComponentType<EquipmentPickerSheetProps> | null;
  /** The gym's resistance-band library (colour → kg), on the gym page and in the set editor. */
  BandLibrary: ComponentType<BandLibraryProps> | null;
}

export const equipmentHost: EquipmentHost = { Board: null, PickerSheet: null, BandLibrary: null };

/** Is the module installed AND its chunk loaded? */
export function equipmentLive(): boolean {
  return equipmentAvailable() && equipmentHost.Board !== null;
}
