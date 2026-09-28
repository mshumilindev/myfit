/**
 * Web push delivery (FCM). The server knows nothing about coaching or rest
 * rules — the client decides what to say and when; this file only delivers:
 *
 *  - `sendDueOutbox` (called from the hourly maintenance job): planned
 *    messages the client wrote to users/{uid}/outbox, sent once due.
 *  - `scheduleRestPush` / `cancelRestPush` / `restPushTask`: the exact-time
 *    "rest is over" push for a locked phone, via a Cloud Tasks queue.
 *
 * Tokens live at users/{uid}/push/{deviceId}; dead ones are removed on send.
 */
import { getMessaging } from 'firebase-admin/messaging';
import { getFunctions } from 'firebase-admin/functions';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { db } from './lib';

export interface PushMessage {
  title: string;
  body: string;
  /** Same tag replaces the previous notification instead of stacking. */
  tag?: string;
  /** In-app route opened on tap (hash URL, e.g. "/#/coach"). */
  url?: string;
}

const DEAD_TOKEN = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

function clip(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

/** Send one message to every registered device of a user. Returns devices reached. */
export async function sendToUser(uid: string, msg: PushMessage): Promise<number> {
  const devices = await db.collection('users').doc(uid).collection('push').get();
  if (devices.empty) return 0;
  const tokens = devices.docs.map((d) => String(d.get('token') ?? '')).filter(Boolean);
  if (tokens.length === 0) return 0;
  const data: Record<string, string> = { title: clip(msg.title, 120), body: clip(msg.body, 400) };
  if (msg.tag) data.tag = clip(msg.tag, 60);
  if (msg.url) data.url = clip(msg.url, 200);
  const res = await getMessaging().sendEachForMulticast({
    tokens,
    data,
    webpush: { headers: { Urgency: 'high', TTL: '3600' } },
  });
  const dead = res.responses
    .map((r, i) => (!r.success && r.error && DEAD_TOKEN.has(r.error.code) ? tokens[i] : null))
    .filter((t): t is string => t !== null);
  if (dead.length) {
    const batch = db.batch();
    for (const d of devices.docs) if (dead.includes(String(d.get('token')))) batch.delete(d.ref);
    await batch.commit();
  }
  return res.successCount;
}

/** Deliver every outbox message whose time has come, then drop it. */
export async function sendDueOutbox(now = Date.now()): Promise<number> {
  const due = await db.collectionGroup('outbox').where('dueAt', '<=', now).limit(500).get();
  let sent = 0;
  for (const doc of due.docs) {
    const uid = doc.ref.parent.parent?.id;
    const d = doc.data();
    try {
      // Stale plans (a device offline for days) are dropped, not sent late.
      if (uid && typeof d.dueAt === 'number' && now - d.dueAt < 6 * 3600 * 1000) {
        sent += await sendToUser(uid, {
          title: d.title,
          body: d.body,
          tag: d.tag,
          url: d.url,
        });
      }
    } catch (e) {
      console.error('[push] outbox send failed', doc.ref.path, e);
    }
    await doc.ref.delete();
  }
  return sent;
}

// ---- Exact-time rest alert -------------------------------------------------

interface RestTask {
  uid: string;
  title: string;
  body: string;
}

const MAX_REST_AHEAD_MS = 15 * 60 * 1000;

function restTaskId(uid: string, key: unknown): string {
  const k = typeof key === 'string' ? key.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80) : '';
  if (!k) throw new HttpsError('invalid-argument', 'key');
  return `rest-${uid}-${k}`;
}

function restQueue() {
  return getFunctions().taskQueue<RestTask>('locations/us-central1/functions/restPushTask');
}

export const scheduleRestPush = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'sign in');
  const { key, dueAt, title, body } = (req.data ?? {}) as Record<string, unknown>;
  const now = Date.now();
  if (typeof dueAt !== 'number' || dueAt <= now || dueAt - now > MAX_REST_AHEAD_MS)
    throw new HttpsError('invalid-argument', 'dueAt');
  await restQueue().enqueue(
    { uid, title: clip(title, 120), body: clip(body, 400) },
    { id: restTaskId(uid, key), scheduleTime: new Date(dueAt) },
  );
  return { ok: true };
});

export const cancelRestPush = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'sign in');
  try {
    await restQueue().delete(restTaskId(uid, (req.data ?? {}).key));
  } catch {
    /* already ran or never existed */
  }
  return { ok: true };
});

export const restPushTask = onTaskDispatched<RestTask>(
  {
    invoker: 'firebase-adminsdk-fbsvc@spotter-64c3b.iam.gserviceaccount.com',
    retryConfig: { maxAttempts: 1 },
    rateLimits: { maxConcurrentDispatches: 50 },
  },
  async (req) => {
    const { uid, title, body } = req.data;
    if (!uid) return;
    await sendToUser(uid, { title, body, tag: 'rest-done', url: '/' });
  },
);

// ---- Exact-time outbox (Atlas notes, reviews, chat replies) ----------------

interface OutboxTask {
  uid: string;
  id: string;
  dueAt: number;
}

/** Cloud Tasks can hold a task this far ahead; later ones wait for the hourly job. */
const MAX_TASK_AHEAD_MS = 29 * 24 * 3600 * 1000;

function outboxQueue() {
  return getFunctions().taskQueue<OutboxTask>('locations/us-central1/functions/outboxPushTask');
}

/** Send one outbox doc if it's still there and still due at `dueAt`, then drop it. */
async function sendOutboxDoc(uid: string, id: string, dueAt: number): Promise<void> {
  const ref = db.collection('users').doc(uid).collection('outbox').doc(id);
  const snap = await ref.get();
  const d = snap.data();
  // Re-planned (other time) or cancelled (deleted) since → nothing to do here.
  if (!d || d.dueAt !== dueAt) return;
  await sendToUser(uid, { title: d.title, body: d.body, tag: d.tag, url: d.url });
  await ref.delete();
}

/**
 * A planned message was written → deliver it at its minute, not at the next
 * hourly run: due now → sent at once; later → a Cloud Task at `dueAt`.
 */
export const onOutboxWrite = onDocumentWritten('users/{uid}/outbox/{id}', async (event) => {
  const after = event.data?.after;
  if (!after?.exists) return;
  const { uid, id } = event.params;
  const dueAt = after.get('dueAt');
  if (typeof dueAt !== 'number') return;
  const now = Date.now();
  if (dueAt <= now + 30_000) {
    if (now - dueAt < 6 * 3600 * 1000) await sendOutboxDoc(uid, id, dueAt);
    return;
  }
  if (dueAt - now > MAX_TASK_AHEAD_MS) return;
  const taskId = `ob-${uid}-${id}-${dueAt}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 480);
  try {
    await outboxQueue().enqueue({ uid, id, dueAt }, { id: taskId, scheduleTime: new Date(dueAt) });
  } catch (e) {
    // Same doc rewritten with the same time → the task already exists.
    if (!String((e as { code?: string }).code ?? e).includes('already-exists')) throw e;
  }
});

export const outboxPushTask = onTaskDispatched<OutboxTask>(
  {
    invoker: 'firebase-adminsdk-fbsvc@spotter-64c3b.iam.gserviceaccount.com',
    retryConfig: { maxAttempts: 2, minBackoffSeconds: 30 },
    rateLimits: { maxConcurrentDispatches: 50 },
  },
  async (req) => {
    const { uid, id, dueAt } = req.data;
    if (!uid || !id || typeof dueAt !== 'number') return;
    await sendOutboxDoc(uid, id, dueAt);
  },
);
