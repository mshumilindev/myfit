/**
 * Every browser-storage key the app writes, with what it is and where its value lives (SPO-390, from the SPO-349
 * spike). `localKeys.guard.test.ts` scans `client/src` and fails on a key that is not listed here, so a new key
 * cannot appear without someone deciding: is it a copy of account data (`synced`), a known gap (`gap`, needs an
 * issue), a throw-away UI state (`ephemeral`) or bookkeeping (`diag`).
 *
 * - `scope: 'device'` keys describe the install and survive sign-out (`DEVICE_KEYS`); `'account'` keys are wiped.
 * - `syncedTo`: `users/{uid}/<collection>`, `users/{uid}/meta/<doc>` or `users/{uid}/meta/prefs#<field>`.
 * - A key ending the entry as `prefix` covers every key that starts with it (templates such as `spotter.tw.<id>`).
 */
import type { LocalKeyEntry } from './localKeys.types';
import { LOCAL_KEYS_1 } from './localKeys.registry.part1';
import { LOCAL_KEYS_2 } from './localKeys.registry.part2';
import { LOCAL_KEYS_3 } from './localKeys.registry.part3';

export type { LocalKeyClass, LocalKeyEntry } from './localKeys.types';

export const LOCAL_KEYS: readonly LocalKeyEntry[] = [
  ...LOCAL_KEYS_1,
  ...LOCAL_KEYS_2,
  ...LOCAL_KEYS_3,
];

/** The registry entry that covers a stored key, if any. */
export function localKeyEntry(storageKey: string): LocalKeyEntry | undefined {
  return LOCAL_KEYS.find((e) =>
    e.key !== undefined ? e.key === storageKey : storageKey.startsWith(e.prefix as string),
  );
}
