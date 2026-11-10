/**
 * Atlas not installed: nothing is planned for the server outbox and what was queued is cleared (an empty list), once, a
 * moment after sign-in, without loading the rest of Atlas. While Atlas is installed `AtlasOutboxHost` plans the pushes.
 */
import { useEffect } from 'react';
import { pushState } from '../push';

export function useAtlasOutboxClear(atlasOn: boolean, authed: boolean): void {
  useEffect(() => {
    if (atlasOn || !authed || pushState() !== 'on') return;
    const id = window.setTimeout(() => {
      void import('./schedule')
        .then((m) => m.syncOutbox([]))
        .catch((err) => console.warn('atlas: outbox sync failed', err));
    }, 3000);
    return () => window.clearTimeout(id);
  }, [atlasOn, authed]);
}
