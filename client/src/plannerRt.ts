/**
 * Planner is a separate add-on (owner 11.11): everything it draws sits in its own lazy chunk (`planner/`), fetched only while it is
 * installed. The core keeps only this stub: the gate (`usePlannerOn`) and a host the chunk fills when it arrives (`provide` at boot,
 * the same facade pattern as the trackers). Until then, and whenever the add-on is not installed, the host is empty and the core
 * shows nothing of Planner. Its data stays stored either way.
 */
import { useSyncExternalStore, type ComponentType } from 'react';
import { usePlannerOn } from './addons/featureGates';
import type { LocaleId } from './i18n';
import type { MoreMenuItem } from './components/ui/MoreMenu';
import { registerAddonExport } from './legal/export/addonExport';
import type { ExportFile } from './legal/export/exportModel';
import { isTrackerReady, onTrackerReady } from './trackerRt';

export interface PlannerHost {
  /** The Planner screen (an overlay of Gym). */
  Page: ComponentType<{ onClose: () => void }> | null;
  /** The one plain row in More. */
  moreItem: ((locale: LocaleId, open: () => void) => MoreMenuItem) | null;
  /** The plans and availability, decrypted on this device, for the data export. */
  exportFiles: (() => ExportFile[]) | null;
}

export const plannerHost: PlannerHost = { Page: null, moreItem: null, exportFiles: null };

// The data export always names Planner: its files when the chunk is loaded, otherwise "not included" (the data stays stored).
registerAddonExport('planner', () =>
  plannerHost.exportFiles
    ? { files: plannerHost.exportFiles(), missing: [] }
    : {
        files: [],
        missing: [
          {
            item: 'Planner plans and availability (install Planner to include them)',
            reason: 'feature-off',
          },
        ],
      },
);

/** The host once the chunk is loaded, and only while Planner is installed; otherwise null (nothing shows). */
export function usePlannerHost(): PlannerHost | null {
  const on = usePlannerOn();
  const ready = useSyncExternalStore(
    (cb) => onTrackerReady((id) => id === 'planner' && cb()),
    () => isTrackerReady('planner'),
  );
  return on && ready ? plannerHost : null;
}
