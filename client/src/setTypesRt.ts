/**
 * The React side of the Set types seam (SPO-558): hands the chunk's editor pieces to the screens once it has arrived, and
 * re-renders them when it does, so a screen that opened before the chunk loaded picks the module up by itself.
 */
import { useSyncExternalStore } from 'react';
import { useSetTypesOn } from './addons/featureGates';
import { isTrackerReady, onTrackerReady } from './trackerRt';
import { setTypesHost, type SetTypesHost } from './setTypesApi';

export { setTypesHost } from './setTypesApi';
export type { SetTypesHost } from './setTypesApi';

/** The host once the chunk is loaded, and only while Set types is installed; otherwise null (nothing shows). */
export function useSetTypesHost(): SetTypesHost | null {
  const on = useSetTypesOn();
  const ready = useSyncExternalStore(
    (cb) => onTrackerReady((id) => id === 'set-types' && cb()),
    () => isTrackerReady('set-types'),
  );
  return on && ready ? setTypesHost : null;
}
