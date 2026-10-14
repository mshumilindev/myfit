/** Programs list model (S-21): the roster grouped by program name. Pure; copy lives in i18n. */
import type { CoachClient } from '../../domain/types';

export interface ProgramGroup {
  /** The program name as the roster carries it ("Upper/Lower 4x"). */
  name: string;
  clients: CoachClient[];
}

/** Clients that follow a program (not pending invites), grouped by name: most followers first, then A-Z. */
export function programGroups(clients: readonly CoachClient[]): ProgramGroup[] {
  const by = new Map<string, CoachClient[]>();
  for (const c of clients) {
    if (c.invite || !c.program.trim()) continue;
    by.set(c.program, [...(by.get(c.program) ?? []), c]);
  }
  return [...by.entries()]
    .map(([name, list]) => ({
      name,
      clients: [...list].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => b.clients.length - a.clients.length || a.name.localeCompare(b.name));
}

/** Case- and accent-insensitive match on the program name or any follower's name. */
export function matchGroup(g: ProgramGroup, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const fold = (s: string) =>
    s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ł/g, 'l');
  const n = fold(needle);
  return fold(g.name).includes(n) || g.clients.some((c) => fold(c.name).includes(n));
}

/** Names for the list sub-line: up to 3 first names, then "+N". */
export function followerNames(g: ProgramGroup, first: (name: string) => string, max = 3) {
  const names = g.clients.slice(0, max).map((c) => first(c.name));
  return { names: names.join(', '), more: Math.max(0, g.clients.length - max) };
}
