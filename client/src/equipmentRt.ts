/**
 * The React side of the Equipment seam: hands the chunk's screens to the gym page and the session once they have arrived, and
 * re-renders when they do.
 */
import { useSyncExternalStore } from 'react';
import { useEquipmentOn } from './addons/featureGates';
import { isTrackerReady, onTrackerReady } from './trackerRt';
import { equipmentHost, type EquipmentHost } from './equipmentApi';

export { equipmentHost } from './equipmentApi';
export type { EquipmentHost } from './equipmentApi';

/** The host once the chunk is loaded, and only while Equipment is installed; otherwise null (nothing shows). */
export function useEquipmentHost(): EquipmentHost | null {
  const on = useEquipmentOn();
  const ready = useSyncExternalStore(
    (cb) => onTrackerReady((id) => id === 'equipment' && cb()),
    () => isTrackerReady('equipment'),
  );
  return on && ready ? equipmentHost : null;
}
