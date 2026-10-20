import { useEffect, useSyncExternalStore } from 'react';
import { coachAdapter, coachBackendIsReal } from '../data/backend';
import { coachTestDefault } from '../data/testHooks';
import { createTeamStore, type TeamState, type TeamStore } from './teamStore';
import { createUnavailableTeamPort, type TeamPort } from './port';

let configured: TeamPort | null = null;
/** The app's team port (the Firestore adapter once installed). Tests and stories pass their own. */
export function configureTeam(p: TeamPort | null): void {
  configured = p;
}
export const getTeamPort = (): TeamPort =>
  (configured ??= coachAdapter('team', createUnavailableTeamPort));

/**
 * The Team page is behind the `teamManager` flag (SPO-266). It is on for tests / stories (a team test double is
 * registered) and for an app build that sets `VITE_TEAM_MANAGER=1`; the rollout ticket replaces the build flag by the
 * remote flag. Until then no app build shows Team by default.
 */
export function teamEnabled(): boolean {
  if (coachTestDefault('team')) return true;
  return coachBackendIsReal() && import.meta.env.VITE_TEAM_MANAGER === '1';
}

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
