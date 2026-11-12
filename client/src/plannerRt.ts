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

/** What a trainer sees of the person's availability (published inside `meta/coachShare`): hours per weekday, minutes since midnight, and unavailable day keys. */
export interface CoachAvailability {
  weekly: Record<number, [number, number][]>;
  unavailable: { fromDay: number; toDay: number | null }[];
}

export interface PlannerHost {
  /** The Planner screen (an overlay of Gym). */
  Page: ComponentType<{ onClose: () => void }> | null;
  /** Always mounted while Planner is installed: the persistent reminders that ring over the app. */
  Layer: ComponentType | null;
  /** The one plain row in More. */
  moreItem: ((locale: LocaleId, open: () => void) => MoreMenuItem) | null;
  /** The plans and availability, decrypted on this device, for the data export. */
  exportFiles: (() => ExportFile[]) | null;
  /** Turns "Show free hours to my trainer" on or off (the chunk saves the prefs and republishes the coach view). */
  setShare: ((on: boolean) => void) | null;
  /** The availability a trainer may see, or null while it is not shared. */
  coachView: (() => CoachAvailability | null) | null;
}

export const plannerHost: PlannerHost = {
  Page: null,
  Layer: null,
  moreItem: null,
  exportFiles: null,
  setShare: null,
  coachView: null,
};

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

// The one setting the core needs before the chunk is loaded or while it is gone: whether availability is shared. The chunk fills the
// mirror from the person's prefs (`setPlannerShareMirror`); until then, and when Planner is not installed, it reads off.
let shareOn = false;
const shareSubs = new Set<() => void>();
export function setPlannerShareMirror(on: boolean): void {
  if (shareOn === on) return;
  shareOn = on;
  shareSubs.forEach((f) => f());
}
export function usePlannerShare(): 'off' | 'full' {
  const on = useSyncExternalStore(
    (cb) => {
      shareSubs.add(cb);
      return () => shareSubs.delete(cb);
    },
    () => shareOn,
  );
  return on ? 'full' : 'off';
}
/** Writes the share setting through the chunk (nothing happens while it is not loaded: the row only exists while it is). */
export const writePlannerShare = (on: boolean): void => plannerHost.setShare?.(on);
