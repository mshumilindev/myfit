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
  { retryConfig: { maxAttempts: 1 }, rateLimits: { maxConcurrentDispatches: 50 } },
  async (req) => {
    const { uid, title, body } = req.data;
    if (!uid) return;
    await sendToUser(uid, { title, body, tag: 'rest-done', url: '/' });
  },
);
