/** Small pure helpers the Program tab and the assignment card share. They live in the program editor tool; re-exported here. */
export {
  dowOf,
  firstName,
  fmtRest,
  prescriptionLine,
  programSets,
  repsText,
  stripText,
  targetText,
} from '../../tools/programEditor';

/** The few words of the main dictionary the editor reads (muscles, activities, effort); `useT().t` satisfies it. */
export interface MainWords {
  muscleGroups: Record<string, string>;
  actType: Record<string, string>;
  actEffortLevel: Record<string, string>;
}
