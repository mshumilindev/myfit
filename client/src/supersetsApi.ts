/**
 * The seam between the core and Supersets (Advanced training): exercises done back to back. The core keeps no pairing screen:
 * the "Superset with…" sheet and its words live in the lazy chunk `supersets/` and arrive through `supersetsHost` when it loads
 * (`supersets/supersetsBoot.ts`). While the module is off (or its chunk has not arrived) every stored group reads as separate
 * exercises in order and nothing offers to pair; the groups stay stored. Imports stay light (types and the gate).
 */
import type { ComponentType, ReactNode } from 'react';
import { supersetsAvailable } from './addons/featureGates';
import type { SupersetGroup } from './supersetTypes';
import type { Exercise, Workout } from './types';

export interface SupersetSheetProps {
  workout: Workout;
  base: Exercise;
  onClose: () => void;
  onGroup: (ids: string[]) => void;
}

/** What the session passes to draw one superset in its list: the state it reads, and the actions the session owns. */
export interface SupersetBlockProps {
  group: SupersetGroup;
  workout: Workout;
  past: boolean;
  live: boolean;
  desktop: boolean;
  /** Not started yet: a one-line card under the "queued" label. */
  queued: boolean;
  /** The "queued" label, on the first queued block only. */
  header: ReactNode;
  equipmentOn: boolean;
  focusedId: string | null;
  activeExerciseId: string | null;
  expandedPast: readonly string[];
  /** "3 × 8 · 75 kg" for a finished exercise. */
  summary: (e: Exercise) => string;
  onExpand: (id: string | null) => void;
  onExpandPast: (ids: string[]) => void;
  onMenu: (groupId: string) => void;
  /** One member as the session draws an exercise card. */
  renderCard: (
    e: Exercise,
    ctx: { letter: string; index: number; active: boolean; rounds: number; round: number },
  ) => ReactNode;
}

export interface SupersetsHost {
  /** A superset drawn in the session list (strip, collapsed card, desktop table, queued card). */
  Block: ComponentType<SupersetBlockProps> | null;
  /** The sheet that picks the exercises to pair with one. */
  Sheet: ComponentType<SupersetSheetProps> | null;
}

export const supersetsHost: SupersetsHost = { Sheet: null, Block: null };

/** Is the module installed AND its chunk loaded? */
export function supersetsLive(): boolean {
  return supersetsAvailable() && supersetsHost.Sheet !== null && supersetsHost.Block !== null;
}
