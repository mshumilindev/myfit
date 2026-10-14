import { useMemo } from 'react';
import type { CoachWorldPort } from '../data/port';
import { useCoachWorld } from '../data/useCoachWorld';
import type { CoachClient } from '../domain/types';
import { firstName } from './labels';

export interface People {
  list: readonly CoachClient[];
  byId: ReadonlyMap<string, CoachClient>;
  name: (id: string) => string;
  first: (id: string) => string;
  loading: boolean;
}

/** Names of the trainer's clients, from the same world the Roster and Today read (so counts and names agree). */
export function usePeople(port?: CoachWorldPort): People {
  const api = useCoachWorld(port);
  const rows = api.world?.rows;
  return useMemo(() => {
    const list = (rows ?? []).filter((r) => !r.client.invite).map((r) => r.client);
    const byId = new Map(list.map((c) => [c.id, c]));
    const name = (id: string) => byId.get(id)?.name ?? id;
    return { list, byId, name, first: (id: string) => firstName(name(id)), loading: !rows };
  }, [rows]);
}
