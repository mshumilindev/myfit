/**
 * Atlas's planned pushes (skipped day, Sunday review, notes that appear in the meantime) → the server outbox.
 * Mounted by App only while the Atlas add-on is installed (lazy: a base app never downloads this code); when it is
 * not installed App clears the queue itself with an empty list.
 */
import { useEffect } from 'react';
import type { LocaleId } from '../i18n';
import { pushState } from '../push';
import type { StoreState } from '../store';
import { useAtlasFmt, useAtlasNotes } from './notes';
import { planAtlasMessages } from './outboxPlan';
import { syncOutbox } from './schedule';

export function AtlasOutboxHost(props: {
  authed: boolean;
  store: StoreState;
  locale: LocaleId;
  t: { atlasName: string; atlasPushReview: string };
}) {
  const { authed, store, locale, t } = props;
  const atlas = useAtlasNotes();
  const atlasFmt = useAtlasFmt();
  useEffect(() => {
    if (!authed || pushState() !== 'on') return;
    const id = window.setTimeout(() => {
      const msgs = planAtlasMessages({
        store,
        atlasOn: true,
        temper: atlas.temper,
        locale,
        fmt: atlasFmt,
        t,
        now: Date.now(),
      });
      void syncOutbox(msgs).catch((err) => console.warn('atlas: outbox sync failed', err));
    }, 3000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, store.workouts, store.sleeps, store.bodyMetrics, store.coach, atlas.temper, locale]);
  return null;
}
