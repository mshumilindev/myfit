/**
 * The React side of the Supersets seam: hands the chunk's sheet to the session once it has arrived, and re-renders when it does.
 */
import { useSyncExternalStore } from 'react';
import { useSupersetsOn } from './addons/featureGates';
import { isTrackerReady, onTrackerReady } from './trackerRt';
import { supersetsHost, type SupersetsHost } from './supersetsApi';

export { supersetsHost } from './supersetsApi';
export type { SupersetsHost } from './supersetsApi';

/** The host once the chunk is loaded, and only while Supersets is installed; otherwise null (nothing shows). */
export function useSupersetsHost(): SupersetsHost | null {
  const on = useSupersetsOn();
  const ready = useSyncExternalStore(
    (cb) => onTrackerReady((id) => id === 'supersets' && cb()),
    () => isTrackerReady('supersets'),
  );
  return on && ready ? supersetsHost : null;
}
