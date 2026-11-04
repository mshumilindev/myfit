import { describe, expect, it } from 'vitest';
import {
  SAVING_SHOW_AFTER_MS,
  SLOW_AFTER_MS,
  SYNCING_SHOW_AFTER_MS,
  deriveSyncUi,
  type SyncUiInput,
  type SyncUiState,
} from './syncHealth';
import { SYNC_ICON_STATES } from './components/ui/SyncStateIcon';
import type { SyncStatus } from './types';

/** SPO-377: the full input space of the indicator, walked exhaustively. */
const STATUSES: SyncStatus[] = ['synced', 'pending', 'syncing', 'offline', 'failed'];
const UNSETTLED = [
  0,
  SYNCING_SHOW_AFTER_MS - 1,
  SYNCING_SHOW_AFTER_MS,
  SLOW_AFTER_MS - 1,
  SLOW_AFTER_MS,
];
const SAVING = [0, SAVING_SHOW_AFTER_MS - 1, SAVING_SHOW_AFTER_MS];

const all: { i: SyncUiInput; out: SyncUiState }[] = [];
for (const signedIn of [true, false])
  for (const status of STATUSES)
    for (const online of [true, false])
      for (const unsettledForMs of UNSETTLED)
        for (const savingForMs of SAVING)
          for (const pendingWrites of [undefined, 0, 3])
            for (const locked of [undefined, false, true]) {
              const i: SyncUiInput = {
                signedIn,
                status,
                online,
                unsettledForMs,
                savingForMs,
                pendingWrites,
                locked,
              };
              all.push({ i, out: deriveSyncUi(i) });
            }

describe('deriveSyncUi: priority over the whole input space', () => {
  it('walks every combination and always returns a state the icon can draw', () => {
    expect(all.length).toBe(2 * 5 * 2 * 5 * 3 * 3 * 3);
    for (const { out } of all) expect(SYNC_ICON_STATES).toContain(out);
  });

  it('every one of the 8 icon states is reachable', () => {
    const seen = new Set(all.map((x) => x.out));
    for (const s of SYNC_ICON_STATES) expect(seen.has(s), s).toBe(true);
  });

  it('signed out is always silent', () => {
    for (const { i, out } of all) if (!i.signedIn) expect(out).toBe('synced');
  });

  it('failed beats everything when signed in', () => {
    for (const { i, out } of all)
      if (i.signedIn && i.status === 'failed') expect(out).toBe('failed');
  });

  it('locked beats offline, slow, saving and syncing (but not failed)', () => {
    for (const { i, out } of all)
      if (i.signedIn && i.locked && i.status !== 'failed') expect(out).toBe('locked');
  });

  it('no network: stale only with nothing queued, otherwise offline; never slow/saving/syncing', () => {
    for (const { i, out } of all) {
      if (!i.signedIn || i.status === 'failed' || i.locked) continue;
      if (!i.online || i.status === 'offline') {
        expect(out).toBe(i.pendingWrites === 0 ? 'stale' : 'offline');
      }
    }
  });

  it('online and unsettled: slow > saving > syncing > quiet, by the thresholds', () => {
    for (const { i, out } of all) {
      if (!i.signedIn || i.locked || !i.online) continue;
      if (i.status !== 'pending' && i.status !== 'syncing') continue;
      const want: SyncUiState =
        i.unsettledForMs >= SLOW_AFTER_MS
          ? 'slow'
          : i.savingForMs >= SAVING_SHOW_AFTER_MS
            ? 'saving'
            : i.unsettledForMs >= SYNCING_SHOW_AFTER_MS
              ? 'syncing'
              : 'synced';
      expect(out).toBe(want);
    }
  });

  it('online and settled: saving after the delay, otherwise quiet', () => {
    for (const { i, out } of all) {
      if (!i.signedIn || i.locked || !i.online || i.status !== 'synced') continue;
      expect(out).toBe(i.savingForMs >= SAVING_SHOW_AFTER_MS ? 'saving' : 'synced');
    }
  });

  it('is pure: the same input gives the same state', () => {
    for (const { i, out } of all) expect(deriveSyncUi({ ...i })).toBe(out);
  });
});
