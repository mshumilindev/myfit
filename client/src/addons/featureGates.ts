/**
 * Goals and Playbook are add-ons. Goals: without it every reader of the store sees empty goals (store.ts `exposed()`), the
 * stored goals stay and come back on re-install. Playbook is computed from the history, so it is only a gate on its screens,
 * tiles, nudge, widget and suggestions. One gate each; screens ask it, they do not re-implement it.
 */
import {
  addonAvailable,
  isAddonAllowed,
  isAddonEnabled,
  useAddonOrBase,
  useEnabledAddons,
} from './enabledSet';
import { getRole } from '../api';

/** Pure code (no hook): true while Goals is installed or not offered to this role. Never throws (a storage error = off: a hard guard). */
export function goalsAvailable(): boolean {
  try {
    return addonAvailable('goals');
  } catch {
    return false;
  }
}

/** Sleep: without it every reader of the store sees no nights (store.ts `exposed()`), so no model or card uses them. */
export function sleepAvailable(): boolean {
  try {
    return addonAvailable('sleep');
  } catch {
    return false;
  }
}

/** Atlas: without it every reader of the store sees Atlas as off (store.ts `exposed()`), so none of its UI or voice shows. */
export function atlasAvailable(): boolean {
  try {
    return addonAvailable('atlas');
  } catch {
    return false;
  }
}

/** Playbook: without it nothing reads the learned plays (`computePlaybook` checks it itself); screens use `usePlaybookOn`. */
export function playbookAvailable(): boolean {
  try {
    return addonAvailable('playbook');
  } catch {
    return false;
  }
}

/**
 * Planner: the whole feature (screens, More row, widgets, reminders, trainer availability) sits in a lazy chunk that loads only
 * while it is installed; the core keeps nothing but this gate. Its data stays stored and comes back on re-install.
 */
export function plannerAvailable(): boolean {
  try {
    return addonAvailable('planner');
  } catch {
    return false;
  }
}

/**
 * Train like a pro (the catalog of programs well-known lifters followed): its screens and data sit in a lazy chunk that loads only
 * while it is installed; the core keeps this gate and a host the chunk fills. Programs a person already started stay theirs.
 * Every role that has Gym (member, trainer, admin), and only when installed: a role the store does not offer it to (manager) never gets it.
 */
export function trainLikeAProAvailable(): boolean {
  try {
    return isAddonEnabled('train-like-a-pro', getRole());
  } catch {
    return false;
  }
}

/** The same Train like a pro gate for components. */
export function useTrainLikeAProOn(): boolean {
  const installed = useEnabledAddons().has('train-like-a-pro');
  return installed && isAddonAllowed('train-like-a-pro', getRole());
}

/** Apex ranks (standards tiers): without the module nothing derives a rank or tier, not even inside other widgets. */
export function apexRanksAvailable(): boolean {
  try {
    return addonAvailable('apex-ranks');
  } catch {
    return false;
  }
}

export function useGoalsOn(): boolean {
  return useAddonOrBase('goals');
}

export function usePlaybookOn(): boolean {
  return useAddonOrBase('playbook');
}

/** Planner's Availability module (off until the person switches it on): free hours, the Availability screen and sharing with a trainer. */
export function plannerAvailabilityAvailable(): boolean {
  try {
    return addonAvailable('planner-availability');
  } catch {
    return false;
  }
}

/** The same Availability gate for components. */
export function usePlannerAvailabilityOn(): boolean {
  return useAddonOrBase('planner-availability');
}

/** The same Planner gate for components. */
export function usePlannerOn(): boolean {
  return useAddonOrBase('planner');
}

/** Advanced training (the pro tools of Gym): without it the base Gym shows and counts none of them. */
export function advancedTrainingAvailable(): boolean {
  try {
    return addonAvailable('advanced-training');
  } catch {
    return false;
  }
}

/** The same Advanced training gate for components. */
export function useAdvancedTrainingOn(): boolean {
  return useAddonOrBase('advanced-training');
}

