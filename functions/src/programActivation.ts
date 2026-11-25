/**
 * What `setProgramStatus` does when a member activates one of their own programs (pure, so it is tested without Firestore).
 *
 * - `noop`: the program is already the member's active one: nothing is written, so a repeated "Start" never resets the
 *   progress (`assignments/{uid}.startedAt`).
 * - `blocked`: a trainer's program is active for the member, so it cannot be replaced by their own (the member's wish
 *   never overrides the trainer's plan). A stale assignment (the program is gone or not active, the assigner is gone or no
 *   longer the member's trainer) does not block: it would otherwise lock the member out for good.
 * - `apply`: archive the member's other active programs and make this one the active assignment.
 */
export interface ActivationInput {
  uid: string;
  programId: string;
  programStatus: string;
  /** The member's trainer (users/{uid}.trainerId), if any. */
  trainerId?: string | null;
  assignment: { programId: string; assignedBy: string } | null;
  /** Status of the program the current assignment points at; null = it does not exist. */
  assignedProgramStatus: string | null;
  /** Role of the user who made the current assignment; null = that user does not exist. */
  assignerRole: string | null;
  /** Only catalog programs (Train like a pro) are refused over a trainer's program; ordinary programs keep the old behaviour. */
  protectTrainer: boolean;
}

export type ActivationPlan = 'noop' | 'blocked' | 'apply';

export function planActivation(i: ActivationInput): ActivationPlan {
  const a = i.assignment;
  if (a && a.programId === i.programId && i.programStatus === 'active') return 'noop';
  if (
    i.protectTrainer &&
    a &&
    a.assignedBy !== i.uid &&
    i.assignedProgramStatus === 'active' &&
    i.assignerRole !== null &&
    (i.assignerRole === 'admin' || i.trainerId === a.assignedBy)
  )
    return 'blocked';
  return 'apply';
}
