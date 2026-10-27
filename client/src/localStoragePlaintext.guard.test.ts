// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sealedKeyOf } from './sealedState';

/**
 * SPO-231 / SPO-58: the store may write to `localStorage` in the clear ONLY the keys listed here (device settings and
 * opaque markers, nothing the user typed). Every user-data field goes through `sealedState` (`*.enc`). A new plain
 * `setItem` in `store.ts` fails this test until it is reviewed and added with a reason.
 */
const NON_SENSITIVE_PLAIN_KEYS: Record<string, string> = {
  SLEEP_TOMB_KEY: 'opaque ids of deleted sleeps (no content)',
  SLEEP_SYNCED_KEY: 'opaque ids of synced sleeps (no content)',
  SHARED_GYMS_KEY: 'the public shared-gym catalogue (not the user data)',
  WEIGHT_UNIT_KEY: 'display unit',
  EX_UNIT_KEY: 'display unit per exercise',
  EX_LOAD_KEY: 'exercise display preference',
  EX_SIDES_KEY: 'exercise display preference',
  EX_REST_KEY: 'rest preference per exercise',
  REST_PREFS_KEY: 'rest timer preferences',
  REST_CLEARED_KEY: 'one-time migration marker',
  SLEEP_KIND_KEY: 'one-time migration marker',
  POS_CACHE_KEY:
    'last position fix, device cache removed on logout (documented exception, ADR 011)',
};
const SEALED_PLAIN = [
  'spotter.state',
  'spotter.gyms',
  'spotter.restPeriods',
  'spotter.injuries',
  'spotter.activities',
  'spotter.sleeps',
  'spotter.sleep.schedule',
  'spotter.sleep.settings',
  'spotter.body',
  'spotter.goals',
  'spotter.home',
  'spotter.mastery',
  'spotter.coach',
];

describe('no plaintext user data in localStorage (SPO-216)', () => {
  const read = () => readFileSync(new URL('./store.ts', import.meta.url), 'utf8');

  it('every plain setItem in store.ts is on the reviewed allow-list', () => {
    const store = read();
    const used = [...store.matchAll(/localStorage\.setItem\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,/g)].map(
      (m) => m[1],
    );
    expect(used.length).toBeGreaterThan(0);
    for (const k of used)
      expect(Object.keys(NON_SENSITIVE_PLAIN_KEYS), `${k} is written in plaintext`).toContain(k);
  });

  it('no sealed field is ever written under its plain key (only the .enc twin)', () => {
    const store = read();
    for (const key of SEALED_PLAIN) {
      expect(store).not.toMatch(
        new RegExp(`setItem\\(\\s*['"\`]${key.replace(/\./g, '\\.')}['"\`]`),
      );
      expect(sealedKeyOf(key)).toBe(`${key}.enc`);
    }
  });
});