/**
 * Periodization (weekly cycles, % of max, rep ranges, Maxes): without it every week of a program is the same, loads stay in kg
 * and nothing of it is drawn. The stored cycles and maxes stay and come back on re-install.
 */
export function periodizationAvailable(): boolean {
  try {
    return addonAvailable('periodization');
  } catch {
    return false;
  }
}

/** The same Periodization gate for components. */
export function usePeriodizationOn(): boolean {
  return useAddonOrBase('periodization');
}

/**
 * Fatigue (per-muscle fatigue, stalled-muscle and deload hints): without it nothing about muscle fatigue is drawn or suggested; stored sets stay.
 */
export function fatigueAvailable(): boolean {
  try {
    return addonAvailable('fatigue');
  } catch {
    return false;
  }
}

/** The same gate for components. */
export function useFatigueOn(): boolean {
  return useAddonOrBase('fatigue');
}

/**
 * Readiness (per-muscle readiness, session readiness score and its effect on suggestions): without it nothing about readiness is drawn and its numbers take the neutral value of an empty history.
 */
export function readinessAvailable(): boolean {
  try {
    return addonAvailable('readiness');
  } catch {
    return false;
  }
}

/** The same gate for components. */
export function useReadinessOn(): boolean {
  return useAddonOrBase('readiness');
}

/**
 * Muscle map (the body map coloured by fatigue and readiness): without it the map is not drawn.
 */
export function muscleMapAvailable(): boolean {
  try {
    return addonAvailable('muscle-map');
  } catch {
    return false;
  }
}

/** The same gate for components. */
export function useMuscleMapOn(): boolean {
  return useAddonOrBase('muscle-map');
}

/**
 * Equipment (gym inventory, equipment cards, picker and filter chips, badges): without it nothing about equipment is asked or
 * shown, and every exercise counts as available in every gym. Stored inventories and exercise equipment stay and come back.
 */
export function equipmentAvailable(): boolean {
  try {
    return addonAvailable('equipment');
  } catch {
    return false;
  }
}

/** The same Equipment gate for components. */
export function useEquipmentOn(): boolean {
  return useAddonOrBase('equipment');
}

/**
 * Supersets (two or more exercises done back to back): without it every stored group reads as separate exercises in order, no
 * pairing is offered and the rest timer treats each exercise on its own. Groups stay stored and come back on re-install.
 */
export function supersetsAvailable(): boolean {
  try {
    return addonAvailable('supersets');
  } catch {
    return false;
  }
}

/** The same Supersets gate for components. */
export function useSupersetsOn(): boolean {
  return useAddonOrBase('supersets');
}

/**
 * Circuit (rounds over a group of exercises): without it a stored circuit reads as separate exercises in order, with no rounds
 * or round counter, and no circuit can be started. The data stays and comes back on re-install.
 */
export function circuitAvailable(): boolean {
  try {
    return addonAvailable('circuit');
  } catch {
    return false;
  }
}

/** The same Circuit gate for components. */
export function useCircuitOn(): boolean {
  return useAddonOrBase('circuit');
}

/**
 * RPE / RIR (effort entry): without it a set has no effort chips, hint, estimate pill or effort column, and nothing of it is
 * asked. The app's own effort estimate keeps working underneath (rest, failure and signals read it), and stored values stay.
 */
export function effortAvailable(): boolean {
  try {
    return addonAvailable('effort');
  } catch {
    return false;
  }
}

/** The same RPE / RIR gate for components. */
export function useEffortOn(): boolean {
  return useAddonOrBase('effort');
}

/**
 * Set types (drop, reverse drop, weighted static hold): without it a set is a working or a warm-up set, no technique is offered
 * or continued, and nothing of it is drawn. Stored sets of these types keep their data and come back on re-install.
 */
export function setTypesAvailable(): boolean {
  try {
    return addonAvailable('set-types');
  } catch {
    return false;
  }
}

/** The same Set types gate for components. */
export function useSetTypesOn(): boolean {
  return useAddonOrBase('set-types');
}
