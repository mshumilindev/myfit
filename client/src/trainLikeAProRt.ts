/**
 * Train like a pro is a separate add-on: its catalog, screens and data sit in its own lazy chunk (`trainLikeAPro/`), fetched only while it is
 * installed. The core keeps only this stub: the gate (`useTrainLikeAProOn`) and a host the chunk fills when it arrives (`provide` at boot,
 * the same facade pattern as Planner). Until then, and whenever the add-on is not installed, the host is empty and the core shows nothing
 * of it. Programs a person already started are ordinary programs and stay theirs either way.
 */
import { useSyncExternalStore, type ComponentType } from 'react';
import { useTrainLikeAProOn } from './addons/featureGates';
import { isTrackerReady, onTrackerReady } from './trackerRt';

export interface TrainLikeAProHost {
  /** The catalog screen (an overlay of Programs). */
  Page: ComponentType<{ onClose: () => void }> | null;
  /** The one quiet entry row on Programs. */
  EntryRow: ComponentType<{ onOpen: () => void }> | null;
}

export const trainLikeAProHost: TrainLikeAProHost = {
  Page: null,
  EntryRow: null,
};

/** The host once the chunk is loaded, and only while the add-on is installed; otherwise null (nothing shows). */
export function useTrainLikeAProHost(): TrainLikeAProHost | null {
  const on = useTrainLikeAProOn();
  const ready = useSyncExternalStore(
    (cb) => onTrackerReady((id) => id === 'train-like-a-pro' && cb()),
    () => isTrackerReady('train-like-a-pro'),
  );
  return on && ready ? trainLikeAProHost : null;
}
