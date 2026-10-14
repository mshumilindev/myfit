/** Which share adapter the hooks use. The real one is `data/firestore/shareSource.ts`, installed by `install.ts`; until then the unavailable stand-in. */
import { coachAdapter } from '../data/backend';
import { createUnavailableSharePort } from '../data/unavailable';
import type { ShareSourcePort } from './port';

let port: ShareSourcePort | null = null;

/** Override the adapter (tests, stories, the future real adapter). Pass nothing to reset. */
export function configureShare(p: { source?: ShareSourcePort | null } = {}): void {
  port = p.source ?? null;
}
export const getShareSourcePort = (): ShareSourcePort =>
  (port ??= coachAdapter('share', createUnavailableSharePort));
