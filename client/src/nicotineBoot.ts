/**
 * Loads the nicotine modules (they provide their functions into the `nicotineRt` facade at import time) and tells the store
 * to re-normalise its copy. Imported lazily by the add-on runtime while Nicotine is installed (SPO-500 I8).
 */
import {
  emptyNicotineState,
  normalizeNicotine,
  normalizeNicotineProduct,
  nicotineLoad,
  nicotineEffects,
  isNicotineSharing,
  surfaceOn,
  SURFACE_COEFFS,
} from './nicotine';
import { nicotineCoachView } from './nicotineShare';
import { nic } from './nicotineRt';
import { provide, trackerReady } from './trackerRt';

provide(nic, {
  empty: emptyNicotineState,
  normalize: normalizeNicotine,
  normalizeProduct: normalizeNicotineProduct,
  load: nicotineLoad,
  effects: nicotineEffects,
  isSharing: isNicotineSharing,
  surfaceOn,
  rpeCap: () => SURFACE_COEFFS.rpe.cap,
  coachView: nicotineCoachView,
});

trackerReady('nicotine');
