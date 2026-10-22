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
import { sendDueOutbox } from './push';
import * as crypto from 'node:crypto';
import { takeDueSlot, wakeToCloseAt, type UpcomingNight } from './sleepAuto';
import { firestoreKv } from './coach/firestoreKv';
import { purgeStaleLoginAttempts, sweepPhantomUsers } from './accountMaintenanceCore';
import { firebaseDeletionPorts, phantomUserIds } from './accountDeletion';

const AUTO_FINISH_AFTER_MS = 8 * 60 * 60 * 1000;
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
    const n = docSnap.data() as { bedtime?: number; autoWakeAt?: number };
    const wake = wakeToCloseAt(n, now);
    if (wake === null) continue;
    batch.update(docSnap.ref, { wake, source: 'auto', kind: 'sleep', updatedAt: now });
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

async function startOneDueSleep(
  docSnap: FirebaseFirestore.QueryDocumentSnapshot,
  now: number,
): Promise<boolean> {
  const uid = docSnap.id;
  const data = docSnap.data() as { upcoming?: UpcomingNight[] };
  const { slot, rest } = takeDueSlot(Array.isArray(data.upcoming) ? data.upcoming : [], now);
  // Advance the queue first: a slot is consumed once, even if opening the night fails below.
  if (rest.length)
    await docSnap.ref.update({ nextStartAt: rest[0].startAt, upcoming: rest, updatedAt: now });
  else await docSnap.ref.delete();
  if (!slot) return false;
  const sleeps = db.collection('users').doc(uid).collection('sleeps');
  // Only if no night is open, and not when this night is already logged (the app started or
  // filled it itself) — that's how the same night got recorded twice.
  const openSnap = await sleeps.where('wake', '==', null).limit(1).get();
  const sameDay = await sleeps.where('date', '==', slot.date).limit(1).get();
  if (!openSnap.empty || !sameDay.empty) return false;
  const id = crypto.randomUUID();
  await sleeps.doc(id).set({
    id,
    date: slot.date,
    bedtime: slot.startAt,
    wake: null,
    autoWakeAt: slot.wakeAt,
    source: 'auto',
    updatedAt: now,
  });
  return true;
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
    // One user's failure must not stop the others from getting their night.
    try {
      if (await startOneDueSleep(docSnap, now)) started++;
    } catch (e) {
      console.error('[maintenance] sleep auto-start failed for', docSnap.id, e);
    }
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
  let pushed = 0;
  try {
    pushed = await sendDueOutbox();
  } catch (e) {
    console.error('[maintenance] push outbox failed', e);
  }
  let attempts = 0;
  try {
    attempts = await purgeStaleLoginAttempts(firestoreKv(db), Date.now());
  } catch (e) {
    console.error('[maintenance] login attempts purge failed', e);
  }
  console.log(
    `[maintenance] workouts closed=${closed} sleeps ended=${ended} started=${started} pushed=${pushed} loginAttemptsPurged=${attempts}`,
  );
});

/** Daily: user trees whose account document is gone (written back by a stale token or an offline queue after deletion). */
export const sweepOrphanUserTrees = onSchedule('every 24 hours', async () => {
  try {
    const n = await sweepPhantomUsers(firestoreKv(db), {
      phantomUserIds,
      deleteTree: firebaseDeletionPorts.deleteTree,
    });
    console.log(`[maintenance] orphan user trees removed=${n}`);
  } catch (e) {
    console.error('[maintenance] orphan sweep failed', e);
  }
});
