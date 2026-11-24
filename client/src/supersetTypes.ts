/** The shapes of a session's groups (types only), so the circuit seam can name them without importing the grouping code. */
import type { Exercise } from './types';

export interface SupersetGroup {
  groupId: string;
  letter: string;
  exercises: Exercise[];
  /** A round-based circuit (F3) vs a plain back-to-back superset. */
  circuit: boolean;
}
export type SessionBlock =
  { kind: 'single'; exercise: Exercise } | { kind: 'group'; group: SupersetGroup };
