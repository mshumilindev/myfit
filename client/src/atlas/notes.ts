/**
 * Atlas's notes feed: facts from the last two weeks, voiced in today's
 * (guarded) temper. Recomputed from history — nothing stored, so every device
 * shows the same notes and a temper change rewrites them all.
 */
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { useT, fmtBodyWeightKg } from '../i18n';
import { computePlaybook } from '../playbook';
import { fmtCountdown } from '../restTimer';
import { localizedExerciseName } from '../data/exerciseNames';
import type { StoreState } from '../store';
import type { LocaleId } from '../i18n';
import { dayFacts, sessionFacts, weekFact } from './facts';
import { effectiveTemper } from './guard';
import { say, type Fmt } from './voice';
import type { CoachFact, Temper } from './types';

const DAY = 86_400_000;
/** How far back the feed reaches (and how much history a new coach "saw"). */
export const NOTES_WINDOW_DAYS = 14;

export interface AtlasNote {
  id: string;
  at: number;
  kind: CoachFact['kind'];
  text: string;
  fact: CoachFact;
}

export interface NotesResult {
  notes: AtlasNote[];
  temper: Temper;
  unread: number;
}

export function buildNotes(
  s: Pick<StoreState, 'workouts' | 'sleeps' | 'bodyMetrics' | 'injuries' | 'restPeriods' | 'coach'>,
  now: number,
  locale: LocaleId,
  fmt: Fmt,
): NotesResult {
  const finished = s.workouts
    .filter((w) => w.finishedAt !== null)
    .sort((a, b) => a.startedAt - b.startedAt);
  const since = now - NOTES_WINDOW_DAYS * DAY;
  const facts: CoachFact[] = [];
  for (const w of finished) if (w.startedAt >= since) facts.push(...sessionFacts(w, finished));
  facts.push(
    ...dayFacts({
      finished,
      plays: computePlaybook(finished, now).plays,
      sleeps: s.sleeps,
      body: s.bodyMetrics,
      now,
    }),
  );
  if (new Date(now).getDay() === 0 && finished.length > 0) facts.push(weekFact(finished, now));

  const temper = effectiveTemper(s.coach, {
    injuries: s.injuries,
    restPeriods: s.restPeriods,
    sleeps: s.sleeps,
    finished,
    now,
  });
  const seen = new Set<string>();
  const notes = facts
    .filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)))
    .sort((a, b) => a.at - b.at)
    .map((fact) => ({
      id: fact.id,
      at: fact.at,
      kind: fact.kind,
      fact,
      text: say(fact, temper, { locale, fmt, yoMama: s.coach.yoMama }),
    }));
  const unread = notes.filter((n) => n.at > s.coach.readAt).length;
  return { notes, temper, unread };
}

/** Formatters for the phrase book in the current locale. */
export function useAtlasFmt(): Fmt {
  const { t, locale } = useT();
  return useMemo(
    () => ({
      kg: (n: number) => fmtBodyWeightKg(n),
      mmss: (sec: number) => fmtCountdown(sec),
      muscle: (m: string) => (t.muscleGroups as Record<string, string>)[m] ?? m,
      exercise: (name: string) => localizedExerciseName(name, locale) ?? name,
    }),
    [t, locale],
  );
}

/** Wall clock that ticks once a minute (skipped-day notes depend on the time). */
export function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function useAtlasNotes(): NotesResult {
  const s = useStore();
  const { locale } = useT();
  const fmt = useAtlasFmt();
  const now = useMinuteClock();
  return useMemo(
    () => buildNotes(s, now, locale, fmt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.workouts, s.sleeps, s.bodyMetrics, s.injuries, s.restPeriods, s.coach, locale, fmt, now],
  );
}
