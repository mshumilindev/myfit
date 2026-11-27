/**
 * SPO-639 (G1): `reportClientError` — anonymous client crash reports into Cloud Logging (Error Reporting picks them up).
 * Nothing is written to Firestore, and neither the caller's uid nor the IP is read, so a report cannot be tied to a person.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
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

export const reportClientError = onCall({ maxInstances: 3 }, (req) => {
  const report = sanitizeReport(req.data);
  if (!report) throw new HttpsError('invalid-argument', 'bad report');
  if (!allow(Date.now())) return { ok: false };
  logger.error('client_error', report);
  return { ok: true };
});
