import { useEffect, useSyncExternalStore } from 'react';
import { coachAdapter } from '../data/backend';
import { createTeamStore, type TeamState, type TeamStore } from './teamStore';
import { createUnavailableTeamPort, type TeamPort } from './port';
import { configureTeam, configuredTeam } from './teamConfig';

export { configureTeam };
/** The app's team port (the Firestore adapter once installed). Tests and stories pass their own. */
export const getTeamPort = (): TeamPort => {
  const c = configuredTeam();
  if (c) return c;
  const p = coachAdapter('team', createUnavailableTeamPort);
  configureTeam(p);
  return p;
};

const stores = new WeakMap<TeamPort, TeamStore>();
export function teamStoreFor(port: TeamPort): TeamStore {
  let s = stores.get(port);
  if (!s) stores.set(port, (s = createTeamStore(port)));
  return s;
}

/** The team, live: starts from the cache and refreshes in the background (never a blocking spinner when cached). */
export function useTeam(port?: TeamPort): { store: TeamStore; state: TeamState } {
  const store = teamStoreFor(port ?? getTeamPort());
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  useEffect(() => {
    void store.load();
  }, [store]);
  return { store, state };
}
