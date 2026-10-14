/** Which live adapter the hooks use. The real one is `data/firestore/livePort.ts`, installed by `install.ts`; until then the unavailable stand-in. */
import { coachAdapter } from '../../data/backend';
import { createUnavailableLivePort } from '../../data/unavailable';
import type { LivePort } from './port';

let port: LivePort | null = null;

/** Override the adapter (tests, stories, the future real adapter). Pass nothing to reset. */
export function configureLive(p?: LivePort | null): void {
  port = p ?? null;
}

export const getLivePort = (): LivePort =>
  (port ??= coachAdapter('live', createUnavailableLivePort));
