/**
 * Scheduled maintenance — a single hourly job. The client does all of this
 * precisely while it's open (store.applyAutoFinish, the sleep pause controller
 * and auto-start/auto-end effects); this catches users who never reopen the
 * app, keeping their history correct across devices.
 *
 * Everything is folded into ONE onSchedule handler on purpose: it adds no extra
 * Cloud Scheduler job and no extra invocations beyond the one that already runs
 * hourly — only a couple of marginal Firestore reads per run. That keeps the
 * whole thing comfortably inside the free tier.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from './lib';
import * as crypto from 'node:crypto';

const AUTO_FINISH_AFTER_MS = 8 * 60 * 60 * 1000;
const AUTO_START_STALE_MS = 6 * 60 * 60 * 1000; // don't resurrect very old slots

interface UpcomingNight {
  startAt: number;
  wakeAt: number;
  date: string;
}

/** Close any workout still open more than 8h after it started. */
async function finishStaleWorkouts(): Promise<number> {
  const cutoff = Date.now() - AUTO_FINISH_AFTER_MS;
  const open = await db.collectionGroup('workouts').where('finishedAt', '==', null).get();
  let closed = 0;
  let batch = db.batch();
  let ops = 0;
  for (const doc of open.docs) {
    const w = doc.data() as { startedAt: number };
    if (typeof w.startedAt !== 'number' || w.startedAt > cutoff) continue;
    batch.update(doc.ref, {
      finishedAt: w.startedAt + AUTO_FINISH_AFTER_MS,
      autoFinished: true,
      updatedAt: Date.now(),
    });
    closed++;
    if (++ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
  return closed;
}

/**
 * Finalize any live night whose scheduled wake time has passed — the server
 * counterpart of the client's auto-end, so a managed night still closes at the
 * usual time even if the app never reopens. One collection-group query + batches.
 */
async function endDueSleeps(): Promise<number> {
  const now = Date.now();
  const openNights = await db.collectionGroup('sleeps').where('wake', '==', null).get();
  let ended = 0;
  let batch = db.batch();
  let ops = 0;
  for (const docSnap of openNights.docs) {
    const n = docSnap.data() as { bedtime: number; autoWakeAt?: number };
    if (typeof n.autoWakeAt !== 'number' || n.autoWakeAt > now) continue;
    const wake = Math.max(n.autoWakeAt, (n.bedtime ?? 0) + 60000);
    batch.update(docSnap.ref, { wake, source: 'auto', updatedAt: now });
    ended++;
    if (++ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
  return ended;
}

/**
 * Open tonight's night for users whose scheduled bedtime arrived while the app
 * was closed. Scales by an indexed due-queue — one doc per user
 * (sleepSchedules/{uid}) holding the upcoming bedtimes the client laid out as
 * absolute instants in its own timezone, so this stays pure UTC and reads only
 * the users who are actually due now.
 */
async function startDueSleeps(): Promise<number> {
  const now = Date.now();
  const due = await db.collection('sleepSchedules').where('nextStartAt', '<=', now).get();
  let started = 0;
  for (const docSnap of due.docs) {
    const uid = docSnap.id;
    const data = docSnap.data() as { upcoming?: UpcomingNight[] };
    const upcoming = Array.isArray(data.upcoming) ? [...data.upcoming] : [];
    // Drop slots already in the past; act only on the most recent due one.
    let slot: UpcomingNight | undefined;
    while (upcoming.length && upcoming[0].startAt <= now) slot = upcoming.shift();
    const next = upcoming[0];
    const advance = next
      ? docSnap.ref.update({ nextStartAt: next.startAt, upcoming, updatedAt: now })
      : docSnap.ref.delete();

    // Only open a night for a fresh slot, and only if none is already open.
    if (slot && now - slot.startAt <= AUTO_START_STALE_MS) {
      const openSnap = await db
        .collection('users')
        .doc(uid)
        .collection('sleeps')
        .where('wake', '==', null)
        .limit(1)
        .get();
      if (openSnap.empty) {
        const id = crypto.randomUUID();
        await db.collection('users').doc(uid).collection('sleeps').doc(id).set({
          id,
          date: slot.date,
          bedtime: slot.startAt,
          wake: null,
          autoWakeAt: slot.wakeAt,
          source: 'auto',
          updatedAt: now,
        });
        started++;
      }
    }
    await advance;
  }
  return started;
}

/**
 * The one hourly maintenance job. Sleep steps are isolated so a failure there
 * never blocks the workout sweep (or vice-versa).
 */
export const autoFinishStaleWorkouts = onSchedule('every 60 minutes', async () => {
  let closed = 0;
  let ended = 0;
  let started = 0;
  try {
    closed = await finishStaleWorkouts();
  } catch (e) {
    console.error('[maintenance] workout sweep failed', e);
  }
  try {
    ended = await endDueSleeps();
  } catch (e) {
    console.error('[maintenance] sleep auto-end failed', e);
  }
  try {
    started = await startDueSleeps();
  } catch (e) {
    console.error('[maintenance] sleep auto-start failed', e);
  }
  console.log(`[maintenance] workouts closed=${closed} sleeps ended=${ended} started=${started}`);
});
