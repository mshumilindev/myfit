import { coachAdapter } from '../../data/backend';
import { createUnavailableClientSpotterPort, type ClientSpotterPort } from './clientSpotterPort';

let port: ClientSpotterPort | null = null;

/** Install the real port (`install.ts`) or a double (tests, stories); `null` forgets it (sign-out). */
export function configureClientSpotter(p: ClientSpotterPort | null): void {
  port = p;
}

export const getClientSpotterPort = (): ClientSpotterPort =>
  (port ??= coachAdapter('clientSpotter', createUnavailableClientSpotterPort));
