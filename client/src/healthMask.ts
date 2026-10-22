/**
 * What the app may see of the health features (SPO-290). Pure. A feature without consent is OFF: the stored data is not
 * shown or processed, so every reader of the store gets the empty value of that feature instead of the stored one. The
 * data is not touched (it is deleted only when the person asks); writers keep the raw state.
 */
import type { HealthOnMap } from './data/healthConsentGate';
import { emptyCycleState } from './cycle/cycleState';
import { emptyNicotineState } from './nicotine';
import { emptyAlcoholState } from './alcohol';
import { emptySupplementState } from './supplements';
import type {
  AlcoholState,
  ChronicCondition,
  Injury,
  NicotineState,
  SupplementState,
} from './types';
import type { CycleState } from './cycle/cycleState';

/** One shared empty value per feature, so an unchanged mask keeps its references (no needless re-render). */
const EMPTY = {
  nicotine: emptyNicotineState(),
  cycle: emptyCycleState(),
  alcohol: emptyAlcoholState(),
  supplements: emptySupplementState(),
  injuries: [] as Injury[],
  conditions: [] as ChronicCondition[],
};

/** The six features the main store holds (its own `StoreState` is not imported: that would be a cycle). */
interface Masked {
  injuries: Injury[];
  conditions: ChronicCondition[];
  nicotine: NicotineState;
  cycle: CycleState;
  alcohol: AlcoholState;
  supplements: SupplementState;
}

/** The state with every feature that is off replaced by its empty value; the same object when all are on. */
export function maskHealth<S extends Masked>(raw: S, on: HealthOnMap): S {
  const patch: Partial<Masked> = {};
  if (!on.injuries) patch.injuries = EMPTY.injuries;
  if (!on.chronic) patch.conditions = EMPTY.conditions;
  if (!on.nicotine) patch.nicotine = EMPTY.nicotine;
  if (!on.cycle) patch.cycle = EMPTY.cycle;
  if (!on.alcohol) patch.alcohol = EMPTY.alcohol;
  if (!on.supplements) patch.supplements = EMPTY.supplements;
  return Object.keys(patch).length === 0 ? raw : { ...raw, ...patch };
}
