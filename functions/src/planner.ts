/**
 * Planner reminders (SPO-552 I6), the smallest server part. The device writes a sealed plan with open `mode`, `enabled`
 * and `fireAts`; here a write queues one task for the next moment, and the task sends one content-free push and queues
 * the next moment. Repeats of a persistent reminder, snooze and the ringing screen belong to the client (open app,
 * desktop); a closed phone gets the one visible push.
 */
import { getFunctions } from 'firebase-admin/functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { db } from './lib';
import { sendToUser } from './push';
import { STALE_MS, nextAfter, ringable, taskId, validFires, type PlannerTask } from './plannerCore';

const queue = () =>
  getFunctions().taskQueue<PlannerTask>('locations/us-central1/functions/plannerTask');

/** Queue a task at `at`. A task that already exists (same moment) is fine: that is the idempotence. */
async function enqueue(t: PlannerTask): Promise<void> {
  try {
    await queue().enqueue(t, {
      id: taskId(t),
      scheduleTime: new Date(Math.max(t.dueAt, Date.now())),
    });
  } catch (e) {
    if (!String((e as { code?: string }).code ?? e).includes('already-exists')) throw e;
  }
}

/** A plan was saved: queue the next moment. */
export const onPlannerEventWrite = onDocumentWritten(
  'users/{uid}/plannerEvents/{id}',
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists || after.get('enabled') !== true) return;
    const now = Date.now();
    const next = nextAfter(validFires(after.get('fireAts')), now - 1000);
    if (next != null && ringable(next, now)) {
      await enqueue({ uid: event.params.uid, id: event.params.id, dueAt: next });
    }
  },
);

export const plannerTask = onTaskDispatched<PlannerTask>(
  {
    invoker: 'firebase-adminsdk-fbsvc@spotter-64c3b.iam.gserviceaccount.com',
    retryConfig: { maxAttempts: 2, minBackoffSeconds: 30 },
    rateLimits: { maxConcurrentDispatches: 50 },
  },
  async (req) => {
    const { uid, id, dueAt } = req.data ?? ({} as Partial<PlannerTask>);
    if (!uid || !id || typeof dueAt !== 'number') return;
    const ev = await db.collection('users').doc(uid).collection('plannerEvents').doc(id).get();
    // deleted, switched off, or re-planned without this moment: nothing to send
    if (!ev.exists || ev.get('enabled') !== true) return;
    const fires = validFires(ev.get('fireAts'));
    if (!fires.includes(dueAt)) return;
    const now = Date.now();
    if (now - dueAt <= STALE_MS) {
      const ring = ev.get('mode') === 'ring';
      await sendToUser(uid, {
        title: 'Spotter',
        body: '',
        text: 'planner',
        kind: ring ? 'planner-ring' : 'planner',
        tag: `planner-${id}`,
        url: '/#/',
      });
    }
    const next = nextAfter(fires, dueAt);
    if (next != null && ringable(next, now)) await enqueue({ uid, id, dueAt: next });
  },
);
