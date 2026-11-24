/**
 * The React side of the RPE / RIR seam: hands the chunk's pieces to the screens once it has arrived, and re-renders them when it
 * does, so a screen that opened before the chunk loaded picks the module up by itself.
 */
import { useSyncExternalStore } from 'react';
import { useEffortOn } from './addons/featureGates';
import { isTrackerReady, onTrackerReady } from './trackerRt';
import { effortHost, type EffortHost } from './effortApi';

export { effortHost } from './effortApi';
export type { EffortHost } from './effortApi';

/** The host once the chunk is loaded, and only while RPE / RIR is installed; otherwise null (nothing shows). */
export function useEffortHost(): EffortHost | null {
  const on = useEffortOn();
  const ready = useSyncExternalStore(
    (cb) => onTrackerReady((id) => id === 'effort' && cb()),
    () => isTrackerReady('effort'),
  );
  return on && ready ? effortHost : null;
}
