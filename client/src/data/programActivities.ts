/**
 * Writes a program's planned activities (the "Add to program" suggestion and
 * its Undo). Only the member's own program is editable — a trainer's isn't —
 * and only the `activities` field is touched, never the lifting items.
 */
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { currentUid, trackMutation } from '../api';
import { refreshProgramMine, type ProgramAssignment } from './programMine';
import { type ProgramActivity } from '../views/programs/model';
import { activityFields } from '../views/programs/activitiesVault';

/** Is this assigned program one the member wrote (so it can be edited here)? */
export function isOwnProgram(a: ProgramAssignment | null): boolean {
  const uid = currentUid();
  return !!a && !!uid && a.program.authorId === uid;
}

/** Replace the planned activities of the member's own program. */
export async function savePlannedActivities(
  programId: string,
  list: ProgramActivity[],
): Promise<void> {
  const fields = await activityFields(list);
  await trackMutation(
    setDoc(doc(db, 'programs', programId), { ...fields, updatedAt: Date.now() }, { merge: true }),
  );
  refreshProgramMine();
}
