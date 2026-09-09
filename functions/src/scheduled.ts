/**
 * Scheduled maintenance. The client also auto-finishes stale sessions locally
 * (store.applyAutoFinish), but this catches sessions of users who never reopen
 * the app, keeping their history correct across devices.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from './lib';
import * as crypto from 'node:crypto';

const AUTO_FINISH_AFTER_MS = 8 * 60 * 60 * 1000;

/** Every hour: close any workout still open more than 8h after it started. */
export const autoFinishStaleWorkouts = onSchedule('every 60 minutes', async () => {
  const cutoff = Date.now() - AUTO_FINISH_AFTER_MS;
  // Collection-group across every user's workouts subcollection.
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
  console.log(`[autoFinish] closed ${closed} stale workout(s)`);
});

const SLEEP_TICK = 'every 15 minutes';
const AUTO_START_STALE_MS = 6 * 60 * 60 * 1000; // don't resurrect very old slots

interface UpcomingNight {
  startAt: number;
  wakeAt: number;
  date: string;
}

/**
 * Every 15 min: finalize any live night whose scheduled wake time has passed —
 * the server counterpart of the client's auto-end, so a night the app is
 * managing still closes at the usual time even if the app never reopens.
 * Mirrors autoFinishStaleWorkouts: one collection-group query + batches.
 */
export const autoEndStaleSleeps = onSchedule(SLEEP_TICK, async () => {
  const now = Date.now();
  const open = await db.collectionGroup('sleeps').where('wake', '==', null).get();
  let ended = 0;
  let batch = db.batch();
  let ops = 0;
  for (const docSnap of open.docs) {
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
  console.log(`[autoEndSleeps] ended ${ended} night(s)`);
});

/**
 * Every 15 min: open tonight's night for users whose scheduled bedtime has
 * arrived while the app is closed. Scales by an indexed due-queue — one doc per
 * user (sleepSchedules/{uid}) carrying the upcoming bedtimes the client laid out
 * as absolute instants in its own timezone, so this function stays pure UTC and
 * only touches users who are actually due now.
 */
export const autoStartScheduledSleeps = onSchedule(SLEEP_TICK, async () => {
  const now = Date.now();
  const due = await db.collection('sleepSchedules').where('nextStartAt', '<=', now).get();
  let started = 0;
  for (const docSnap of due.docs) {
    const uid = docSnap.id;
    const data = docSnap.data() as { upcoming?: UpcomingNight[] };
    const upcoming = Array.isArray(data.upcoming) ? [...data.upcoming] : [];
    // Drop any slots already in the past; act only on the most recent due one.
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
  console.log(`[autoStartSleeps] started ${started} night(s) from ${due.size} due user(s)`);
});
