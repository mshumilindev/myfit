import { useEffect, useSyncExternalStore } from 'react';
import { useClientCoachEnabled } from '../gate';
import { getClientPort } from './config';
import type { ClientCoachPort } from './port';
import { clientStoreFor, type ClientState, type ClientStore } from './store';
import type { ClientLink } from './types';

export interface ClientCoachApi extends ClientState {
  store: ClientStore;
}

/** The link to my trainer (state, grants, program layer). The subscription lives while a component reads it. */
export function useClientCoach(port?: ClientCoachPort, enabled = true): ClientCoachApi {
  const store = clientStoreFor(port ?? getClientPort());
  useEffect(() => {
    if (!enabled) return;
    store.retain();
    return () => store.release();
  }, [store, enabled]);
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return { ...state, store };
}

/** My trainer link when the features are on AND I have a trainer (waiting / active / revoked), else null. */
export function useTrainerLink(): ClientLink | null {
  const on = useClientCoachEnabled();
  const { snapshot } = useClientCoach(undefined, on);
  if (!on || !snapshot || snapshot.link.state === 'none' || !snapshot.link.trainer) return null;
  return snapshot.link;
}

export { useClientCoachEnabled };
