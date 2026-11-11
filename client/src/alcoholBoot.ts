/**
 * Loads every alcohol module (they provide their functions into the `alcoholRt` facade at import time) and tells the store
 * to re-normalise its copy. Imported lazily by the add-on runtime while Alcohol is installed (SPO-500 I8).
 */
import {
  emptyAlcoholState,
  normalizeAlcohol,
  normalizeAlcoholEntry,
  alcoholLoad,
  alcoholEffects,
  alcoholEffectsFor,
  alcoholWeekActual,
  pendingAlcoholCheckin,
  dayKey,
  surfaceOn,
  usualOccasionGrams,
  normalizeCheckins,
  cleanUsualDays,
  isAlcoholSharing,
} from './alcohol';
import { isAlcoholRegion, resolveAlcoholRegion } from './alcoholRegion';
import { alcoholCoachView } from './alcoholShare';
import { alc } from './alcoholRt';
import { provide, trackerReady } from './trackerRt';

provide(alc, {
  empty: emptyAlcoholState,
  normalize: normalizeAlcohol,
  normalizeEntry: normalizeAlcoholEntry,
  load: alcoholLoad,
  effects: alcoholEffects,
  effectsFor: alcoholEffectsFor,
  weekActual: alcoholWeekActual,
  pending: pendingAlcoholCheckin,
  dayKey,
  surfaceOn,
  usualGrams: usualOccasionGrams,
  normalizeCheckins,
  cleanUsualDays,
  isSharing: isAlcoholSharing,
  isRegion: isAlcoholRegion,
  resolveRegion: resolveAlcoholRegion,
  coachView: alcoholCoachView,
});

trackerReady('alcohol');
