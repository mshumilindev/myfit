/**
 * Planner reminders (SPO-552 I6). The device writes a sealed plan with open `mode`, `enabled` and `fireAts`; here:
 *  - a write queues one task for the next moment;
 *  - the task sends a content-free push, queues the next moment and, for `ring`, opens a state document and repeats
 *    until the person dismisses or snoozes it on any device;
 *  - a snooze (written by a device) queues a task for the moment it ends.
 * Nothing the server handles names the plan; the push says only that a Planner reminder is due.
 */
import { getFunctions } from 'firebase-admin/functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { db } from './lib';
import { sendToUser } from './push';
import {
  ALERT_KEEP_MS,
  RING_MAX_REPEATS,
  RING_REPEAT_MS,
  alertId,
  nextAfter,
  repeatAction,
  ringable,
  taskId,
  validFires,
  type PlannerTask,
} from './plannerCore';

const queue = () =>
  getFunctions().taskQueue<PlannerTask>('locations/us-central1/functions/plannerTask');

/** Queue a task at `at`. A task that already exists (same moment, same step) is fine: that is the idempotence. */
async function enqueue(t: PlannerTask, at: number): Promise<void> {
  try {
    await queue().enqueue(t, { id: taskId(t), scheduleTime: new Date(Math.max(at, Date.now())) });
  } catch (e) {
    if (!String((e as { code?: string }).code ?? e).includes('already-exists')) throw e;
  }
}

const eventRef = (uid: string, id: string) =>
  db.collection('users').doc(uid).collection('plannerEvents').doc(id);
const alertRef = (uid: string, id: string, dueAt: number) =>
  db.collection('users').doc(uid).collection('plannerAlerts').doc(alertId(id, dueAt));

/** A plan was saved: queue the next moment. */
export const onPlannerEventWrite = onDocumentWritten(
  'users/{uid}/plannerEvents/{id}',
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists || after.get('enabled') !== true) return;
    const { uid, id } = event.params;
    const now = Date.now();
    const fires = validFires(after.get('fireAts'));
    const next = nextAfter(fires, now - 1000);
    if (next != null && ringable(next, now))
      await enqueue({ uid, id, dueAt: next, step: 'fire' }, next);
  },
);

/** A device snoozed a reminder: queue the moment it ends. */
export const onPlannerAlertWrite = onDocumentWritten(
  'users/{uid}/plannerAlerts/{alertId}',
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists || after.get('state') !== 'snoozed') return;
    const until = after.get('snoozeUntil');
    const id = after.get('eventId');
    const dueAt = after.get('dueAt');
    if (typeof until !== 'number' || typeof id !== 'string' || typeof dueAt !== 'number') return;
    await enqueue(
      { uid: event.params.uid, id, dueAt, step: 'snooze', n: Math.floor(until / 1000) },
      until,
    );
  },
);

async function ring(uid: string, id: string): Promise<number> {
  return sendToUser(uid, {
    title: 'Spotter',
    body: '',
    text: 'planner',
    kind: 'planner-ring',
    tag: `planner-${id}`,
    url: '/#/',
    ttl: 120,
  });
}

export const plannerTask = onTaskDispatched<PlannerTask>(
  {
    invoker: 'firebase-adminsdk-fbsvc@spotter-64c3b.iam.gserviceaccount.com',
    retryConfig: { maxAttempts: 2, minBackoffSeconds: 30 },
    rateLimits: { maxConcurrentDispatches: 50 },
  },
  async (req) => {
    const t = req.data;
    if (!t?.uid || !t.id || typeof t.dueAt !== 'number') return;
    const now = Date.now();

    if (t.step === 'cleanup') {
      await alertRef(t.uid, t.id, t.dueAt).delete();
      return;
    }

    const ev = await eventRef(t.uid, t.id).get();
    // deleted, switched off, or re-planned without this moment: nothing to send
    if (!ev.exists || ev.get('enabled') !== true) return;
    const fires = validFires(ev.get('fireAts'));
    if (!fires.includes(t.dueAt)) return;
    const mode = ev.get('mode') === 'ring' ? 'ring' : 'quiet';

    if (t.step === 'fire') {
      if (now - t.dueAt <= 6 * 3600_000) {
        if (mode === 'ring') {
          await alertRef(t.uid, t.id, t.dueAt).set({
            state: 'ringing',
            rev: 1,
            updatedAt: now,
            eventId: t.id,
            dueAt: t.dueAt,
          });
          await ring(t.uid, t.id);
          await enqueue({ ...t, step: 'repeat', n: 1, r: 1 }, now + RING_REPEAT_MS);
          await enqueue({ ...t, step: 'cleanup' }, t.dueAt + ALERT_KEEP_MS);
        } else {
          await sendToUser(t.uid, {
            title: 'Spotter',
            body: '',
            text: 'planner',
            kind: 'planner',
            tag: `planner-${t.id}`,
            url: '/#/',
          });
        }
      }
      const next = nextAfter(fires, t.dueAt);
      if (next != null && ringable(next, now))
        await enqueue({ uid: t.uid, id: t.id, dueAt: next, step: 'fire' }, next);
      return;
    }

    // repeat / snooze end: the shared alert decides
    const alert = await alertRef(t.uid, t.id, t.dueAt).get();
    if (t.step === 'snooze') {
      const a = alert.data();
      if (a?.state !== 'snoozed' || typeof a.snoozeUntil !== 'number' || a.snoozeUntil > now + 5000)
        return;
      const rev = (typeof a.rev === 'number' ? a.rev : 0) + 1;
      await alertRef(t.uid, t.id, t.dueAt).update({ state: 'ringing', rev, updatedAt: now });
      await ring(t.uid, t.id);
      await enqueue({ ...t, step: 'repeat', n: 1, r: rev }, now + RING_REPEAT_MS);
      return;
    }
    const n = t.n ?? 1;
    if (repeatAction(alert.data(), n, now) !== 'ring') return;
    await ring(t.uid, t.id);
    if (n < RING_MAX_REPEATS)
      await enqueue({ ...t, step: 'repeat', n: n + 1 }, now + RING_REPEAT_MS);
  },
);
