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
    ...existing.docs.filter((d) => !keep.has(d.id)).map((d) => deleteDoc(d.ref)),
    ...messages.map((m) =>
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
