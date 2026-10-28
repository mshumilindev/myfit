/**
 * Mounted once (main.tsx). Keeps the Atlas chat in the account (SPO-392) in step with its two switches: the global flag
 * `atlasHistory` and the person's `atlas-history` consent. Either off, or the records not yet known (fail closed), or this
 * device withdrew it → nothing runs and nothing is read or written.
 */
import { useEffect } from 'react';
import { currentUid } from '../api';
import { useFlag } from '../data/flags';
import { useConsentRecords } from '../legal/consentApi';
import { optionalConsentOn } from '../legal/consents';
import { localOffKinds } from '../legal/localOff';
import { startAtlasHistory, type AtlasHistory } from './chatSyncService';
import { firestoreHistoryPorts, firestoreRetentionPorts } from './chatSyncPorts';
import { sweepWithdrawn, withdrawHistory } from './chatRetention';

let active: AtlasHistory | null = null;
let uploadOnStart = false;

const quiet = (e: unknown) => {
  if (import.meta.env?.DEV) console.warn('[atlas-history]', e);
};

/** Sends this device's chat to the account — only called after the person's explicit yes. 0 when nothing is running. */
export async function uploadAtlasHistory(): Promise<number> {
  if (active) return active.uploadLocal();
  uploadOnStart = true; // the consent was just recorded: the sync starts a moment later and then uploads once
  return 0;
}

/** Withdrawing the consent: delete the account copy now, or keep it for a while (see chatRetention.ts). Throws on failure. */
export async function withdrawAtlasHistory(mode: 'keep' | 'now'): Promise<void> {
  const uid = currentUid();
  if (!uid) return;
  await withdrawHistory(firestoreRetentionPorts(uid, quiet), mode);
}

export function AtlasHistoryHost() {
  const flag = useFlag('atlasHistory');
  const { records, confirmed } = useConsentRecords();
  const uid = currentUid();
  const on =
    flag &&
    !!uid &&
    (confirmed || records.length > 0) &&
    optionalConsentOn(records, 'atlas-history') &&
    !localOffKinds(uid).includes('atlas-history');

  useEffect(() => {
    if (!on || !uid) return;
    const h = startAtlasHistory(firestoreHistoryPorts(uid, quiet));
    active = h;
    if (uploadOnStart) {
      uploadOnStart = false;
      h.uploadLocal().catch(quiet);
    }
    return () => {
      uploadOnStart = false;
      h.stop();
      if (active === h) active = null;
    };
  }, [on, uid]);

  // Consent off (and known to be): a kept copy whose time is up is deleted. Nothing is read otherwise.
  const off =
    flag &&
    !!uid &&
    (confirmed || records.length > 0) &&
    !optionalConsentOn(records, 'atlas-history');
  useEffect(() => {
    if (!off || !uid) return;
    sweepWithdrawn(firestoreRetentionPorts(uid, quiet)).catch(quiet);
  }, [off, uid]);
  return null;
}
