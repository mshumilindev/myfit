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
  // No backfill: the conversation starts when you took Atlas on. Only
  // sessions finished since then (and within the window) get notes.
  // (Older profiles have no start stamp: begin at the latest session so the
  // intro keeps a stable id instead of moving with the clock.)
  const start = s.coach.startedAt || (finished[finished.length - 1]?.finishedAt ?? now);
  const since = Math.max(now - NOTES_WINDOW_DAYS * DAY, start);
  const facts: CoachFact[] = [
    { kind: 'intro', id: `intro:${start}`, at: start, sessions: finished.length },
  ];
  for (const w of finished)
    if ((w.finishedAt ?? w.startedAt) >= since)
      facts.push(...sessionFacts(w, finished).filter((f) => f.kind !== 'session' || f.sets > 0));
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
    // "Clear chat" hides everything before it.
    .filter((f) => f.at >= Math.max(start, s.coach.clearedAt ?? 0))
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

/** One fact voiced right now (mid-session jab), or null when Atlas is off/muted. */
export function voiceNow(
  fact: CoachFact,
  s: Pick<StoreState, 'workouts' | 'sleeps' | 'injuries' | 'restPeriods' | 'coach'>,
  now: number,
  locale: LocaleId,
  fmt: Fmt,
): { text: string; temper: Temper } | null {
  if (!s.coach.enabled || (s.coach.mutedUntil ?? 0) > now) return null;
  const temper = effectiveTemper(s.coach, {
    injuries: s.injuries,
    restPeriods: s.restPeriods,
    sleeps: s.sleeps,
    finished: s.workouts.filter((w) => w.finishedAt !== null),
    now,
  });
  return { temper, text: say(fact, temper, { locale, fmt, yoMama: s.coach.yoMama }) };
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
