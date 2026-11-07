/**
 * The health features are add-ons (SPO-518): a feature whose add-on is not installed is OFF for every reader of the store,
 * the same way a missing consent turns it off (healthMask.ts). The stored data is not touched; the stored safety limits
 * (`getStoredLimits`, restrictions only) are not part of this view. Pure but for the installed list it reads.
 */
import { addonAvailable as installed } from './addons/enabledSet';
import type { HealthOnMap } from './data/healthConsentGate';

/**
 * The add-on gate is a product switch (consent still masks on its own), and this runs while rendering: if the device
 * refuses to read the role or the list (blocked storage), the app behaves as before the add-ons existed, not crashes.
 */
function addonAvailable(id: string): boolean {
  try {
    return installed(id);
  } catch {
    return true;
  }
}

/** Consent AND add-on: what the app may use of each health feature. */
export function healthAddonsOn(on: HealthOnMap): HealthOnMap {
  return {
    ...on,
    injuries: on.injuries && addonAvailable('injury-log'),
    chronic: on.chronic && addonAvailable('conditions'),
    nicotine: on.nicotine && addonAvailable('nicotine-alcohol'),
    alcohol: on.alcohol && addonAvailable('nicotine-alcohol'),
    supplements: on.supplements && addonAvailable('supplements'),
    cycle: on.cycle && addonAvailable('cycle'),
  };
}

/** Changes when any of those add-ons is installed or removed (a cache key for the masked view). */
export function healthAddonsKey(): string {
  return ['injury-log', 'health', 'conditions', 'nicotine-alcohol', 'supplements', 'cycle']
    .map((id) => (addonAvailable(id) ? '1' : '0'))
    .join('');
}
