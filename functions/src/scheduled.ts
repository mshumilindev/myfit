/**
 * Scheduled maintenance. The client also auto-finishes stale sessions locally
 * (store.applyAutoFinish), but this catches sessions of users who never reopen
 * the app, keeping their history correct across devices.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from './lib';

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
