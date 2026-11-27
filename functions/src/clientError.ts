/**
 * SPO-639 (G1): `reportClientError` — anonymous client crash reports into Cloud Logging (Error Reporting picks them up).
 * Nothing is written to Firestore and the handler reads neither uid nor IP. NOT anonymous end to end: the platform's own request
 * logs (IP, user agent) and the auth/App Check tokens the client SDK sends still exist, so do not describe it as untraceable.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { ENFORCE_APPCHECK } from './coach/runtime';
import { sanitizeReport } from './clientErrorPure';

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
let windowStart = 0;
let count = 0;

/** Instance-wide cap against floods; per-client limiting happens on the client (1 per minute per kind). */
function allow(now: number): boolean {
  if (now - windowStart > WINDOW_MS) {
    windowStart = now;
    count = 0;
  }
  count += 1;
  return count <= MAX_PER_WINDOW;
}

const seen = new Map<string, number>();

/** Same report within a minute is logged once: a bad release must not turn into thousands of identical log lines. */
function seenRecently(key: string, now: number): boolean {
  if (seen.size > 500) seen.clear();
  const last = seen.get(key) ?? 0;
  seen.set(key, now);
  return now - last < WINDOW_MS;
}

export const reportClientError = onCall(
  { maxInstances: 3, enforceAppCheck: ENFORCE_APPCHECK },
  (req) => {
    const report = sanitizeReport(req.data);
    if (!report) throw new HttpsError('invalid-argument', 'bad report');
    const now = Date.now();
    if (!allow(now) || seenRecently(`${report.kind}|${report.message}|${report.build}`, now))
      return { ok: false };
    logger.error('client_error', report);
    return { ok: true };
  },
);
