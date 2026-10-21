import type { TeamPort } from './port';

/** The installed team port (see `useTeam.ts`). Apart from it so the Firestore installer does not import the backend: no cycle. */
let configured: TeamPort | null = null;
export function configureTeam(p: TeamPort | null): void {
  configured = p;
}
export const configuredTeam = (): TeamPort | null => configured;
