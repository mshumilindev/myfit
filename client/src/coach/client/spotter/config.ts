import { coachAdapter } from '../../data/backend';
import { createUnavailableClientSpotterPort } from './clientSpotterPort';
import { clientSpotterPortOr, setClientSpotterPort } from './portSlot';

/** Install the real port (`install.ts`, through `portSlot.ts`) or a double (tests, stories); `null` forgets it (sign-out). */
export const configureClientSpotter = setClientSpotterPort;

export const getClientSpotterPort = () =>
  clientSpotterPortOr(() => coachAdapter('clientSpotter', createUnavailableClientSpotterPort));
