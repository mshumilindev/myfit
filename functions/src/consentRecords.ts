/**
 * Legal consent records (SPO-296): `users/{uid}/consentRecords/{id}`, append-only, written ONLY here (rules: write false).
 * Not the coaching `consentLog`. Time is the server's; logic and limits live in `consentRecordsCore.ts`.
 */
import { randomBytes } from 'node:crypto';
import { onCall } from 'firebase-functions/v2/https';
import { db, HOT } from './lib';
import { ENFORCE_APPCHECK } from './coach/runtime';
import { firestoreKv } from './coach/firestoreKv';
import { recordConsentHandler } from './consentRecordsCore';

export const recordConsent = onCall(
  { enforceAppCheck: ENFORCE_APPCHECK, maxInstances: 10, ...HOT },
  (req) =>
    recordConsentHandler(firestoreKv(db), {
      uid: req.auth?.uid,
      data: req.data,
      now: Date.now(),
      rand: () => randomBytes(6).toString('hex'),
    }),
);
