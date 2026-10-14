/** Which program adapter the hooks use. The real one is `data/firestore/programPort.ts` (installed by `installFirestoreCoach`); until then the unavailable stand-in. */
import { coachAdapter } from '../data/backend';
import { createUnavailableProgramPort } from '../data/unavailable';
import type { ProgramPort } from './port';

let port: ProgramPort | null = null;

/** Override the adapter (tests, stories, the future real adapter). Pass nothing to reset. */
export function configureProgramData(p: { port?: ProgramPort | null } = {}): void {
  port = p.port ?? null;
}
export const getProgramPort = (): ProgramPort =>
  (port ??= coachAdapter('program', createUnavailableProgramPort));
