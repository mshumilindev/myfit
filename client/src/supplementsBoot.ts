/**
 * Loads the supplements modules (they provide their functions into the `supplementsRt` facade at import time) and tells the
 * store to re-normalise its copy. Imported lazily by the add-on runtime while Supplements is installed (SPO-500 I8).
 */
import {
  emptySupplementState,
  normalizeSupplements,
  normalizeSupplementEntry,
  normalizeSupplementCheckins,
  isSupplementSharing,
  supplementEffectsFor,
  supplementProteinGramsFor,
  supplementWarnings,
  pendingSupplementCheckin,
  usualTrainingStartMin,
  trainingDayResolver,
} from './supplements';
import { supplementsCoachView } from './supplementsShare';
import { sup } from './supplementsRt';
import { provide, trackerReady } from './trackerRt';

provide(sup, {
  empty: emptySupplementState,
  normalize: normalizeSupplements,
  normalizeEntry: normalizeSupplementEntry,
  normalizeCheckins: normalizeSupplementCheckins,
  isSharing: isSupplementSharing,
  effectsFor: supplementEffectsFor,
  proteinGramsFor: supplementProteinGramsFor,
  warnings: supplementWarnings,
  pending: pendingSupplementCheckin,
  usualStartMin: usualTrainingStartMin,
  trainingDayResolver,
  coachView: supplementsCoachView,
});

trackerReady('supplements');
