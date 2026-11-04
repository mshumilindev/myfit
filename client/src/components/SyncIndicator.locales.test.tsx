import { describe, expect, it } from 'vitest';
import { LOCALES, LOCALE_IDS } from '../i18n';
import { SYNC_ICON_STATES, type SyncIconState } from './ui/SyncStateIcon';

/** SPO-377: the state is never carried by colour alone: each state has its own non-empty name in every locale. */
const KEY: Record<
  SyncIconState,
  | 'synced'
  | 'syncing'
  | 'saving'
  | 'syncSlow'
  | 'offline'
  | 'syncStale'
  | 'syncProblem'
  | 'syncLocked'
> = {
  synced: 'synced',
  syncing: 'syncing',
  saving: 'saving',
  slow: 'syncSlow',
  offline: 'offline',
  stale: 'syncStale',
  failed: 'syncProblem',
  locked: 'syncLocked',
};

describe('sync state names', () => {
  it('maps every icon state to a key', () => {
    expect(Object.keys(KEY).sort()).toEqual([...SYNC_ICON_STATES].sort());
  });
  for (const id of LOCALE_IDS) {
    it(`${id}: eight non-empty, pairwise different names`, () => {
      const names = SYNC_ICON_STATES.map((s) => LOCALES[id][KEY[s]] as string);
      for (const n of names) expect(n.trim().length).toBeGreaterThan(0);
      expect(new Set(names).size).toBe(names.length);
    });
  }
});
