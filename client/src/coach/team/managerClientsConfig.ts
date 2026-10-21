/**
 * Types and the installed-port slot of the manager's Clients list. Kept apart from `managerClients.ts` (which reads the
 * default through `data/backend`) so the Firestore installer can configure the port without importing the backend: no cycle.
 */
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

let configured: ManagerClientsPort | null = null;
export function configureManagerClients(p: ManagerClientsPort | null): void {
  configured = p;
}
export const configuredManagerClients = (): ManagerClientsPort | null => configured;
