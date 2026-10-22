import { useMemo } from 'react';
import type { ManagerClientRow } from '../team/managerClients';

/** What a team manager's schedule knows about the trainers: who owns which client (rows of the manager's Clients list). */
export interface ManagerSchedule {
  trainers: { id: string; name: string }[];
  /** the trainer's name for a client (undefined = not in the list) */
  trainerOf: (clientId: string) => string | undefined;
  /** clients of one trainer */
  clientsOf: (trainerId: string) => readonly string[];
}

export function useManagerSchedule(
  rows: readonly ManagerClientRow[] | null,
  manager: boolean,
): ManagerSchedule | null {
  return useMemo(() => {
    if (!manager) return null;
    const list = rows ?? [];
    const byTrainer = new Map<string, { name: string; clients: string[] }>();
    const byClient = new Map<string, string>();
    for (const r of list) {
      const e = byTrainer.get(r.trainerId) ?? { name: r.trainerName, clients: [] };
      e.clients.push(r.clientId);
      byTrainer.set(r.trainerId, e);
      byClient.set(r.clientId, r.trainerName);
    }
    return {
      trainers: [...byTrainer].map(([id, e]) => ({ id, name: e.name })),
      trainerOf: (id) => byClient.get(id),
      clientsOf: (tid) => byTrainer.get(tid)?.clients ?? [],
    };
  }, [rows, manager]);
}
