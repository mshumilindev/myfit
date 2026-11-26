/**
 * The React side of the Time blocks seam: hands the chunk's screens to the session once it has arrived, and re-renders when it does.
 */
import { useSyncExternalStore } from 'react';
import { useTimeBlocksOn } from './addons/featureGates';
import { isTrackerReady, onTrackerReady } from './trackerRt';
import { timeBlocksHost, type TimeBlocksHost } from './timeBlocksApi';

export { timeBlocksHost } from './timeBlocksApi';
export type { TimeBlocksHost } from './timeBlocksApi';

/** The host once the chunk is loaded, and only while Time blocks is installed; otherwise null (nothing shows). */
export function useTimeBlocksHost(): TimeBlocksHost | null {
  const on = useTimeBlocksOn();
  const ready = useSyncExternalStore(
    (cb) => onTrackerReady((id) => id === 'time-blocks' && cb()),
    () => isTrackerReady('time-blocks'),
  );
  return on && ready ? timeBlocksHost : null;
}
