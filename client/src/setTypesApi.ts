/**
 * The seam between the core and Set types (Advanced training): drop sets, reverse drops and weighted static holds. The core
 * keeps no editor for them: the drop-part editor and its words live in the lazy chunk `setTypes/` and arrive through
 * `setTypesHost` when it loads (`setTypes/setTypesBoot.ts`). While the module is off (or its chunk has not arrived) a set is a
 * working or a warm-up set: nothing offers, continues or draws a technique, a stored drop / reverse / hold set reads as a plain
 * working set, and its data (type, drop parts, hold time) passes through a save untouched, so it comes back on re-install.
 * Imports stay light (types and the gate) so core modules can use this file.
 */
import type { ComponentType, ReactNode } from 'react';
import { setTypesAvailable } from './addons/featureGates';
import type { DropEntry, SetType } from './types';

export interface DropBodyProps {
  type: 'drop' | 'reverse-drop';
  /** The first part (the set itself). */
  reps: number;
  /** The first part's weight in kg; null = bodyweight. */
  weight: number | null;
  drops: DropEntry[];
  setDrops: (next: (list: DropEntry[]) => DropEntry[]) => void;
  /** The set editor's own stepper pair for one part (so the parts look like the rest of the sheet). */
  steppers: (
    reps: number,
    weight: number | null,
    onReps: (n: number) => void,
    onWeight: (n: number) => void,
    focus: 'reps' | 'weight' | null,
  ) => ReactNode;
  /** Steppers for the first part (the set's own reps and weight). */
  firstPart: ReactNode;
}

export interface SetTypesHost {
  /** The parts editor of a drop / reverse-drop set. */
  DropBody: ComponentType<DropBodyProps> | null;
  /** The note under the set-type list. */
  TypeNote: ComponentType | null;
}

export const setTypesHost: SetTypesHost = { DropBody: null, TypeNote: null };

const EXTRA: ReadonlySet<SetType> = new Set<SetType>(['drop', 'reverse-drop', 'static-dynamic']);

/** Is the module installed AND its chunk loaded? */
export function setTypesLive(): boolean {
  return setTypesAvailable() && setTypesHost.DropBody !== null;
}

/** Is `type` one of the module's (not working / warm-up)? */
export const isExtraSetType = (type: SetType): boolean => EXTRA.has(type);

/** May the person pick this type for a new set? */
export function setTypeOffered(type: SetType): boolean {
  return !EXTRA.has(type) || setTypesLive();
}

/**
 * Is a stored set of this type shown as a plain working set? True for the module's types while it is off. A hold move
 * (a plank on the stopwatch, Home sets) is a hold whatever the module says, so it passes `holdMove`.
 */
export function setTypeHidden(type: SetType, holdMove = false): boolean {
  if (!EXTRA.has(type) || setTypesLive()) return false;
  return !(type === 'static-dynamic' && holdMove);
}

/** The type the screens draw: the stored one, or `working` while the module hides it. */
export function shownSetType(type: SetType, holdMove = false): SetType {
  return setTypeHidden(type, holdMove) ? 'working' : type;
}
