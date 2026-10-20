import { useSyncExternalStore } from 'react';
import { coachAdapter } from '../data/backend';

/** One client of the team as the manager's list shows it (names and the trainer; never content). */
export interface ManagerClientRow {
  clientId: string;
  trainerId: string;
  trainerName: string;
  name: string;
  /** the client's device delegated the schedule keys: the schedule can be read and written */
  ready: boolean;
}

/**
 * The seam under the manager's Clients screen. The real adapter reads the key book (`createManagerBook`); stories and tests
 * pass a fixed list. `null` = not installed / not read yet (never sample people).
 */
export interface ManagerClientsPort {
  peek(): readonly ManagerClientRow[] | null;
  subscribe(f: () => void): () => void;
}

export const createUnavailableManagerClients = (): ManagerClientsPort => ({
  peek: () => null,
  subscribe: () => () => undefined,
});

/** A fixed list (stories, tests). */
export function createStaticManagerClients(rows: readonly ManagerClientRow[]): ManagerClientsPort {
  return { peek: () => rows, subscribe: () => () => undefined };
}

let configured: ManagerClientsPort | null = null;
export function configureManagerClients(p: ManagerClientsPort | null): void {
  configured = p;
}
export const getManagerClientsPort = (): ManagerClientsPort =>
  (configured ??= coachAdapter('managerClients', createUnavailableManagerClients));

export function useManagerClients(port?: ManagerClientsPort): readonly ManagerClientRow[] | null {
  const p = port ?? getManagerClientsPort();
  return useSyncExternalStore(p.subscribe, p.peek, p.peek);
}
