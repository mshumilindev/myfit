/**
 * Spotter Cloud Functions entrypoint.
 *
 * Only privileged / cross-user / server-authoritative work lives here; ordinary
 * tracker data is read and written directly against Firestore by the client
 * (guarded by firestore.rules). Region is pinned to us-central1 to match the
 * client's getFunctions(app, 'us-central1').
 */
import { setGlobalOptions } from 'firebase-functions/v2/options';

setGlobalOptions({
  region: 'us-central1',
  maxInstances: 10,
  invoker: 'public',
  // Gen2 default compute SA cannot mint custom tokens without extra IAM; the
  // Firebase Admin SDK service account already has the signing keys.
  serviceAccount: 'firebase-adminsdk-fbsvc@spotter-64c3b.iam.gserviceaccount.com',
});

// Auth: bcrypt credential store ↔ Firebase custom tokens.
export * from './auth';

// Privileged surfaces.
export * from './admin';
export * from './trainer';
export * from './programs';
export * from './profile';
export * from './scheduled';
// Notices, mark-read, reminders and reminder-dismissals are plain Firestore
// reads/writes on the client (guarded by rules) — no functions needed.
