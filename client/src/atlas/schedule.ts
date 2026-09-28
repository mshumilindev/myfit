/**
 * What Atlas will say while the app is closed — written to the user's outbox
 * (users/{uid}/outbox), delivered by the hourly server job as a push. Texts are
 * voiced here (temper and language applied); the server only delivers.
 * Re-planned on every change: training today cancels "skipped", etc.
 */
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { currentUid } from '../api';
import { dayKey } from '../store';
import type { Workout } from '../types';
import type { LocaleId } from '../i18n';
import type { Play } from '../playbook';
import { playForWeekday } from '../playbook';
import { usualStartHour } from './facts';
import { planDayFor } from './plan';
import { say, type Fmt } from './voice';
import type { CoachSettings, Temper } from './types';

const DAY = 86_400_000;
/** "Skipped" goes out this long after your usual start. */
export const SKIP_NUDGE_AFTER_H = 2;
/** Never later than this local hour. */
export const LATEST_NUDGE_H = 21;
/** The Sunday review goes out at this local hour. */
export const REVIEW_H = 19;

export interface OutboxMessage {
  id: string;
  dueAt: number;
  title: string;
  body: string;
  tag: string;
  url: string;
}

export interface OutboxInput {
  coach: CoachSettings;
  temper: Temper;
  finished: Workout[];
  plays: Play[];
  now: number;
  locale: LocaleId;
  fmt: Fmt;
  title: string;
  reviewBody: string;
}

function atHour(day: number, hour: number): number {
  const d = new Date(day);
  d.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);
  return d.getTime();
}

/** The next few messages Atlas has planned (pure). */
export function planOutbox(p: OutboxInput): OutboxMessage[] {
  const out: OutboxMessage[] = [];
  if (!p.coach.enabled) return out;
  for (let i = 0; i < 2; i++) {
    const day = new Date(p.now + i * DAY);
    day.setHours(12, 0, 0, 0);
    const ts = day.getTime();
    const dow = day.getDay();
    const trained = p.finished.some((w) => dayKey(w.startedAt) === dayKey(ts));
    if (trained) continue;
    const planned = p.coach.plan && p.coach.role === 'main' ? planDayFor(p.coach.plan, ts) : null;
    const play = playForWeekday(p.plays, dow);
    if (!planned && !play) continue;
    const usual = usualStartHour(p.finished, dow) ?? 18;
    const dueAt = atHour(ts, Math.min(LATEST_NUDGE_H, usual + SKIP_NUDGE_AFTER_H));
    if (dueAt <= p.now) continue;
    const key = dayKey(ts);
    out.push({
      id: `skipped-${key}`,
      dueAt,
      title: p.title,
      body: say(
        {
          kind: 'skipped',
          id: `skipped:${key}`,
          at: dueAt,
          dayName: planned?.name ?? play?.name ?? null,
        },
        p.temper,
        { locale: p.locale, fmt: p.fmt, yoMama: p.coach.yoMama },
      ),
      tag: 'atlas-skipped',
      url: '/#/coach',
    });
  }
  // Next Sunday evening: the weekly review.
  const sun = new Date(p.now);
  sun.setDate(sun.getDate() + ((7 - sun.getDay()) % 7));
  let review = atHour(sun.getTime(), REVIEW_H);
  if (review <= p.now) review += 7 * DAY;
  out.push({
    id: `review-${dayKey(review)}`,
    dueAt: review,
    title: p.title,
    body: p.reviewBody,
    tag: 'atlas-review',
    url: '/#/coach',
  });
  return out;
}

