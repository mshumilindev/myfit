import { useSyncExternalStore } from 'react';
import { coachAdapter } from '../data/backend';
import {
  configureManagerClients,
  configuredManagerClients,
  type ManagerClientRow,
  type ManagerClientsPort,
} from './managerClientsConfig';

export { configureManagerClients, type ManagerClientRow, type ManagerClientsPort };

export const createUnavailableManagerClients = (): ManagerClientsPort => ({
  peek: () => null,
  subscribe: () => () => undefined,
});

/** A fixed list (stories, tests). */
export function createStaticManagerClients(rows: readonly ManagerClientRow[]): ManagerClientsPort {
  return { peek: () => rows, subscribe: () => () => undefined };
}

export const getManagerClientsPort = (): ManagerClientsPort => {
  const c = configuredManagerClients();
  if (c) return c;
  const p = coachAdapter('managerClients', createUnavailableManagerClients);
  configureManagerClients(p);
  return p;
};

export function useManagerClients(port?: ManagerClientsPort): readonly ManagerClientRow[] | null {
  const p = port ?? getManagerClientsPort();
  return useSyncExternalStore(p.subscribe, p.peek, p.peek);
}
