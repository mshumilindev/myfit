/**
 * Periodization is a module of Advanced training (SPO-609): everything it draws (the cycle block of the editor, the load and rep
 * fields, the Maxes page and its More row) sits in its own lazy chunk (`periodization/`), fetched only while it is installed.
 * The core keeps this stub: the gate and a host the chunk fills when it arrives (`provide` at boot, the facade pattern of Planner).
 * Until then, and whenever the module is not installed, the host is empty and the core shows nothing of it. The rules that other
 * code reads (which week, which kilograms) are in `views/programs/cycle.ts`, gated at the source.
 */
import { useSyncExternalStore, type ComponentType } from 'react';
import { usePeriodizationOn } from './addons/featureGates';
import type { LocaleId } from './i18n';
import type { MoreMenuItem } from './components/ui/MoreMenu';
import { isTrackerReady, onTrackerReady } from './trackerRt';

export interface PeriodizationHost {
  /** The Maxes page (an overlay of Gym). */
  MaxesPage: ComponentType<{ onClose: () => void }> | null;
  /** The one plain row in More. */
  moreItem: ((locale: LocaleId, open: () => void) => MoreMenuItem) | null;
  /** The person's max for an exercise in kg (typed, else the estimate from history); null when there is none. */
  maxFor: ((exerciseName: string) => number | null) | null;
}

export const periodizationHost: PeriodizationHost = {
  MaxesPage: null,
  moreItem: null,
  maxFor: null,
};

/** The host once the chunk is loaded, and only while Periodization is installed; otherwise null (nothing shows). */
export function usePeriodizationHost(): PeriodizationHost | null {
  const on = usePeriodizationOn();
  const ready = useSyncExternalStore(
    (cb) => onTrackerReady((id) => id === 'periodization' && cb()),
    () => isTrackerReady('periodization'),
  );
  return on && ready ? periodizationHost : null;
}

/** The person's max for an exercise, or null: always null while the module is off or its chunk has not loaded. */
export function maxForExercise(name: string): number | null {
  return periodizationHost.maxFor?.(name) ?? null;
}
