/**
 * Mounted once (main.tsx). Loads the Atlas chat-history host only while the Atlas add-on is installed: the base app
 * never downloads it. Without the add-on the one thing that must still happen runs on its own: a kept copy of the chat
 * whose time is up (consent withdrawn) is deleted (GDPR Art. 17), whether or not Atlas is installed.
 */
import { lazy, Suspense, useEffect } from 'react';
import { useAddonOrBase } from '../addons/enabledSet';
import { currentUid } from '../api';
import { useConsentRecords } from '../legal/consentApi';
import { optionalConsentOn } from '../legal/consents';

const Host = lazy(() =>
  import('./AtlasHistoryHost').then((module) => ({ default: module.AtlasHistoryHost })),
);

/** Retention sweep for a base app (Atlas not installed): loads the few modules it needs only when it has work. */
function RetentionSweep() {
  const { records, confirmed } = useConsentRecords();
  const uid = currentUid();
  const off =
    !!uid && (confirmed || records.length > 0) && !optionalConsentOn(records, 'atlas-history');
  useEffect(() => {
    if (!off || !uid) return;
    void Promise.all([import('./chatRetention'), import('./chatSyncPorts')])
      .then(([retention, ports]) =>
        retention.sweepWithdrawn(ports.firestoreRetentionPorts(uid, () => {})),
      )
      .catch((e) => {
        if (import.meta.env?.DEV) console.warn('[atlas-history]', e);
      });
  }, [off, uid]);
  return null;
}

export function AtlasHistoryGate() {
  const installed = useAddonOrBase('atlas');
  if (!installed) return <RetentionSweep />;
  return (
    <Suspense fallback={null}>
      <Host />
    </Suspense>
  );
}
