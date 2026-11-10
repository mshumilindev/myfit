import type { LocaleId } from '../i18n';
import { computePlaybookGated } from '../playbookGated';
import type { StoreState } from '../store';
import { buildNotes } from './notes';
import { chatBacked, planNotePushes, planOutbox, type OutboxMessage } from './schedule';
import type { Temper } from './types';
import type { Fmt } from './voice';

/**
 * Everything Atlas will push while the app is closed (skipped day, Sunday review, notes that appear in the meantime).
 * Atlas is an add-on (SPO-518): without it nothing is planned, and an empty list clears what was queued.
 */
export function planAtlasMessages(a: {
  store: StoreState;
  atlasOn: boolean;
  temper: Temper;
  locale: LocaleId;
  fmt: Fmt;
  t: { atlasName: string; atlasPushReview: string };
  now: number;
}): OutboxMessage[] {
  const { store, locale, fmt, t, now } = a;
  if (!store.coach.enabled || !a.atlasOn) return [];
  const finished = store.workouts.filter((w) => w.finishedAt !== null);
  return chatBacked(
    planOutbox({
      coach: store.coach,
      temper: a.temper,
      finished,
      plays: computePlaybookGated(finished, now).plays,
      now,
      locale,
      fmt,
      title: t.atlasName,
      reviewBody: t.atlasPushReview,
    }),
    (at) => buildNotes(store, at, locale, fmt).notes,
  ).concat(
    // New notes that will appear while the app is closed → pushes.
    planNotePushes({
      coach: store.coach,
      now,
      // Push previews show on the lock screen: no swearing there (SPO-124).
      notesAt: (at) =>
        buildNotes({ ...store, coach: { ...store.coach, swearing: false } }, at, locale, fmt).notes,
      title: t.atlasName,
    }),
  );
}
