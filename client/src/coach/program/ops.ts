/**
 * Draft operations for the Coach: the immutable operations live in the program editor tool
 * (`tools/programEditor/model/ops`); these are the same functions typed on the Coach `Program` and bound to the Coach
 * catalog, so the store, the port and the tests keep their signatures.
 */
import {
  addBareExercise as toolAddBare,
  swapExercise as toolSwap,
} from '../../tools/programEditor';
import type { Program } from '../../views/programs/model';
import { coachCatalog } from './toolHostBase';

export {
  DEFAULT_REPS,
  DEFAULT_SETS,
  addMarker,
  diffPrograms,
  forWrite,
  importDay,
  setEquipment,
  setRowMode,
  startDay,
  type Change,
  type WithMemory,
} from '../../tools/programEditor';

/** Added from the library: just the exercise (R-FE-051). The new row's id is returned for selection. */
export const addBareExercise = (
  p: Program,
  day: number,
  name: string,
): { program: Program; id: string } => toolAddBare(p, day, name, coachCatalog);

export const swapExercise = (p: Program, id: string, name: string): Program =>
  toolSwap(p, id, name, coachCatalog);
