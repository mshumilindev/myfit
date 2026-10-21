import type { ClientSpotterPort } from './clientSpotterPort';

/**
 * Where the installed Spotter port lives. A leaf module (it imports no backend code), so `install.ts` can put the real
 * port here without a cycle through `config.ts` → `backend.ts` → `bootstrap` → `install.ts`.
 */
let slot: ClientSpotterPort | null = null;

export const setClientSpotterPort = (p: ClientSpotterPort | null): void => {
  slot = p;
};

export const clientSpotterPortOr = (make: () => ClientSpotterPort): ClientSpotterPort =>
  (slot ??= make());
