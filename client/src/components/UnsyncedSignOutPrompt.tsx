import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { setUnsyncedPrompt } from '../unsynced';
import { ConfirmDialog } from './ui/Overlays';

/**
 * "N changes are still unsent, sign out anyway?" (SPO-384). Sign-out from any screen (profile, the apps' account blocks, the
 * legal gates) asks through this one dialog; confirming signs out and discards them, cancelling removes nothing.
 */
export function UnsyncedSignOutPrompt() {
  const { t } = useT();
  const [ask, setAsk] = useState<{ remaining: number; proceed: () => void } | null>(null);
  useEffect(() => {
    setUnsyncedPrompt((remaining, proceed) => setAsk({ remaining, proceed }));
    return () => setUnsyncedPrompt(null);
  }, []);
  if (!ask) return null;
  return (
    <ConfirmDialog
      title={t.signOutTitle}
      body={t.signOutQueueBody(ask.remaining)}
      confirmLabel={t.signOut}
      cancelLabel={t.cancel}
      danger
      onCancel={() => setAsk(null)}
      onConfirm={() => {
        const go = ask.proceed;
        setAsk(null);
        go();
      }}
    />
  );
}
