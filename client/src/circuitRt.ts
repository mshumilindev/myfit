/**
 * The React side of the Circuit seam: hands the chunk's screens to the session once it has arrived, and re-renders when it does.
 */
import { useSyncExternalStore } from 'react';
import { useCircuitOn } from './addons/featureGates';
import { isTrackerReady, onTrackerReady } from './trackerRt';
import { circuitHost, type CircuitHost } from './circuitApi';

export { circuitHost } from './circuitApi';
export type { CircuitHost } from './circuitApi';

/** The host once the chunk is loaded, and only while Circuit is installed; otherwise null (nothing shows). */
export function useCircuitHost(): CircuitHost | null {
  const on = useCircuitOn();
  const ready = useSyncExternalStore(
    (cb) => onTrackerReady((id) => id === 'circuit' && cb()),
    () => isTrackerReady('circuit'),
  );
  return on && ready ? circuitHost : null;
}
