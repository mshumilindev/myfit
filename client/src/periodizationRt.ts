/**
 * Periodization is a module of Advanced training (SPO-609): everything it draws and every rule it applies sits in its own lazy
 * chunk (`periodization/`), fetched only while it is installed. The seam the core calls is `periodizationApi.ts`; this file is
 * the React side: the hook that hands the Maxes page and its More row to the screens once the chunk has arrived.
 */
import { useSyncExternalStore } from 'react';
import { usePeriodizationOn } from './addons/featureGates';
import { registerAddonExport } from './legal/export/addonExport';
import { isTrackerReady, onTrackerReady } from './trackerRt';
import { periodizationHost, type PeriodizationHost } from './periodizationApi';

export { periodizationHost, maxForExercise } from './periodizationApi';
export type { PeriodizationHost } from './periodizationApi';

// The data export always names Advanced training: its files when the chunk is loaded, otherwise "not included" (the data stays stored).
registerAddonExport('advanced-training', () =>
  periodizationHost.exportFiles
    ? { files: periodizationHost.exportFiles(), missing: [] }
    : {
        files: [],
        missing: [
          {
            item: 'Your typed maxes (install Advanced training to include them)',
            reason: 'feature-off',
          },
        ],
      },
);

/** The host once the chunk is loaded, and only while Periodization is installed; otherwise null (nothing shows). */
export function usePeriodizationHost(): PeriodizationHost | null {
  const on = usePeriodizationOn();
  const ready = useSyncExternalStore(
    (cb) => onTrackerReady((id) => id === 'periodization' && cb()),
    () => isTrackerReady('periodization'),
  );
  return on && ready ? periodizationHost : null;
}