/** Make the server outbox match the plan: write new/changed, drop the rest. */
export async function syncOutbox(messages: OutboxMessage[]): Promise<void> {
  const uid = currentUid();
  if (!uid) return;
  const col = collection(db, 'users', uid, 'outbox');
  const existing = await getDocs(col);
  const keep = new Set(messages.map((m) => m.id));
  await Promise.all([
    // Chat-reply pushes are one-offs the server sends at once — not part of the plan.
    ...existing.docs
      .filter((d) => !keep.has(d.id) && !d.id.startsWith('reply-'))
      .map((d) => deleteDoc(d.ref)),
    ...messages
      // Unchanged docs aren't rewritten (each write wakes the server trigger).
      .filter((m) => {
        const d = existing.docs.find((x) => x.id === m.id)?.data();
        return !(d && d.dueAt === m.dueAt && d.body === m.body && d.title === m.title);
      })
      .map((m) =>
        setDoc(doc(col, m.id), {
          dueAt: m.dueAt,
          title: m.title,
          body: m.body,
          tag: m.tag,
          url: m.url,
        }),
      ),
  ]);
}

// ---- New notes while the app is closed -------------------------------------

/** Pushes go out between these local hours; earlier/later waits for the morning. */
export const QUIET_START_H = 22;
export const QUIET_END_H = 9;
/** How far ahead notes are planned (re-planned on every open and change). */
export const NOTE_LOOKAHEAD_H = 36;
/** Kinds already pushed by planOutbox (skipped day, Sunday review). */
const PLANNED_ELSEWHERE = new Set(['skipped', 'week', 'intro']);

/** Move a time out of the quiet hours (to QUIET_END_H the same or next morning). */
export function outOfQuiet(ts: number): number {
  const d = new Date(ts);
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= QUIET_END_H && h < QUIET_START_H) return ts;
  if (h >= QUIET_START_H) d.setDate(d.getDate() + 1);
  d.setHours(QUIET_END_H, 0, 0, 0);
  return d.getTime();
}

export interface NoteLike {
  id: string;
  at: number;
  kind: string;
  text: string;
}

/**
 * Notes Atlas will "say" by itself over the next hours while nothing else
 * changes (a recovery, a comeback nudge, a streak, a sleep line…): the notes
 * feed is recomputed at future moments and every note that isn't there yet
 * becomes a push at the moment it appears (never in the quiet hours).
 * `notesAt(t)` is the feed as it would be at time t (pure, from history).
 */
export function planNotePushes(p: {
  coach: CoachSettings;
  now: number;
  notesAt: (t: number) => NoteLike[];
  title: string;
  stepH?: number;
}): OutboxMessage[] {
  if (!p.coach.enabled) return [];
  const step = (p.stepH ?? 2) * 3_600_000;
  const known = new Set(p.notesAt(p.now).map((n) => n.id));
  const out: OutboxMessage[] = [];
  for (let t = p.now + step; t <= p.now + NOTE_LOOKAHEAD_H * 3_600_000; t += step) {
    for (const n of p.notesAt(t)) {
      if (known.has(n.id)) continue;
      known.add(n.id);
      if (PLANNED_ELSEWHERE.has(n.kind)) continue;
      // It appears somewhere in (t - step, t]; its own time if that's inside.
      const appear = n.at > t - step && n.at <= t ? n.at : t;
      const dueAt = outOfQuiet(Math.max(appear, p.now + 60_000));
      if ((p.coach.mutedUntil ?? 0) > dueAt) continue;
      out.push({
        id: `note-${n.id.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120)}`,
        dueAt,
        title: p.title,
        body: n.text,
        tag: `atlas-${n.kind}`,
        url: '/#/coach',
      });
    }
  }
  return out;
}

/**
 * A chat reply that finished while the app was in the background: pushed
 * right away (the server trigger sends outbox docs that are already due).
 */
export async function pushReplyNow(title: string, body: string, now: number): Promise<void> {
  const uid = currentUid();
  if (!uid) return;
  const text = body.length > 300 ? `${body.slice(0, 297).trimEnd()}…` : body;
  await setDoc(doc(collection(db, 'users', uid, 'outbox'), `reply-${now}`), {
    dueAt: now,
    title,
    body: text,
    tag: 'atlas-reply',
    url: '/#/coach',
  });
}
